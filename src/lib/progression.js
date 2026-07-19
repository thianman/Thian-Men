// Client-side progression: loading, initializing, awarding XP + coins.
// Uses supabase-js directly with RLS gating each user to their own rows.
import { supabase } from './supabase.js'
import {
  STARTER_CHARACTERS, CHARACTER_LEVEL_UNLOCKS, CHARACTER_COIN_PRICE,
  XP_REWARDS, COIN_REWARDS, CHARACTER_MASTERY_REWARDS,
  MAX_LEVEL, levelFromXp,
} from '../game/progressionConstants.js'

// Ensure the user has a progression row + starter unlocks. Called after sign-in.
export async function ensureProgression(userId) {
  if (!userId) return
  const { data: existing } = await supabase
    .from('progression')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return

  await supabase.from('progression').insert({
    user_id: userId, level: 1, xp: 0, coins: 0,
  })
  const rows = STARTER_CHARACTERS.map(c => ({
    user_id: userId, character_id: c, method: 'starter',
  }))
  await supabase.from('character_unlocks').insert(rows)
}

export async function loadProgression(userId) {
  if (!userId) return null
  const [prog, unlocks, mastery] = await Promise.all([
    supabase.from('progression').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('character_unlocks').select('character_id, method, unlocked_at').eq('user_id', userId),
    supabase.from('character_mastery').select('*').eq('user_id', userId),
  ])
  return {
    progression: prog.data || null,
    unlocked: new Set((unlocks.data || []).map(r => r.character_id)),
    mastery: (mastery.data || []).reduce((acc, r) => {
      acc[r.character_id] = { level: r.level, xp: r.xp, wins: r.wins, matches: r.matches }
      return acc
    }, {}),
  }
}

export function isCharacterUnlocked(unlocked, characterId) {
  return !!unlocked && unlocked.has(characterId)
}

// Returns { unlocked, method, requirement } describing why a character is or is not owned.
export function characterUnlockInfo(unlocked, characterId, level) {
  if (unlocked && unlocked.has(characterId)) return { unlocked: true }
  const levelReq = CHARACTER_LEVEL_UNLOCKS[characterId]
  if (levelReq && level >= levelReq) return { unlocked: false, ready: true, kind: 'level', at: levelReq }
  if (levelReq) return { unlocked: false, kind: 'level', at: levelReq }
  return { unlocked: false, kind: 'coins', price: CHARACTER_COIN_PRICE }
}

// Award XP + coins based on match summary. Returns { levels: newLevels[], unlocked: [charIds] }.
export async function awardMatchRewards(userId, prevProgress, summary) {
  if (!userId) return { newLevel: null, unlocked: [] }
  const events = [] // {reason, xp, coins}

  // Base rewards
  if (summary.won) events.push({ reason: 'match_win',  xp: XP_REWARDS.MATCH_WIN,  coins: COIN_REWARDS.MATCH_WIN })
  else             events.push({ reason: 'match_loss', xp: XP_REWARDS.MATCH_LOSS, coins: COIN_REWARDS.MATCH_LOSS })

  if (summary.hits)    events.push({ reason: 'hits',   xp: summary.hits    * XP_REWARDS.HIT,   coins: 0 })
  if (summary.catches) events.push({ reason: 'catches',xp: summary.catches * XP_REWARDS.CATCH, coins: 0 })
  if (summary.kos)     events.push({ reason: 'kos',    xp: summary.kos     * XP_REWARDS.KO,    coins: 0 })
  if (summary.roundWins) events.push({ reason: 'round_wins', xp: summary.roundWins * XP_REWARDS.ROUND_WIN, coins: summary.roundWins * COIN_REWARDS.ROUND_WIN })

  return _postRewards(userId, prevProgress, events, summary.character)
}

export async function awardLadderRewards(userId, prevProgress, summary) {
  if (!userId) return { newLevel: null, unlocked: [] }
  const events = []
  if (summary.cleared) events.push({ reason: 'ladder_clear', xp: XP_REWARDS.LADDER_CLEAR, coins: COIN_REWARDS.LADDER_CLEAR })
  else                 events.push({ reason: 'ladder_fail',  xp: XP_REWARDS.LADDER_FAIL,  coins: COIN_REWARDS.LADDER_FAIL })
  if (summary.fightsWon) events.push({ reason: 'ladder_fights', xp: summary.fightsWon * XP_REWARDS.LADDER_FIGHT_WIN, coins: summary.fightsWon * COIN_REWARDS.LADDER_FIGHT_WIN })
  return _postRewards(userId, prevProgress, events, summary.character)
}

