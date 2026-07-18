// Durable Object: one per active match. Handles lobby (character/map picks),
// then runs the full authoritative game engine, broadcasts state.
import { GameEngine } from './gameEngine.js'
import { CHARACTERS, MAPS } from './gameConstants.js'

const TICK_MS = 33 // ~30 Hz

export class MatchRoom {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.sessions = new Map() // ws -> meta
    this.engine = null
    this.tickTimer = null
    this.lobby = {
      // per-side picks
      left:  { character: null, ready: false, name: null },
      right: { character: null, ready: false, name: null },
      mapId: 'arena', // host picks
    }
    this.state_ = 'lobby' // 'lobby' | 'match' | 'ended'
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

    if (this.sessions.size >= 2) {
      serverWs.send(JSON.stringify({ t: 'error', reason: 'full' }))
      try { serverWs.close(1000, 'full') } catch {}
      return new Response(null, { status: 101, webSocket: clientWs })
    }

    const playerId = crypto.randomUUID().slice(0, 8)
    const isHost = this.sessions.size === 0
    const side = isHost ? 'left' : 'right'
    const meta = { playerId, side, name, isHost }
    this.sessions.set(serverWs, meta)
    this.lobby[side].name = name

    serverWs.send(JSON.stringify({ t: 'welcome', playerId, side, isHost, name }))
    this._broadcast({ t: 'roster', players: this._roster() })
    this._broadcastLobby()

    serverWs.addEventListener('message', (evt) => this._handleMessage(serverWs, meta, evt))
    const cleanup = () => this._cleanup(serverWs, meta)
    serverWs.addEventListener('close', cleanup)
    serverWs.addEventListener('error', cleanup)

    return new Response(null, { status: 101, webSocket: clientWs })
  }

  _cleanup(ws, meta) {
    if (!this.sessions.has(ws)) return
    this.sessions.delete(ws)
    this.lobby[meta.side] = { character: null, ready: false, name: null }
    if (this.state_ === 'match') this._endMatchAsForfeit(meta.side)
    this._broadcast({ t: 'roster', players: this._roster() })
    this._broadcastLobby()
    if (this.sessions.size === 0) this._stopTick()
  }

  _handleMessage(ws, meta, evt) {
    let msg = null
    try { msg = JSON.parse(evt.data) } catch { return }
    if (msg.t === 'ping') { try { ws.send(JSON.stringify({ t: 'pong', at: msg.at })) } catch {}; return }

    if (this.state_ === 'lobby') {
      if (msg.t === 'setCharacter' && CHARACTERS.some(c => c.id === msg.character)) {
        this.lobby[meta.side].character = msg.character
        this.lobby[meta.side].ready = false
        this._broadcastLobby()
      } else if (msg.t === 'setMap' && meta.isHost && MAPS.some(m => m.id === msg.mapId)) {
        this.lobby.mapId = msg.mapId
        this._broadcastLobby()
      } else if (msg.t === 'ready' && this.lobby[meta.side].character) {
        this.lobby[meta.side].ready = true
        this._broadcastLobby()
        if (this.lobby.left.ready && this.lobby.right.ready && this.sessions.size === 2) {
          this._startMatch()
        }
      } else if (msg.t === 'unready') {
        this.lobby[meta.side].ready = false
        this._broadcastLobby()
      }
      return
    }

    if (this.state_ === 'match' && msg.t === 'input' && this.engine) {
      this.engine.applyInput(meta.side, msg.input)
    }

    if (this.state_ === 'ended' && msg.t === 'rematch') {
      this.lobby.left.ready = false; this.lobby.right.ready = false
      this.state_ = 'lobby'
      this.engine = null
      this._broadcastLobby()
    }
  }

  _startMatch() {
    if (!this.lobby.left.character || !this.lobby.right.character) return
    this.engine = new GameEngine({
      mapId: this.lobby.mapId,
      playersMeta: [
        { side: 'left',  character: this.lobby.left.character,  name: this.lobby.left.name  || 'P1' },
        { side: 'right', character: this.lobby.right.character, name: this.lobby.right.name || 'P2' },
      ],
    })
    this.state_ = 'match'
    this._broadcast({ t: 'matchStart', mapId: this.lobby.mapId })
    this._startTick()
  }

  _endMatchAsForfeit(quittingSide) {
    if (!this.engine) return
    this.engine.matchWinnerSide = quittingSide === 'left' ? 'right' : 'left'
    this.engine.phase = 'matchEnd'
    this._broadcast({ t: 'matchEnd', winner: this.engine.matchWinnerSide, forfeit: true })
    this.state_ = 'ended'
    this._stopTick()
  }

  _startTick() {
    if (this.tickTimer) return
    this.tickTimer = setInterval(() => {
      if (!this.engine) return
      this.engine.tick(TICK_MS)
      this._broadcast({ t: 'state', snap: this.engine.snapshot() })
      if (this.engine.phase === 'matchEnd' && this.state_ !== 'ended') {
        this.state_ = 'ended'
        this._broadcast({ t: 'matchEnd', winner: this.engine.matchWinnerSide, forfeit: false })
      }
    }, TICK_MS)
  }

  _stopTick() {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null }
  }

  _roster() {
    return Array.from(this.sessions.values()).map(m => ({
      playerId: m.playerId, side: m.side, name: m.name, isHost: m.isHost,
    }))
  }

  _broadcast(msg) {
    const data = JSON.stringify(msg)
    for (const ws of this.sessions.keys()) { try { ws.send(data) } catch {} }
  }

  _broadcastLobby() {
    this._broadcast({
      t: 'lobby',
      left:  this.lobby.left,
      right: this.lobby.right,
      mapId: this.lobby.mapId,
      state: this.state_,
    })
  }
}
