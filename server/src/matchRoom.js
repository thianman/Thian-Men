// Durable Object: handles 1v1, 2v2, and ladder rooms.
// - Lobby (character/map picks) → match → ended, with rematch.
// - Ladder mode: solo player vs. server-controlled CPU opponents,
//   6 fights back to back, cumulative time tracked and submitted.
import { GameEngine } from './gameEngine.js'
import { CHARACTERS, MAPS } from './gameConstants.js'
import { ServerAi } from './serverAi.js'
import { buildLadderOpponents, submitLadderRun } from './ladder.js'

const TICK_MS = 33

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
    this.sessions = new Map()
    this.engine = null
    this.tickTimer = null
    this.type = '1v1'
    this.slots = this._emptySlots('1v1')
    this.mapId = 'arena'
    this.state_ = 'lobby'
    this.ai = null // ServerAi for CPU opponent (ladder only)
    this.ladder = null // { opponents, current, startedAt, cumulativeMs, playerProfile }
  }

  _emptySlots(type) {
    const count = type === '2v2' ? 4 : (type === 'ladder' ? 1 : 2)
    return SLOT_LAYOUT.slice(0, count).map((s, i) => ({
      slotIndex: i, side: s.side, sideSlot: s.slot,
      character: null, ready: false, name: null, playerId: null,
    }))
  }

  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/setup' && this.sessions.size === 0) {
      const type = url.searchParams.get('type')
      const t = ['1v1', '2v2', 'ladder'].includes(type) ? type : '1v1'
      this.type = t
      this.slots = this._emptySlots(t)
      return new Response(JSON.stringify({ ok: true, type: t }))
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 })
    }

    const name = (url.searchParams.get('name') || 'Player').slice(0, 24)
    const userId = url.searchParams.get('uid') || null
    const country = (url.searchParams.get('country') || 'ZZ').slice(0, 2).toUpperCase()

    const pair = new WebSocketPair()
    const [clientWs, serverWs] = Object.values(pair)
    serverWs.accept()

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
    const meta = { playerId, slotIndex: slot.slotIndex, isHost, name, userId, country }
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
        if (this.slots.every(s => s.playerId && s.ready)) {
          if (this.type === 'ladder') this._startLadder(meta)
          else this._startMatch()
        }
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
      this.ladder = null
      this.ai = null
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

  _startLadder(meta) {
    if (this.type !== 'ladder') return
    const p1Slot = this.slots[0]
    if (!p1Slot.character || !p1Slot.playerId) return
    const opponents = buildLadderOpponents(p1Slot.character)
    this.ladder = {
      opponents, current: 0,
      startedAt: Date.now(),
      cumulativeMs: 0,
      playerProfile: {
        userId: meta.userId, displayName: p1Slot.name, country: meta.country,
        character: p1Slot.character,
      },
    }
    this._broadcast({ t: 'ladderInfo', opponents })
    this._startLadderFight()
  }

  _startLadderFight() {
    const { opponents, current, playerProfile } = this.ladder
    const opp = opponents[current]
    const opponentChar = CHARACTERS.find(c => c.id === opp.character)
    // Alternate maps each fight for variety
    const map = MAPS[current % MAPS.length]
    this.mapId = map.id
    this.engine = new GameEngine({
      mapId: map.id, type: '1v1',
      playersMeta: [
        { playerId: this.slots[0].playerId, side: 'left', sideSlot: 0,
          character: playerProfile.character, name: playerProfile.displayName },
        { playerId: 'cpu-' + current, side: 'right', sideSlot: 0,
          character: opp.character, name: opponentChar?.id.toUpperCase() || 'CPU', isCPU: true },
      ],
    })
    // Ladder fights are shorter — first to 3 rounds wins
    this.engine.roundsToWin = 3
    this.ai = new ServerAi(opp.difficulty)
    this.state_ = 'match'
    this._broadcast({
      t: 'ladderFightStart',
      index: current, total: opponents.length,
      opponent: { character: opp.character, difficulty: opp.difficulty },
      mapId: map.id,
    })
    this._startTick()
  }

  _endMatchAsForfeit(quittingPlayerId, quittingSide) {
    if (!this.engine) return
    if (this.type === 'ladder') {
      this._broadcast({ t: 'ladderEnd', ok: false, reason: 'quit' })
      this.state_ = 'ended'
      this._stopTick()
      return
    }
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
      // AI provides input for CPU players
      if (this.ai) {
        for (const p of this.engine.players) {
          if (p.isCPU && p.hp > 0) {
            const input = this.ai.step(this.engine, p)
            this.engine.applyInput(p.playerId, input)
          }
        }
      }
      this.engine.tick(TICK_MS)
      this._broadcast({ t: 'state', snap: this.engine.snapshot() })

      if (this.engine.phase === 'matchEnd') {
        if (this.type === 'ladder') this._onLadderFightEnd()
        else if (this.state_ !== 'ended') {
          this.state_ = 'ended'
          this._broadcast({ t: 'matchEnd', winner: this.engine.matchWinnerSide, forfeit: false })
        }
      }
    }, TICK_MS)
  }

  async _onLadderFightEnd() {
    if (!this.ladder) return
    const winner = this.engine.matchWinnerSide
    // Freeze this tick loop while we decide next step
    this._stopTick()

    if (winner !== 'left') {
      // Player lost the ladder
      this.ladder.cumulativeMs = Date.now() - this.ladder.startedAt
      this._broadcast({ t: 'ladderEnd', ok: false, reason: 'lost',
        atFight: this.ladder.current, totalFights: this.ladder.opponents.length,
        timeMs: this.ladder.cumulativeMs })
      this.state_ = 'ended'
      return
    }

    this.ladder.current++
    if (this.ladder.current >= this.ladder.opponents.length) {
      // Completed ladder — submit
      this.ladder.cumulativeMs = Date.now() - this.ladder.startedAt
      const { userId, displayName, country, character } = this.ladder.playerProfile
      const timeMs = this.ladder.cumulativeMs
      const submitResult = await submitLadderRun(this.env, {
        userId, displayName, country, character, timeMs,
      })
      this._broadcast({
        t: 'ladderEnd', ok: true,
        timeMs, character,
        submitted: !!submitResult.ok,
        submitError: submitResult.error || null,
      })
      this.state_ = 'ended'
      return
    }

    // Advance to next fight after a short pause
    this._broadcast({ t: 'ladderFightWon', nextIndex: this.ladder.current, elapsedMs: Date.now() - this.ladder.startedAt })
    setTimeout(() => {
      if (this.state_ === 'match' || this.state_ === 'ended') return
      this._startLadderFight()
    }, 2500)
    this.state_ = 'match' // will re-enter tick loop in _startLadderFight
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
