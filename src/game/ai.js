import { THROW_CHARGE_MS } from './constants.js'

const CFG = {
  easy:       { moveChance: 0.4, throwChance: 0.008, throwRange: 900, charge: [0.3, 0.7], catchChance: 0.0,  reactMs: 400 },
  medium:     { moveChance: 0.7, throwChance: 0.02,  throwRange: 700, charge: [0.5, 0.8], catchChance: 0.4,  reactMs: 220 },
  hard:       { moveChance: 0.9, throwChance: 0.05,  throwRange: 600, charge: [0.7, 0.9], catchChance: 0.7,  reactMs: 120 },
  impossible: { moveChance: 1.0, throwChance: 0.09,  throwRange: 900, charge: [0.85, 1.0], catchChance: 0.95, reactMs: 60 },
}

export function makeAIController(difficulty = 'medium') {
  const cfg = CFG[difficulty] || CFG.medium
  const memo = new WeakMap()
  return function step(cpu, state, dtMs) {
    if (cpu.hp <= 0) return { left:false, right:false, jump:false, duck:false, throw:false, catchPressed:false }
    let mem = memo.get(cpu)
    if (!mem) { mem = { chargeTarget: 0.7, reactCd: 0, throwHold: false, catchCd: 0 }; memo.set(cpu, mem) }
    mem.reactCd -= dtMs; mem.catchCd -= dtMs

    // Find target (nearest enemy)
    const enemySide = cpu.side === 'left' ? 'right' : 'left'
    const enemies = state.players.filter(p => p.side === enemySide && p.hp > 0)
    if (enemies.length === 0) return {}
    const target = enemies.reduce((a, b) =>
      Math.abs(a.x - cpu.x) < Math.abs(b.x - cpu.x) ? a : b)

    // Nearest incoming ball
    let incoming = null, incDist = Infinity
    for (const b of state.balls) {
      if (!b.live) continue
      if (b.thrownBy === cpu.side) continue
      const dx = b.x - (cpu.x + cpu.w/2)
      const dy = b.y - (cpu.y + cpu.h/2)
      const d = Math.hypot(dx, dy)
      // Ball moving toward cpu
      const toward = (cpu.x + cpu.w/2 - b.x) * b.vx > 0
      if (toward && d < incDist) { incDist = d; incoming = b }
    }

    const input = { left:false, right:false, jump:false, duck:false, throw:false, catchPressed:false }

    // Find the nearest idle ball on the CPU's own half — CPUs can't cross the
    // center line, so any ball on the enemy side is unreachable.
    const midX = 640
    let idleBall = null, idleDist = Infinity
    for (const b of state.balls) {
      if (b.held || b.live) continue
      const onMySide = cpu.side === 'right' ? b.x >= midX - 8 : b.x <= midX + 8
      if (!onMySide) continue
      const d = Math.abs(b.x - (cpu.x + cpu.w/2))
      if (d < idleDist) { idleDist = d; idleBall = b }
    }

    // Movement
    if (Math.random() < cfg.moveChance) {
      const myX = cpu.x + cpu.w/2
      // If we don't have a ball and there's an idle one on our side, prefer
      // walking toward it — no distance cap, so back-wall balls get fetched.
      if (!cpu.holdingBall && idleBall) {
        if (idleBall.x < myX - 8) input.left = true
        else if (idleBall.x > myX + 8) input.right = true
      } else {
        // Keep firing distance ~ 350-500 from target
        const targetX = target.x + target.w/2
        const preferred = enemySide === 'right' ? targetX - 420 : targetX + 420
        if (myX < preferred - 20) input.right = true
        else if (myX > preferred + 20) input.left = true
      }
    } else if (difficulty === 'easy') {
      // wander
      if (Math.random() < 0.5) input.left = true; else input.right = true
    }

    // Face target
    cpu.facing = target.x > cpu.x ? 1 : -1

    // Jumping - dodge or chase
    if (incoming && incDist < 200 && cpu.onGround && Math.random() < 0.6 && difficulty !== 'easy') {
      // Duck or jump depending on ball height
      if (incoming.y > cpu.y + cpu.h * 0.5) input.jump = true
      else input.duck = true
    }

    // Dash (hard/impossible only): if a ball is close and cd ready, fire an edge press away from it
    if (incoming && incDist < 160 && cpu.dashCd <= 0 && (difficulty === 'hard' || difficulty === 'impossible')) {
      const chance = difficulty === 'impossible' ? 0.5 : 0.25
      if (Math.random() < chance) {
        const dir = incoming.x > cpu.x + cpu.w / 2 ? -1 : 1
        if (dir < 0) { input.leftPressed = true; cpu.lastTap = { dir: -1, ms: performance.now() - 100 } }
        else         { input.rightPressed = true; cpu.lastTap = { dir: 1,  ms: performance.now() - 100 } }
      }
    }

    // Catch attempt
    if (incoming && incDist < 80 && mem.catchCd <= 0) {
      if (Math.random() < cfg.catchChance) input.catchPressed = true
      mem.catchCd = 250
    }

    // Throw logic - pickup, hold, release
    if (!cpu.holdingBall) {
      if (idleBall && idleDist < 80) input.throw = true
      mem.throwHold = false
    } else {
      // Charge and release
      if (!mem.throwHold) {
        mem.chargeTarget = cfg.charge[0] + Math.random() * (cfg.charge[1] - cfg.charge[0])
        mem.throwHold = true
      }
      const dx = Math.abs((target.x + target.w/2) - (cpu.x + cpu.w/2))
      const inRange = dx < cfg.throwRange
      if (inRange && Math.random() < cfg.throwChance * 60) {
        // Simulate hold; release when charge >= target
        input.throw = cpu.chargeVal < mem.chargeTarget
        if (!input.throw) mem.throwHold = false
      } else {
        input.throw = true
      }
    }

    return input
  }
}
