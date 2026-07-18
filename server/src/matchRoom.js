// Durable Object: one per active match. Runs the authoritative physics
// tick, accepts inputs from connected players, broadcasts state.
import { PhysicsWorld } from './physics.js'

const TICK_MS = 33 // ~30 Hz

export class MatchRoom {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.sessions = new Map() // WebSocket -> meta
    this.world = new PhysicsWorld()
    this.tickTimer = null
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }
    const url = new URL(request.url)
    const name = (url.searchParams.get('name') || 'Player').slice(0, 24)

    const pair = new WebSocketPair()
    const [clientWs, serverWs] = Object.values(pair)
    serverWs.accept()

    // Reject if full
    if (this.sessions.size >= 2) {
      serverWs.send(JSON.stringify({ t: 'error', reason: 'full' }))
      try { serverWs.close(1000, 'full') } catch {}
      return new Response(null, { status: 101, webSocket: clientWs })
    }

    const playerId = crypto.randomUUID().slice(0, 8)
    const side = this.sessions.size === 0 ? 'left' : 'right'
    const meta = { playerId, side, name }
    this.sessions.set(serverWs, meta)
    this.world.addPlayer(playerId, side, name)

    serverWs.send(JSON.stringify({
      t: 'welcome',
      playerId, side, name,
      opponents: this.rosterSnapshot().filter(r => r.playerId !== playerId),
    }))
    this.broadcast({ t: 'roster', players: this.rosterSnapshot() })

    serverWs.addEventListener('message', (evt) => {
      let msg = null
      try { msg = JSON.parse(evt.data) } catch { return }
      if (msg.t === 'input') this.world.applyInput(playerId, msg.input)
      else if (msg.t === 'ping') { try { serverWs.send(JSON.stringify({ t: 'pong', at: msg.at })) } catch {} }
    })

    const cleanup = () => {
      if (!this.sessions.has(serverWs)) return
      this.sessions.delete(serverWs)
      this.world.removePlayer(playerId)
      this.broadcast({ t: 'roster', players: this.rosterSnapshot() })
      if (this.sessions.size === 0) this.stopTick()
    }
    serverWs.addEventListener('close', cleanup)
    serverWs.addEventListener('error', cleanup)

    // Start tick when we have at least one player. The tick keeps running
    // even for a lone player so they can move around while waiting.
    if (!this.tickTimer && this.sessions.size >= 1) this.startTick()

    return new Response(null, { status: 101, webSocket: clientWs })
  }

  rosterSnapshot() {
    return Array.from(this.sessions.values()).map(m => ({
      playerId: m.playerId, side: m.side, name: m.name,
    }))
  }

  broadcast(msg) {
    const data = JSON.stringify(msg)
    for (const ws of this.sessions.keys()) {
      try { ws.send(data) } catch {}
    }
  }

  startTick() {
    this.tickTimer = setInterval(() => {
      this.world.tick(TICK_MS)
      this.broadcast({ t: 'state', ...this.world.snapshot() })
    }, TICK_MS)
  }

  stopTick() {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null }
  }
}
