// Daily challenge tuning. Three challenges are rolled per UTC day per user.
// Each entry describes how it's generated and rewarded.

import { CHARACTERS } from './constants.js'

// Pool of possible daily challenges. `weight` biases the roll; `mkTarget`
// returns { target, meta } and `desc` renders human-readable text.
export const CHALLENGE_POOL = [
  {
    id: 'win_matches',
    label: 'Take the W',
    weight: 3,
    mkTarget: () => ({ target: pick([2, 3]), meta: null }),
    desc: (row) => `Win ${row.target} matches`,
    reward: (row) => ({ xp: 60 * row.target, coins: 40 * row.target }),
    // Match summary → progress delta
    matchDelta: (summary) => (summary.won ? 1 : 0),
  },
  {
    id: 'ko_players',
    label: 'Bodybagger',
    weight: 3,
    mkTarget: () => ({ target: pick([3, 5, 8]), meta: null }),
    desc: (row) => `KO ${row.target} opponents`,
    reward: (row) => ({ xp: 25 * row.target, coins: 15 * row.target }),
    matchDelta: (summary) => summary.kos || summary.hits || 0,
  },
  {
    id: 'catch_balls',
    label: 'Iron Hands',
    weight: 2,
    mkTarget: () => ({ target: pick([2, 4, 6]), meta: null }),
    desc: (row) => `Catch ${row.target} throws`,
    reward: (row) => ({ xp: 30 * row.target, coins: 20 * row.target }),
    matchDelta: (summary) => summary.catches || 0,
  },
  {
    id: 'play_as_x',
    label: 'Signature Fighter',
    weight: 2,
    mkTarget: () => {
      const c = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
      return { target: pick([2, 3]), meta: { character_id: c.id, character_name: c.name } }
    },
    desc: (row) => `Play ${row.target} matches as ${row.meta?.character_name || row.meta?.character_id}`,
    reward: (row) => ({ xp: 50 * row.target, coins: 35 * row.target }),
    matchDelta: (summary, row) => (summary.character === row.meta?.character_id ? 1 : 0),
  },
  {
    id: 'round_wins',
    label: 'Round Robin',
    weight: 2,
    mkTarget: () => ({ target: pick([4, 6, 8]), meta: null }),
    desc: (row) => `Win ${row.target} rounds`,
    reward: (row) => ({ xp: 20 * row.target, coins: 12 * row.target }),
    matchDelta: (summary) => summary.roundWins || 0,
  },
]

export function findChallenge(id) {
  return CHALLENGE_POOL.find(c => c.id === id) || null
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// Roll N unique challenges for a user. Deterministic-ish (unique by id) but
// otherwise random weighting.
export function rollDailyChallenges(count = 3) {
  const bag = []
  for (const c of CHALLENGE_POOL) for (let i = 0; i < c.weight; i++) bag.push(c)
  const chosen = []
  const used = new Set()
  while (chosen.length < count && bag.length) {
    const idx = Math.floor(Math.random() * bag.length)
    const c = bag[idx]
    if (!used.has(c.id)) {
      used.add(c.id)
      const { target, meta } = c.mkTarget()
      const reward = c.reward({ target })
      chosen.push({
        challenge_id: c.id,
        target,
        progress: 0,
        claimed: false,
        reward_xp: reward.xp,
        reward_coins: reward.coins,
        meta,
      })
    }
    // Remove all copies of the pooled entry to force uniqueness
    for (let j = bag.length - 1; j >= 0; j--) if (bag[j].id === c.id) bag.splice(j, 1)
  }
  return chosen
}

// === Login streak tuning ===
// day 1 → 50 coins, day 2 → 75, day 3 → 100, day 7 → 250, plateau after 30 → 500
export function streakReward(streak) {
  const coins = Math.min(500, 25 + streak * 25)
  const xp = Math.min(300, 20 + streak * 15)
  const isMilestone = streak === 7 || streak === 14 || streak === 30
  return { coins, xp, isMilestone }
}

// UTC day key (yyyy-mm-dd) — server + client agree on the same day boundary
export function todayUtcKey() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}
