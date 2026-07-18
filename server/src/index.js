// Worker entry point: creates matches and routes WebSocket connections
// to their per-match Durable Object.
import { MatchRoom } from './matchRoom.js'
export { MatchRoom }

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

// Short, human-friendly room codes: 6 chars, no ambiguous glyphs.
function newRoomCode() {
  const alpha = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  for (const b of buf) code += alpha[b % alpha.length]
  return code
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    // POST /matches?type=1v1|2v2|ladder — create a new match room
    if (url.pathname === '/matches' && request.method === 'POST') {
      const raw = url.searchParams.get('type')
      const type = ['1v1', '2v2', 'ladder'].includes(raw) ? raw : '1v1'
      const code = newRoomCode()
      const id = env.MATCHES.idFromName(code)
      const stub = env.MATCHES.get(id)
      await stub.fetch(new Request(`https://internal/setup?type=${type}`))
      return json({ code, type })
    }

    // GET /leaderboard?character=blaze&limit=20 — top runs
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const character = url.searchParams.get('character')
      const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20', 10))
      let q = `${env.SUPABASE_URL}/rest/v1/ladder_records?select=id,display_name,country,character,time_ms,created_at&order=time_ms.asc&limit=${limit}`
      if (character) q += `&character=eq.${encodeURIComponent(character)}`
      const res = await fetch(q, { headers: { apikey: env.SUPABASE_ANON || env.SUPABASE_SERVICE_ROLE || '' } })
      const rows = await res.json().catch(() => [])
      return json({ rows: Array.isArray(rows) ? rows : [] })
    }

    // /ws/:code — upgrade to WebSocket, route to the DO
    if (url.pathname.startsWith('/ws/')) {
      const code = url.pathname.slice('/ws/'.length).toUpperCase()
      if (!code || code.length < 4) return json({ error: 'bad code' }, 400)
      const id = env.MATCHES.idFromName(code)
      const stub = env.MATCHES.get(id)
      return stub.fetch(request)
    }

    // Health check / root
    return json({ ok: true, name: 'thian-men', version: '0.2.0' })
  },
}
