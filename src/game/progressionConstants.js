// Progression tuning. Single source of truth used by both server writes and
// client display. Every reward and unlock rule is centralised here.

// Characters everyone starts with.
export const STARTER_CHARACTERS = ['blaze', 'nova', 'tank']

// Level thresholds for the play-based unlocks. If a level isn't in this map,
// the character is unlocked purely by paying coins.
export const CHARACTER_LEVEL_UNLOCKS = {
  ghost: 5,
  crusher: 10,
  striker: 15,
}

// Coin price to buy any non-starter character before hitting its level.
export const CHARACTER_COIN_PRICE = 1500

// XP + coin rewards for match events.
export const XP_REWARDS = {
  MATCH_WIN:      50,
  MATCH_LOSS:     10,
  ROUND_WIN:      20,
  KO:             15,      // per kill
  CATCH:          5,
  HIT:            3,
  LADDER_FIGHT_WIN: 30,
  LADDER_CLEAR:   200,
  LADDER_FAIL:    20,
}

export const COIN_REWARDS = {
  MATCH_WIN:      50,
  MATCH_LOSS:     10,
  ROUND_WIN:      5,
  LADDER_FIGHT_WIN: 20,
  LADDER_CLEAR:   500,
  LADDER_FAIL:    30,
  LEVEL_UP_BONUS: 100,
}

// Account level XP curve. Total XP required to be AT `level`:
//   xpToLevel(1) = 0
//   xpToLevel(2) = 200
//   xpToLevel(3) = 200 + 300 = 500
//   xpToLevel(n) = sum from k=2 to n of 100*k = 50*n*(n+1) - 100
export function xpToLevel(level) {
  if (level <= 1) return 0
  return 50 * level * (level + 1) - 100
}
export function xpForNextLevel(currentLevel) {
  return xpToLevel(currentLevel + 1) - xpToLevel(currentLevel)
}
export function levelFromXp(xp) {
  let lvl = 1
  while (xpToLevel(lvl + 1) <= xp && lvl < 50) lvl++
  return lvl
}
export const MAX_LEVEL = 50

// Per-character mastery XP curve (flatter, gated at 20).
export const MAX_MASTERY = 20
export function masteryXpForNext(masteryLevel) {
  return 400 + masteryLevel * 100 // 500 for L1→L2, 600 for L2→L3, ...
}
export function masteryLevelFromXp(xp) {
  let lvl = 1, need = masteryXpForNext(1), spent = 0
  while (spent + need <= xp && lvl < MAX_MASTERY) {
    spent += need; lvl++; need = masteryXpForNext(lvl)
  }
  return { level: lvl, xpInLevel: xp - spent, xpToNext: need }
}

export const CHARACTER_MASTERY_REWARDS = {
  MATCH_PLAY: 25,  // just playing a match with this character
  MATCH_WIN:  50,  // extra for winning
}
