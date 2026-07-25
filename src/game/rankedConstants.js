// Ranked tuning constants.

export const CURRENT_SEASON = 1
export const PLACEMENT_MATCHES = 5
export const STARTING_MMR = 1000

// MMR change per match. Placement matches don't lose MMR; wins during
// placement give a bigger boost.
export const MMR_WIN_BASE = 20
export const MMR_LOSS_BASE = 20
export const PLACEMENT_WIN_BONUS = 25

// Tier thresholds — MMR floor for each tier.
export const TIERS = [
  { key: 'bronze',   name: 'Bronze',   floor: 0,    color: '#a16207' },
  { key: 'silver',   name: 'Silver',   floor: 1000, color: '#94a3b8' },
  { key: 'gold',     name: 'Gold',     floor: 1200, color: '#facc15' },
  { key: 'platinum', name: 'Platinum', floor: 1400, color: '#67e8f9' },
  { key: 'diamond',  name: 'Diamond',  floor: 1600, color: '#c4b5fd' },
  { key: 'master',   name: 'Master',   floor: 1800, color: '#f472b6' },
]

export function tierFromMmr(mmr) {
  let out = TIERS[0]
  for (const t of TIERS) if (mmr >= t.floor) out = t
  return out
}

// Sliding matchmaking band: grows with time waiting so a player isn't
// stuck forever if the queue is thin.
export function matchmakingBand(secondsWaiting) {
  if (secondsWaiting < 20) return 100
  if (secondsWaiting < 45) return 250
  if (secondsWaiting < 90) return 500
  return 99999
}
