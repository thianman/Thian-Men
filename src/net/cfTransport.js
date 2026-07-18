// Cloudflare Workers / Durable Object transport.
// Talks to the Worker at SERVER_URL: POST /matches to create, WS to /ws/:code.
import { TransportBase } from './transport.js'

// Filled in by env or fallback to the deployed default.
const SERVER_URL =
  import.meta.env.VITE_GAME_SERVER_URL ||
  'https://thian-men-game.thianraiden.workers.dev'

function wsBase() {
  return SERVER_URL.replace(/^http/, 'ws')
}

export class CloudflareTransport extends TransportBase {
  constructor({ name = 'Player', userId = null, country = 'ZZ', avatarUrl = null } = {}) {
    super()
    this.name = name
    this.userId = userId
    this.country = country
    this.avatarUrl = avatarUrl
    this.ws = null
    this.code = null
    this.pingTimer = null
    this.lastPingAt = 0
    this.lastRtt = 0
  }

  static get serverUrl() { return SERVER_URL }

  static async fetchLeaderboard({ character = null, limit = 20 } = {}) {
    const p = new URLSearchParams({ limit: String(limit) })
    if (character) p.set('character', character)
    const res = await fetch(`${SERVER_URL}/leaderboard?${p}`)
    if (!res.ok) return []
    const { rows } = await res.json()
    return rows || []
  }

  async createMatch(type = '1v1') {
    const t = ['1v1', '2v2', 'ladder'].includes(type) ? type : '1v1'
    const res = await fetch(`${SERVER_URL}/matches?type=${t}`, { method: 'POST' })
    if (!res.ok) throw new Error(`create failed: ${res.status}`)
    const { code } = await res.json()
    return code
  }

  async join(code) {
    this.code = code.toUpperCase()
    const params = new URLSearchParams({ name: this.name })
    if (this.userId)   params.set('uid', this.userId)
    if (this.country)  params.set('country', this.country)
    if (this.avatarUrl) params.set('avatar', this.avatarUrl)
    const url = `${wsBase()}/ws/${encodeURIComponent(this.code)}?${params}`
    this.ws = new WebSocket(url)

    this.ws.addEventListener('open', () => {
      this._reconnectAttempts = 0
      this.emit('connected')
      this.pingTimer = setInterval(() => this._ping(), 2000)
    })

    this.ws.addEventListener('message', (e) => {
      let msg = null
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.t === 'pong') { this.lastRtt = Date.now() - msg.at; this.emit('pong', this.lastRtt); return }
      this.emit(msg.t, msg)
    })

    this.ws.addEventListener('close', () => {
      const wasIntentional = this._closedByUser
      this._cleanup()
      if (wasIntentional || !this.code) { this.emit('disconnected'); return }
      // Auto-reconnect attempt: helps mobile browsers that suspend background
      // tabs and drop the socket. Try a few times with backoff.
      this._reconnectAttempts = (this._reconnectAttempts || 0) + 1
      if (this._reconnectAttempts > 5) { this.emit('disconnected'); return }
      this.emit('reconnecting', this._reconnectAttempts)
      const delay = Math.min(4000, 500 * this._reconnectAttempts)
      setTimeout(() => {
        if (this._closedByUser) return
        this.join(this.code).catch(() => this.emit('disconnected'))
      }, delay)
    })

    this.ws.addEventListener('error', (e) => this.emit('error', e))
    return this.code
  }

  sendInput(input) {
    this._send({ t: 'input', input })
  }

  setCharacter(character) { this._send({ t: 'setCharacter', character }) }
  setMap(mapId)           { this._send({ t: 'setMap', mapId }) }
  ready()                 { this._send({ t: 'ready' }) }
  unready()               { this._send({ t: 'unready' }) }
  rematch()               { this._send({ t: 'rematch' }) }

  disconnect() {
    this._closedByUser = true
    if (this.ws) { try { this.ws.close() } catch {} }
    this._cleanup()
  }

  _send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return
    this.ws.send(JSON.stringify(obj))
  }

  _ping() {
    this.lastPingAt = Date.now()
    this._send({ t: 'ping', at: this.lastPingAt })
  }

  _cleanup() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    this.ws = null
  }
}