async function _postRewards(userId, prevProgress, events, characterId) {
  const gainedXp   = events.reduce((s, e) => s + (e.xp || 0), 0)
  const gainedCoin = events.reduce((s, e) => s + (e.coins || 0), 0)
  const prev = prevProgress || { level: 1, xp: 0, coins: 0 }

  const newXp    = prev.xp + gainedXp
  let   newLevel = levelFromXp(newXp)
  if (newLevel > MAX_LEVEL) newLevel = MAX_LEVEL
  const levelUps = Math.max(0, newLevel - prev.level)
  const levelUpCoins = levelUps * COIN_REWARDS.LEVEL_UP_BONUS
  const newCoins = prev.coins + gainedCoin + levelUpCoins

  // Persist audit rows
  const rows = events.map(e => ({ user_id: userId, reason: e.reason, xp: e.xp, coins: e.coins || 0 }))
  if (levelUpCoins > 0) rows.push({ user_id: userId, reason: 'level_up_bonus', xp: 0, coins: levelUpCoins, metadata: { levels: levelUps } })
  if (rows.length) await supabase.from('xp_events').insert(rows)

  await supabase.from('progression').upsert({
    user_id: userId, level: newLevel, xp: newXp, coins: newCoins,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Character mastery — always tick "played". Add win bonus if won.
  if (characterId) {
    const { data: cur } = await supabase.from('character_mastery')
      .select('*').eq('user_id', userId).eq('character_id', characterId).maybeSingle()
    const won = events.some(e => e.reason === 'match_win' || e.reason === 'ladder_clear')
    const gain = CHARACTER_MASTERY_REWARDS.MATCH_PLAY + (won ? CHARACTER_MASTERY_REWARDS.MATCH_WIN : 0)
    const nextXp = (cur?.xp || 0) + gain
    await supabase.from('character_mastery').upsert({
      user_id: userId, character_id: characterId,
      level: cur?.level || 1, xp: nextXp,
      wins:    (cur?.wins    || 0) + (won ? 1 : 0),
      matches: (cur?.matches || 0) + 1,
    }, { onConflict: 'user_id,character_id' })
  }

  // Grant any level-based character unlocks the user just crossed.
  const grantedCharIds = []
  for (const [charId, reqLevel] of Object.entries(CHARACTER_LEVEL_UNLOCKS)) {
    if (prev.level < reqLevel && newLevel >= reqLevel) grantedCharIds.push(charId)
  }
  if (grantedCharIds.length) {
    await supabase.from('character_unlocks').upsert(
      grantedCharIds.map(c => ({ user_id: userId, character_id: c, method: 'level' })),
      { onConflict: 'user_id,character_id' }
    )
  }

  return {
    gainedXp, gainedCoin: gainedCoin + levelUpCoins,
    prevLevel: prev.level, newLevel,
    prevXp: prev.xp, newXp,
    unlocked: grantedCharIds,
  }
}

// Buy a character with coins. Returns { ok, error, newCoins }.
export async function buyCharacterWithCoins(userId, characterId, currentCoins) {
  if (!userId) return { ok: false, error: 'not signed in' }
  if (CHARACTER_LEVEL_UNLOCKS[characterId] === undefined && !isKnownCharacter(characterId)) {
    return { ok: false, error: 'unknown character' }
  }
  if (currentCoins < CHARACTER_COIN_PRICE) return { ok: false, error: 'not enough coins' }

  const newCoins = currentCoins - CHARACTER_COIN_PRICE
  const { error: upErr } = await supabase.from('progression')
    .update({ coins: newCoins, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (upErr) return { ok: false, error: upErr.message }

  const { error: unlErr } = await supabase.from('character_unlocks').upsert(
    { user_id: userId, character_id: characterId, method: 'coins' },
    { onConflict: 'user_id,character_id' }
  )
  if (unlErr) return { ok: false, error: unlErr.message }

  await supabase.from('xp_events').insert({
    user_id: userId, reason: 'spend_coins',
    xp: 0, coins: -CHARACTER_COIN_PRICE,
    metadata: { character_id: characterId },
  })

  return { ok: true, newCoins }
}

function isKnownCharacter(id) {
  return ['blaze', 'nova', 'tank', 'ghost', 'crusher', 'striker'].includes(id)
}
