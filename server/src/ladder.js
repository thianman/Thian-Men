// Ladder run configuration and Supabase submission.
import { CHARACTERS } from './gameConstants.js'

// Rising difficulty: two easy, two medium, one hard, one impossible.
export const LADDER_DIFFICULTIES = ['easy', 'easy', 'medium', 'medium', 'hard', 'impossible']

export function buildLadderOpponents(playerCharacter) {
  const pool = CHARACTERS.filter(c => c.id !== playerCharacter).map(c => c.id)
  // Shuffle deterministically-ish
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return LADDER_DIFFICULTIES.map((difficulty, i) => ({
    character: pool[i] || pool[0],
    difficulty,
  }))
}

// Submit a completed ladder run to Supabase. Uses the service-role key
// stored as an env secret in the Worker, so RLS is bypassed and we can
// trust the time (server measured it).
export async function submitLadderRun(env, { userId, displayName, country, character, timeMs }) {
  const url  = env.SUPABASE_URL
  const key  = env.SUPABASE_SERVICE_ROLE
  if (!url || !key) return { error: 'not configured' }

  // Anti-cheat sanity check: 30s minimum, 60min maximum.
  if (timeMs < 30_000 || timeMs > 60 * 60 * 1000) return { error: 'time out of range' }

  const res = await fetch(`${url}/rest/v1/ladder_records`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId || null,
      display_name: displayName || 'Anonymous',
      country: country || 'ZZ',
      character,
      time_ms: Math.round(timeMs),
    }),
  })
  if (!res.ok) return { error: `submit failed: ${res.status} ${await res.text().catch(() => '')}` }
  return { ok: true }
}
