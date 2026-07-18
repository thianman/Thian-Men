// Abstract transport interface. Implementations (cfTransport, later others)
// conform to this shape so the rest of the game code stays swappable.
//
// events:
//   'connected'         — WebSocket handshake done
//   'welcome'  (msg)    — server assigned side / playerId
//   'roster'   (msg)    — roster changed (join/leave)
//   'state'    (msg)    — physics snapshot
//   'disconnected'      — socket closed
//   'error'    (err)    — any error
//   'pong'     (rttMs)  — ping round trip

export class TransportBase {
  constructor() { this._listeners = new Map() }
  on(event, cb) {
    let arr = this._listeners.get(event)
    if (!arr) { arr = []; this._listeners.set(event, arr) }
    arr.push(cb)
    return () => this.off(event, cb)
  }
  off(event, cb) {
    const arr = this._listeners.get(event); if (!arr) return
    const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1)
  }
  emit(event, ...args) {
    const arr = this._listeners.get(event); if (!arr) return
    for (const cb of arr.slice()) { try { cb(...args) } catch (e) { console.error(e) } }
  }
  // Subclass overrides
  async createMatch()  { throw new Error('not implemented') }
  async join(code)     { throw new Error('not implemented') }
  sendInput(input)     { throw new Error('not implemented') }
  disconnect()         { throw new Error('not implemented') }
}
