// Client-side daily challenges + login streak.
// Row-level security keeps every user to their own rows.
import { supabase } from './supabase.js'
import { rollDailyChallenges, todayUtcKey, findChallenge, streakReward } from '../game/dailyConstants.js'

// Ensure the user has a fresh set of daily challenges for today.
// If none exist for today, roll three. Idempotent — safe to call every load.
export async function ensureDailyChallenges(userId) {
  if (!userId) return []
  const today = todayUtcKey()
  const { data: existing, error: selErr } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
  if (selErr) { console.warn('daily select failed', selErr); return [] }
  if (existing && existing.length >= 3) return existing

  const rolls = rollDailyChallenges(3).map(r => ({ ...r, user_id: userId, date: today }))
  const { data: inserted, error: insErr } = await supabase
    .from('daily_challenges')
    .insert(rolls)
    .select()
  if (insErr) { console.warn('daily insert failed', insErr); return existing || [] }
  return inserted || existing || []
}

export async function loadDailyChallenges(userId) {
  if (!userId) return []
  const today = todayUtcKey()
  const { data } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
  return data || []
}

// Apply a match summary to each active daily. Each challenge type knows how
// to translate the summary into a progress delta.
export async function applyMatchToDailies(userId, summary) {
  if (!userId) return
  const rows = await loadDailyChallenges(userId)
  const updates = []
  for (const row of rows) {
    if (row.claimed) continue
    const def = findChallenge(row.challenge_id)
    if (!def) continue
    const delta = def.matchDelta(summary, row) | 0
    if (delta <= 0) continue
    const next = Math.min(row.target, row.progress + delta)
    if (next === row.progress) continue
    updates.push({ ...row, progress: next })
  }
  if (updates.length) {
    await supabase.from('daily_challenges').upsert(updates)
  }
}

// User claims a completed challenge → awards reward_xp + reward_coins.
// Returns { ok, xp, coins, error }.
export async function claimDailyChallenge(userId, row, prevProgress) {
  if (!userId) return { ok: false, error: 'not signed in' }
  if (row.claimed) return { ok: false, error: 'already claimed' }
  if (row.progress < row.target) return { ok: false, error: 'not complete' }

  const { xpToLevel, levelFromXp, MAX_LEVEL } = await import('../game/progressionConstants.js')

  // Mark claimed
  const { error: claimErr } = await supabase.from('daily_challenges').update({ claimed: true })
    .eq('user_id', userId).eq('date', row.date).eq('challenge_id', row.challenge_id)
  if (claimErr) return { ok: false, error: claimErr.message }

  const prev = prevProgress || { level: 1, xp: 0, coins: 0 }
  const newXp = prev.xp + row.reward_xp
  let newLevel = levelFromXp(newXp); if (newLevel > MAX_LEVEL) newLevel = MAX_LEVEL
  const newCoins = prev.coins + row.reward_coins

  await supabase.from('progression').upsert({
    user_id: userId, level: newLevel, xp: newXp, coins: newCoins,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  await supabase.from('xp_events').insert({
    user_id: userId, reason: 'daily_claim',
    xp: row.reward_xp, coins: row.reward_coins,
    metadata: { challenge_id: row.challenge_id, date: row.date },
  })

  return {
    ok: true,
    xp: row.reward_xp, coins: row.reward_coins,
    prevLevel: prev.level, newLevel,
    prevXp: prev.xp, newXp,
  }
}

// === Login streak ===
// Check today's login. If it's the first time today, tick the streak
// (or reset it) and award the bonus. Returns { rewarded, streak, reward }.
export async function tickLoginStreak(userId, prevProgress) {
  if (!userId) return { rewarded: false, streak: 0 }
  const today = todayUtcKey()
  const prev = prevProgress || {}
  if (prev.last_login_date === today) {
    return { rewarded: false, streak: prev.current_streak || 0 }
  }

  let streak = prev.current_streak || 0
  if (prev.last_login_date) {
    const y = new Date(); y.setUTCDate(y.getUTCDate() - 1)
    const yKey = y.toISOString().slice(0, 10)
    if (prev.last_login_date === yKey) streak = streak + 1
    else streak = 1
  } else {
    streak = 1
  }

  const longest = Math.max(prev.longest_streak || 0, streak)
  const reward = streakReward(streak)

  const { xpToLevel, levelFromXp, MAX_LEVEL } = await import('../game/progressionConstants.js')
  const newXp = (prev.xp || 0) + reward.xp
  let newLevel = levelFromXp(newXp); if (newLevel > MAX_LEVEL) newLevel = MAX_LEVEL
  const newCoins = (prev.coins || 0) + reward.coins

  await supabase.from('progression').upsert({
    user_id: userId,
    last_login_date: today,
    current_streak: streak,
    longest_streak: longest,
    last_streak_reward_at: new Date().toISOString(),
    level: newLevel, xp: newXp, coins: newCoins,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  await supabase.from('xp_events').insert({
    user_id: userId, reason: 'login_streak',
    xp: reward.xp, coins: reward.coins,
    metadata: { streak, milestone: reward.isMilestone },
  })

  return {
    rewarded: true,
    streak,
    longest,
    reward,
    prevLevel: prev.level || 1, newLevel,
    prevXp: prev.xp || 0, newXp,
  }
}
