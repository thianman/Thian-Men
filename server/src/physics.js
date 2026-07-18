// Minimal server-authoritative physics for Phase 2:
// two players, movement + jump + gravity + arena bounds.
// Full game logic (balls, throws, rounds) lands in Phase 3.

const ARENA_W  = 1280
const ARENA_H  = 720
const FLOOR_Y  = 640
const PLAYER_W = 56
const PLAYER_H = 96
const GRAVITY  = 0.9
const MOVE_SPEED = 5
const JUMP_V   = -22

export class PhysicsWorld {
  constructor() {
    this.players = new Map()
    this.tickCount = 0
  }

  addPlayer(id, side, name) {
    const x = side === 'left' ? 200 : ARENA_W - 200 - PLAYER_W
    this.players.set(id, {
      id, side, name,
      x, y: FLOOR_Y - PLAYER_H,
      vx: 0, vy: 0, onGround: true,
      input: { left: false, right: false, jump: false },
      jumpHeld: false,
    })
  }

  removePlayer(id) { this.players.delete(id) }

  applyInput(id, input) {
    const p = this.players.get(id)
    if (!p) return
    p.input = input || { left: false, right: false, jump: false }
  }

  tick(dtMs) {
    this.tickCount++
    for (const p of this.players.values()) {
      p.vx = p.input.left ? -MOVE_SPEED : p.input.right ? MOVE_SPEED : 0
      const jumpEdge = !!p.input.jump && !p.jumpHeld
      p.jumpHeld = !!p.input.jump
      if (jumpEdge && p.onGround) { p.vy = JUMP_V; p.onGround = false }
      if (!p.onGround) p.vy += GRAVITY
      p.x += p.vx; p.y += p.vy
      if (p.x < 0) p.x = 0
      if (p.x + PLAYER_W > ARENA_W) p.x = ARENA_W - PLAYER_W
      if (p.y + PLAYER_H >= FLOOR_Y) {
        p.y = FLOOR_Y - PLAYER_H
        p.vy = 0
        p.onGround = true
      }
    }
  }

  snapshot() {
    return {
      tick: this.tickCount,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id, side: p.side, name: p.name,
        x: Math.round(p.x), y: Math.round(p.y),
        onGround: p.onGround,
      })),
    }
  }
}
