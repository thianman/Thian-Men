// Server-side AI, adapted from the client's ai.js. Reads game state
// via the engine and returns an input frame each tick.
const CFG = {
  easy:       { moveChance: 0.4, throwChance: 0.008, throwRange: 900, charge: [0.3, 0.7], catchChance: 0.0,  reactTicks: 12 },
  medium:     { moveChance: 0.7, throwChance: 0.020, throwRange: 700, charge: [0.5, 0.8], catchChance: 0.4,  reactTicks: 7  },
  hard:       { moveChance: 0.9, throwChance: 0.050, throwRange: 600, charge: [0.7, 0.9], catchChance: 0.7,  reactTicks: 4  },
  impossible: { moveChance: 1.0, throwChance: 0.090, throwRange: 900, charge: [0.85, 1.0], catchChance: 0.95, reactTicks: 2 },
}

export class ServerAi {
  constructor(difficulty = 'medium') {
    this.cfg = CFG[difficulty] || CFG.medium
    this.state = { chargeTarget: 0.7, catchCd: 0, throwHold: false }
  }

  step(engine, cpu) {
    if (cpu.hp <= 0) return {}
    const cfg = this.cfg
    const enemySide = cpu.side === 'left' ? 'right' : 'left'
    const enemies = engine.players.filter(p => p.side === enemySide && p.hp > 0)
    if (!enemies.length) return {}
    const target = enemies.reduce((a, b) => Math.abs(a.x - cpu.x) < Math.abs(b.x - cpu.x) ? a : b)

    // Incoming ball
    let incoming = null, incDist = Infinity
    for (const b of engine.balls) {
      if (!b.live) continue
      if (b.thrownBy === cpu.side) continue
      const dx = b.x - (cpu.x + cpu.w/2)
      const dy = b.y - (cpu.y + cpu.h/2)
      const d = Math.hypot(dx, dy)
      const toward = (cpu.x + cpu.w/2 - b.x) * b.vx > 0
      if (toward && d < incDist) { incDist = d; incoming = b }
    }

    const input = { left: false, right: false, jump: false, duck: false, throwHeld: false, catchPressed: false }

    // Movement — hold roughly 350-500 away from target
    if (Math.random() < cfg.moveChance) {
      const targetX = target.x + target.w/2
      const myX = cpu.x + cpu.w/2
      const preferred = enemySide === 'right' ? targetX - 420 : targetX + 420
      if (myX < preferred - 20) input.right = true
      else if (myX > preferred + 20) input.left = true
    }

    // Face target
    cpu.facing = target.x > cpu.x ? 1 : -1

    // Dodge incoming
    if (incoming && incDist < 200 && cpu.onGround && Math.random() < 0.6) {
      if (incoming.y > cpu.y + cpu.h * 0.5) input.jump = true
      else input.duck = true
    }

    // Catch
    if (this.state.catchCd > 0) this.state.catchCd--
    if (incoming && incDist < 80 && this.state.catchCd <= 0) {
      if (Math.random() < cfg.catchChance) input.catchPressed = true
      this.state.catchCd = 8
    }

    // Pick up + charge + release throw
    if (!cpu.holdingBallId) {
      let idle = null, id = Infinity
      for (const b of engine.balls) {
        if (b.held || b.live) continue
        const d = Math.abs(b.x - (cpu.x + cpu.w/2))
        if (d < id) { id = d; idle = b }
      }
      if (idle && id < 80) input.throwHeld = true
      else if (idle && id < 300 && Math.random() < 0.4) {
        if (idle.x < cpu.x) input.left = true; else input.right = true
      }
      this.state.throwHold = false
    } else {
      if (!this.state.throwHold) {
        this.state.chargeTarget = cfg.charge[0] + Math.random() * (cfg.charge[1] - cfg.charge[0])
        this.state.throwHold = true
      }
      const dx = Math.abs((target.x + target.w/2) - (cpu.x + cpu.w/2))
      const inRange = dx < cfg.throwRange
      if (inRange && Math.random() < cfg.throwChance * 60) {
        input.throwHeld = cpu.chargeVal < this.state.chargeTarget
        if (!input.throwHeld) this.state.throwHold = false
      } else {
        input.throwHeld = true
      }
    }

    return input
  }
}
