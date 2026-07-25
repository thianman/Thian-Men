// Ranked client logic — profile, queue, matchmaking, result reporting.
import { supabase } from './supabase.js'
import {
  CURRENT_SEASON, PLACEMENT_MATCHES, STARTING_MMR,
  MMR_WIN_BASE, MMR_LOSS_BASE, PLACEMENT_WIN_BONUS,
  matchmakingBand,
} from '../game/rankedConstants.js'
import { CloudflareTransport } from '../net/cfTransport.js'

// Ensure the user has a ranked row for the current season.
export async function ensureRanked(userId) {
  if (!userId) return null
  const { data } = await supabase.from('ranked')
    .select('*').eq('user_id', userId).maybeSingle()
  if (data && data.season === CURRENT_SEASON) return data
  // Fresh insert or season reset
  const row = {
    user_id: userId, season: CURRENT_SEASON,
    mmr: STARTING_MMR, wins: 0, losses: 0,
    placement_left: PLACEMENT_MATCHES, peak_mmr: STARTING_MMR,
    updated_at: new Date().toISOString(),
  }
  const { data: up } = await supabase.from('ranked').upsert(row, { onConflict: 'user_id' }).select().maybeSingle()
  return up || row
}

export async function loadRanked(userId) {
  if (!userId) return null
  const { data } = await supabase.from('ranked')
    .select('*').eq('user_id', userId).maybeSingle()
  return data
}

// Enter the ranked queue. Cleans up any stale row for this user first.
export async function joinQueue(userId, mmr) {
  if (!userId) return { ok: false, error: 'not signed in' }
  await supabase.from('ranked_queue').delete().eq('user_id', userId)
  const { error } = await supabase.from('ranked_queue').insert({
    user_id: userId, mmr, status: 'waiting',
    queued_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function leaveQueue(userId) {
  if (!userId) return
  await supabase.from('ranked_queue').delete().eq('user_id', userId)
}

// Look for another waiting player within MMR band. If found, atomically
// try to claim them and create a match room. Returns { room_code } or null.
// This is intentionally simple/racy — small traffic is fine.
export async function tryMatchmake(userId, myMmr, queuedAt) {
  if (!userId) return null
  const secondsWaiting = Math.max(0, (Date.now() - Date.parse(queuedAt)) / 1000)
  const band = matchmakingBand(secondsWaiting)

  const { data: candidates } = await supabase.from('ranked_queue')
    .select('user_id, mmr, queued_at, status')
    .eq('status', 'waiting')
    .neq('user_id', userId)
    .gte('mmr', myMmr - band)
    .lte('mmr', myMmr + band)
    .order('queued_at', { ascending: true })
    .limit(1)

  const opp = candidates && candidates[0]
  if (!opp) return null

  // Create a new online 1v1 match room on the game server
  let code
  try {
    const transport = new CloudflareTransport({ name: 'matchmaker' })
    code = await transport.createMatch('ranked')
  } catch { return null }

  // Try to claim the opponent's waiting row — only succeeds if they're still waiting.
  const nowIso = new Date().toISOString()
  const { data: claimed, error: claimErr } = await supabase.from('ranked_queue')
    .update({ status: 'matched', room_code: code, opponent_id: userId, updated_at: nowIso })
    .eq('user_id', opp.user_id)
    .eq('status', 'waiting')
    .select()
  if (claimErr || !claimed || !claimed.length) return null

  // Also mark our own row matched with the same code.
  await supabase.from('ranked_queue')
    .update({ status: 'matched', room_code: code, opponent_id: opp.user_id, updated_at: nowIso })
    .eq('user_id', userId)

  return { room_code: code, opponent_id: opp.user_id }
}

// Poll our own queue row to see if someone else matched us.
export async function pollMyQueue(userId) {
  if (!userId) return null
  const { data } = await supabase.from('ranked_queue')
    .select('status, room_code, opponent_id')
    .eq('user_id', userId).maybeSingle()
  return data
}

// Report the result of a ranked match. `won` is true if the caller won.
// Placement matches: wins count and get bonus but no MMR loss on defeat.
export async function reportRankedResult(userId, won) {
  if (!userId) return null
  const cur = await ensureRanked(userId)
  const isPlacement = cur.placement_left > 0
  let mmrDelta = 0
  if (won) mmrDelta = MMR_WIN_BASE + (isPlacement ? PLACEMENT_WIN_BONUS : 0)
  else     mmrDelta = isPlacement ? 0 : -MMR_LOSS_BASE

  const newMmr = Math.max(0, cur.mmr + mmrDelta)
  const newPeak = Math.max(cur.peak_mmr, newMmr)
  const patch = {
    mmr: newMmr,
    peak_mmr: newPeak,
    wins: cur.wins + (won ? 1 : 0),
    losses: cur.losses + (won ? 0 : 1),
    placement_left: Math.max(0, cur.placement_left - 1),
    updated_at: new Date().toISOString(),
  }
  await supabase.from('ranked').update(patch).eq('user_id', userId)
  await supabase.from('ranked_queue').delete().eq('user_id', userId)
  return { ...cur, ...patch, mmrDelta, wasPlacement: isPlacement }
}
