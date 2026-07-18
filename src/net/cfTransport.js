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
  constructor({ name = 'Player' } = {}) {
    super()
    this.name = name
    this.ws = null
    this.code = null
    this.pingTimer = null
    this.lastPingAt = 0
    this.lastRtt = 0
  }

  static get serverUrl() { return SERVER_URL }

  async createMatch() {
    const res = await fetch(`${SERVER_URL}/matches`, { method: 'POST' })
    if (!res.ok) throw new Error(`create failed: ${res.status}`)
    const { code } = await res.json()
    return code
  }

  async join(code) {
    this.code = code.toUpperCase()
    const url = `${wsBase()}/ws/${encodeURIComponent(this.code)}?name=${encodeURIComponent(this.name)}`
    this.ws = new WebSocket(url)

    this.ws.addEventListener('open', () => {
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
      this._cleanup()
      this.emit('disconnected')
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
