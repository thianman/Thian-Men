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

    // POST /matches?type=1v1|2v2 — create a new match room
    if (url.pathname === '/matches' && request.method === 'POST') {
      const type = url.searchParams.get('type') === '2v2' ? '2v2' : '1v1'
      const code = newRoomCode()
      // Pre-warm the DO with its type so first join knows the capacity.
      const id = env.MATCHES.idFromName(code)
      const stub = env.MATCHES.get(id)
      await stub.fetch(new Request(`https://internal/setup?type=${type}`))
      return json({ code, type })
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
