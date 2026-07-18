// Durable Object: one per active match. Handles lobby (character/map picks),
// then runs the full authoritative game engine, broadcasts state.
// Supports 1v1 (2 players) and 2v2 (4 players).
import { GameEngine } from './gameEngine.js'
import { CHARACTERS, MAPS } from './gameConstants.js'

const TICK_MS = 33 // ~30 Hz

// Slot layout: side + slot index. Fill order alternates sides so a 1v1
// naturally uses just [left0, right0] and 2v2 uses all four.
const SLOT_LAYOUT = [
  { side: 'left',  slot: 0 },
  { side: 'right', slot: 0 },
  { side: 'left',  slot: 1 },
  { side: 'right', slot: 1 },
]

export class MatchRoom {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.sessions = new Map() // ws -> meta
    this.engine = null
    this.tickTimer = null
    this.type = '1v1' // '1v1' | '2v2'
    this.slots = this._emptySlots(this.type)
    this.mapId = 'arena'
    this.state_ = 'lobby' // 'lobby' | 'match' | 'ended'
  }

  _emptySlots(type) {
    const count = type === '2v2' ? 4 : 2
    return SLOT_LAYOUT.slice(0, count).map((s, i) => ({
      slotIndex: i, side: s.side, sideSlot: s.slot,
      character: null, ready: false, name: null, playerId: null,
    }))
  }

  _capacity() { return this.slots.length }

  async fetch(request) {
    const url = new URL(request.url)

    // Internal setup endpoint used at match creation to configure type before
    // any player joins.
    if (url.pathname === '/setup' && this.sessions.size === 0) {
      const type = url.searchParams.get('type') === '2v2' ? '2v2' : '1v1'
      this.type = type
      this.slots = this._emptySlots(type)
      return new Response(JSON.stringify({ ok: true, type }))
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }
    const name = (url.searchParams.get('name') || 'Player').slice(0, 24)

    const pair = new WebSocketPair()
    const [clientWs, serverWs] = Object.values(pair)
    serverWs.accept()

    // Find first free slot
    const slot = this.slots.find(s => !s.playerId)
    if (!slot) {
      serverWs.send(JSON.stringify({ t: 'error', reason: 'full' }))
      try { serverWs.close(1000, 'full') } catch {}
      return new Response(null, { status: 101, webSocket: clientWs })
    }

    const playerId = crypto.randomUUID().slice(0, 8)
    const isHost = this.sessions.size === 0
    slot.playerId = playerId
    slot.name = name
    const meta = { playerId, slotIndex: slot.slotIndex, isHost, name }
    this.sessions.set(serverWs, meta)

    serverWs.send(JSON.stringify({
      t: 'welcome',
      playerId, isHost, name,
      side: slot.side, sideSlot: slot.sideSlot,
      type: this.type,
    }))
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
    const slot = this.slots.find(s => s.slotIndex === meta.slotIndex)
    if (slot) { slot.playerId = null; slot.name = null; slot.character = null; slot.ready = false }
    if (this.state_ === 'match') this._endMatchAsForfeit(meta.playerId, slot?.side)
    this._broadcast({ t: 'roster', players: this._roster() })
    this._broadcastLobby()
    if (this.sessions.size === 0) this._stopTick()
  }

  _handleMessage(ws, meta, evt) {
    let msg = null
    try { msg = JSON.parse(evt.data) } catch { return }
    if (msg.t === 'ping') { try { ws.send(JSON.stringify({ t: 'pong', at: msg.at })) } catch {}; return }

    if (this.state_ === 'lobby') {
      const slot = this.slots.find(s => s.slotIndex === meta.slotIndex)
      if (!slot) return
      if (msg.t === 'setCharacter' && CHARACTERS.some(c => c.id === msg.character)) {
        slot.character = msg.character
        slot.ready = false
        this._broadcastLobby()
      } else if (msg.t === 'setMap' && meta.isHost && MAPS.some(m => m.id === msg.mapId)) {
        this.mapId = msg.mapId
        this._broadcastLobby()
      } else if (msg.t === 'ready' && slot.character) {
        slot.ready = true
        this._broadcastLobby()
        if (this.slots.every(s => s.playerId && s.ready)) this._startMatch()
      } else if (msg.t === 'unready') {
        slot.ready = false
        this._broadcastLobby()
      }
      return
    }

    if (this.state_ === 'match' && msg.t === 'input' && this.engine) {
      this.engine.applyInput(meta.playerId, msg.input)
    }

    if (this.state_ === 'ended' && msg.t === 'rematch') {
      for (const s of this.slots) s.ready = false
      this.state_ = 'lobby'
      this.engine = null
      this._broadcastLobby()
    }
  }

  _startMatch() {
    if (this.slots.some(s => !s.character || !s.playerId)) return
    this.engine = new GameEngine({
      mapId: this.mapId,
      type: this.type,
      playersMeta: this.slots.map(s => ({
        playerId: s.playerId, side: s.side, sideSlot: s.sideSlot,
        character: s.character, name: s.name || 'Player',
      })),
    })
    this.state_ = 'match'
    this._broadcast({ t: 'matchStart', mapId: this.mapId, type: this.type })
    this._startTick()
  }

  _endMatchAsForfeit(quittingPlayerId, quittingSide) {
    if (!this.engine) return
    // If everyone on the quitter's side left, other side wins
    const remainingSameSide = this.slots.filter(s => s.side === quittingSide && s.playerId).length
    if (remainingSameSide === 0) {
      const winner = quittingSide === 'left' ? 'right' : 'left'
      this.engine.matchWinnerSide = winner
      this.engine.phase = 'matchEnd'
      this._broadcast({ t: 'matchEnd', winner, forfeit: true })
      this.state_ = 'ended'
      this._stopTick()
    }
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
    return this.slots
      .filter(s => s.playerId)
      .map(s => ({ playerId: s.playerId, side: s.side, sideSlot: s.sideSlot, name: s.name }))
  }

  _broadcastLobby() {
    this._broadcast({
      t: 'lobby',
      type: this.type,
      mapId: this.mapId,
      state: this.state_,
      slots: this.slots.map(s => ({
        slotIndex: s.slotIndex, side: s.side, sideSlot: s.sideSlot,
        character: s.character, ready: s.ready, name: s.name, filled: !!s.playerId,
      })),
    })
  }

  _broadcast(msg) {
    const data = JSON.stringify(msg)
    for (const ws of this.sessions.keys()) { try { ws.send(data) } catch {} }
  }
}
