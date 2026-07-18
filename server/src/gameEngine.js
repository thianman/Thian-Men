import {
  ARENA_W, ARENA_H, GRAVITY, FLOOR_Y, PLAYER_W, PLAYER_H, DUCK_H,
  BALL_R, MAX_HP, CATCH_RANGE, THROW_CHARGE_MS, CHARACTERS, MAPS,
} from './gameConstants.js'

const ROUNDS_PER_MATCH = 5 // first to this many round wins takes the match

function spawnX(side, sideSlot) {
  if (side === 'left')  return sideSlot === 0 ? 180 : 320
  return sideSlot === 0 ? ARENA_W - 180 - PLAYER_W : ARENA_W - 320 - PLAYER_W
}
function makePlayer({ playerId, side, sideSlot = 0, character, name }) {
  const char = CHARACTERS.find(c => c.id === character) || CHARACTERS[0]
  const startX = spawnX(side, sideSlot)
  return {
    playerId, side, sideSlot, name, character: char.id, char,
    x: startX, y: FLOOR_Y - PLAYER_H,
    vx: 0, vy: 0,
    w: PLAYER_W, h: PLAYER_H,
    facing: side === 'left' ? 1 : -1,
    onGround: true, ducking: false,
    hp: MAX_HP,
    holdingBallId: null,
    charging: false, chargeStartTick: 0, chargeVal: 0,
    hitFlashUntil: 0,
    jumpHeld: false, doubleJumped: false,
    input: emptyInput(),
    dashUntil: 0, dashCd: 0, dashDir: 0,
    lastTap: { dir: 0, tick: -1e9 },
    prevInput: emptyInput(),
  }
}

function emptyInput() { return { left: false, right: false, jump: false, duck: false, throwHeld: false, catchPressed: false } }

function makeBall(id, x, y) {
  return { id, x, y, vx: 0, vy: 0, r: BALL_R, held: false, ownerSide: null, live: false, thrownBy: null, chargeAtThrow: 0, uncatchable: false }
}

export class GameEngine {
  constructor({ mapId, playersMeta, type = '1v1' }) {
    this.map = MAPS.find(m => m.id === mapId) || MAPS[0]
    this.tickCount = 0
    this.tickMs = 33
    this.type = type
    this.numBalls = type === '2v2' ? 5 : 3
    this.roundsToWin = type === '2v2' ? 7 : ROUNDS_PER_MATCH
    this.players = []
    for (const meta of playersMeta) {
      this.players.push(makePlayer(meta))
    }
    this.balls = []
    const spacing = ARENA_W / (this.numBalls + 1)
    for (let i = 1; i <= this.numBalls; i++) this.balls.push(makeBall('b' + i, spacing * i, FLOOR_Y - BALL_R))
    this.phase = 'countdown'          // 'countdown' | 'play' | 'roundEnd' | 'matchEnd'
    this.phaseTimerMs = 2200
    this.countdown = 3
    this.round = 1
    this.roundsLeft = 0
    this.roundsRight = 0
    this.winnerSide = null
    this.matchWinnerSide = null
    this.events = [] // recent events for client SFX
  }

  applyInput(playerId, input) {
    const p = this.players.find(pl => pl.playerId === playerId)
    if (!p) return
    p.input = { ...emptyInput(), ...input }
  }

  now() { return this.tickCount * this.tickMs }

  tick(dtMs) {
    this.events = []

    if (this.phase !== 'play') {
      this.phaseTimerMs -= dtMs
      if (this.phase === 'countdown') this.countdown = Math.ceil(this.phaseTimerMs / 700)
      if (this.phaseTimerMs <= 0) this._advancePhase()
      if (this.phase !== 'play') { this.tickCount++; return }
    }

    // Apply inputs to players
    for (const p of this.players) this._processPlayerInput(p, dtMs)

    // Physics
    for (const p of this.players) {
      if (p.hp <= 0) continue
      p.x += p.vx
      if (p.x < 0) p.x = 0
      if (p.x + p.w > ARENA_W) p.x = ARENA_W - p.w
      if (!p.onGround) p.vy += GRAVITY
      p.y += p.vy
      p.h = p.ducking ? DUCK_H : PLAYER_H
      if (p.y + p.h >= FLOOR_Y) { p.y = FLOOR_Y - p.h; p.vy = 0; p.onGround = true }
      else {
        let landed = false
        for (const pl of this.map.platforms) {
          if (p.vy < 0) continue
          const px = p.x + p.w/2
          if (px < pl.x || px > pl.x + pl.w) continue
          const feetPrev = p.y + p.h - p.vy
          const feetNow = p.y + p.h
          if (feetPrev <= pl.y && feetNow >= pl.y) {
            p.y = pl.y - p.h; p.vy = 0; p.onGround = true; landed = true; break
          }
        }
        if (!landed) p.onGround = false
      }
      if (p.dashCd > 0) p.dashCd -= dtMs
    }

    // Balls
    for (const b of this.balls) {
      if (b.held) {
        const owner = this.players.find(pl => pl.holdingBallId === b.id)
        if (owner) { b.x = owner.x + owner.w/2 + owner.facing * 20; b.y = owner.y + 30 }
        continue
      }
      if (b.live) {
        b.vy += GRAVITY * 0.6
        b.x += b.vx; b.y += b.vy
        if (b.x < BALL_R) { b.x = BALL_R; b.vx = -b.vx * 0.5 }
        if (b.x > ARENA_W - BALL_R) { b.x = ARENA_W - BALL_R; b.vx = -b.vx * 0.5 }
        if (b.y + b.r >= FLOOR_Y) { b.y = FLOOR_Y - b.r; b.vy *= -0.4; b.vx *= 0.7 }
        if (Math.abs(b.vx) < 0.5 && Math.abs(b.vy) < 1 && b.y >= FLOOR_Y - b.r - 1) { b.live = false; b.vx = 0; b.vy = 0 }

        for (const p of this.players) {
          if (p.hp <= 0) continue
          if (b.thrownBy === p.side) continue
          if (p.dashUntil > this.now()) continue
          if (rectCircle(p.x, p.y, p.w, p.h, b.x, b.y, b.r)) { this._hitPlayer(p, b); break }
        }
      } else {
        b.vx *= 0.9; b.x += b.vx
        if (b.x < BALL_R) b.x = BALL_R
        if (b.x > ARENA_W - BALL_R) b.x = ARENA_W - BALL_R
        b.y = FLOOR_Y - b.r
      }
    }

    // Win conditions
    const leftAlive  = this.players.some(p => p.side === 'left'  && p.hp > 0)
    const rightAlive = this.players.some(p => p.side === 'right' && p.hp > 0)
    if (!leftAlive || !rightAlive) {
      const winner = leftAlive ? 'left' : 'right'
      this.winnerSide = winner
      this.events.push({ t: 'roundEnd', winner })
      if (winner === 'left') this.roundsLeft++; else this.roundsRight++
      if (this.roundsLeft >= this.roundsToWin || this.roundsRight >= this.roundsToWin) {
        this.matchWinnerSide = this.roundsLeft > this.roundsRight ? 'left' : 'right'
        this.phase = 'matchEnd'; this.phaseTimerMs = 6000
        this.events.push({ t: 'matchEnd', winner: this.matchWinnerSide })
      } else {
        this.phase = 'roundEnd'; this.phaseTimerMs = 1600
      }
    }

    this.tickCount++
  }

  _processPlayerInput(p, dtMs) {
    if (p.hp <= 0) return
    const input = p.input || emptyInput()
    const perk = p.char.perk || {}
    const speed = p.char.speed
    const dashCdBase = 900 * (perk.dashCdMul || 1)
    const dashSpeed = (speed + 6) * (perk.dashPowerMul || 1)

    // Direction edge detection (for dash)
    const leftPressed  = input.left  && !p.prevInput.left
    const rightPressed = input.right && !p.prevInput.right
    if (leftPressed || rightPressed) {
      const dir = leftPressed ? -1 : 1
      if (p.lastTap.dir === dir && (this.tickCount - p.lastTap.tick) * this.tickMs < 260 && p.dashCd <= 0) {
        p.dashUntil = this.now() + 220
        p.dashCd = dashCdBase
        p.dashDir = dir
        p.facing = dir
      }
      p.lastTap = { dir, tick: this.tickCount }
    }

    // Movement / dash
    if (p.dashUntil > this.now()) {
      p.vx = p.dashDir * dashSpeed
    } else if (input.left)  { p.vx = -speed; p.facing = -1 }
    else if (input.right)   { p.vx = speed;  p.facing = 1 }
    else                    { p.vx = 0 }

    // Duck / fast-fall
    p.ducking = !!input.duck && p.onGround
    if (input.duck && !p.onGround && p.vy < 12) p.vy += 2.2

    // Jump (edge)
    const jumpEdge = !!input.jump && !p.jumpHeld
    p.jumpHeld = !!input.jump
    if (jumpEdge && p.onGround && !p.ducking) {
      p.vy = -p.char.jump; p.onGround = false; p.doubleJumped = false
      this.events.push({ t: 'jump', side: p.side })
    } else if (jumpEdge && !p.onGround && perk.doubleJump && !p.doubleJumped) {
      p.vy = -p.char.jump * 0.85; p.doubleJumped = true
      this.events.push({ t: 'jump', side: p.side })
    }

    // Pick up nearby idle ball
    if (input.throwHeld && !p.holdingBallId && this._hasNearbyBall(p)) this._grabNearestBall(p)

    // Charge / release throw
    if (p.holdingBallId) {
      const chargeSpeed = perk.chargeSpeedMul || 1
      if (input.throwHeld) {
        if (!p.charging) { p.charging = true; p.chargeStartTick = this.tickCount }
        const elapsedMs = (this.tickCount - p.chargeStartTick) * this.tickMs * chargeSpeed
        p.chargeVal = Math.min(1, elapsedMs / THROW_CHARGE_MS)
      } else if (p.charging) {
        this._throwBall(p)
        p.charging = false; p.chargeVal = 0
      }
    }

    // Catch attempt (edge)
    if (input.catchPressed && !p.prevInput.catchPressed) this._attemptCatch(p)

    p.prevInput = { ...input }
  }

  _hasNearbyBall(p) {
    return this.balls.some(b => !b.held && !b.live && dist(p.x + p.w/2, p.y + p.h/2, b.x, b.y) < 70)
  }
  _grabNearestBall(p) {
    let best = null, bd = 1e9
    for (const b of this.balls) {
      if (b.held || b.live) continue
      const d = dist(p.x + p.w/2, p.y + p.h/2, b.x, b.y)
      if (d < bd && d < 90) { bd = d; best = b }
    }
    if (best) { best.held = true; best.ownerSide = p.side; p.holdingBallId = best.id }
  }
  _throwBall(p) {
    const b = this.balls.find(x => x.id === p.holdingBallId); if (!b) return
    const perk = p.char.perk || {}
    const power = 6 + 18 * p.chargeVal
    b.vx = p.facing * power * p.char.throwMul
    b.vy = -4 - 8 * p.chargeVal
    b.x = p.x + p.w/2 + p.facing * (p.w/2 + BALL_R + 2)
    b.y = p.y + 30
    b.held = false; b.ownerSide = null; b.live = true
    b.thrownBy = p.side; b.chargeAtThrow = p.chargeVal
    b.uncatchable = !!(perk.uncatchableAt && p.chargeVal >= perk.uncatchableAt)
    p.holdingBallId = null
    this.events.push({ t: 'throw', side: p.side, charge: p.chargeVal, uncatchable: b.uncatchable })
  }
  _attemptCatch(p) {
    const perk = p.char.perk || {}
    for (const b of this.balls) {
      if (!b.live) continue
      if (b.thrownBy === p.side) continue
      if (b.uncatchable) continue
      const d = dist(p.x + p.w/2, p.y + p.h/2, b.x, b.y)
      const baseWindow = CATCH_RANGE * (1 - 0.4 * (b.chargeAtThrow || 0.5))
      const window = baseWindow * (perk.catchWindowMul || 1)
      if (d < window) {
        b.live = false; b.vx = 0; b.vy = 0
        b.held = true; b.ownerSide = p.side
        p.holdingBallId = b.id
        this.events.push({ t: 'catch', side: p.side })
        return
      }
    }
  }
  _hitPlayer(p, b) {
    p.hp -= 1
    p.hitFlashUntil = this.now() + 260
    b.live = false; b.vx = 0; b.vy = 0; b.y = FLOOR_Y - b.r
    this.events.push({ t: 'hit', side: p.side, ko: p.hp <= 0 })
  }

  _advancePhase() {
    if (this.phase === 'roundEnd') {
      this.round++
      this._resetRound()
      this.phase = 'countdown'; this.phaseTimerMs = 2200; this.countdown = 3
    } else if (this.phase === 'countdown') {
      this.phase = 'play'
    }
    // matchEnd: stays until room decides
  }

  _resetRound() {
    for (const p of this.players) {
      p.hp = MAX_HP
      p.x = spawnX(p.side, p.sideSlot)
      p.y = FLOOR_Y - PLAYER_H
      p.vx = 0; p.vy = 0; p.holdingBallId = null; p.charging = false; p.chargeVal = 0
      p.hitFlashUntil = 0; p.ducking = false; p.onGround = true
      p.doubleJumped = false; p.dashUntil = 0; p.dashCd = 0
    }
    this.balls.forEach((b, i) => {
      const spacing = ARENA_W / (this.balls.length + 1)
      b.x = spacing * (i + 1); b.y = FLOOR_Y - b.r
      b.vx = 0; b.vy = 0; b.held = false; b.ownerSide = null; b.live = false; b.thrownBy = null; b.uncatchable = false
    })
  }

  snapshot() {
    return {
      tick: this.tickCount,
      phase: this.phase,
      countdown: this.countdown,
      round: this.round,
      roundsLeft: this.roundsLeft, roundsRight: this.roundsRight, roundsToWin: this.roundsToWin,
      winnerSide: this.winnerSide,
      matchWinnerSide: this.matchWinnerSide,
      mapId: this.map.id,
      players: this.players.map(p => ({
        playerId: p.playerId, side: p.side, sideSlot: p.sideSlot,
        name: p.name, character: p.character,
        x: Math.round(p.x), y: Math.round(p.y),
        facing: p.facing, ducking: p.ducking, onGround: p.onGround,
        hp: p.hp, charging: p.charging, chargeVal: p.chargeVal,
        hitFlash: Math.max(0, p.hitFlashUntil - this.now()),
        holdingBall: !!p.holdingBallId,
        dashing: p.dashUntil > this.now(),
      })),
      balls: this.balls.map(b => ({
        id: b.id,
        x: Math.round(b.x), y: Math.round(b.y),
        live: b.live, held: b.held, ownerSide: b.ownerSide,
        thrownBy: b.thrownBy, uncatchable: b.uncatchable,
      })),
      events: this.events,
    }
  }
}

function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
  const nx = Math.max(rx, Math.min(cx, rx + rw))
  const ny = Math.max(ry, Math.min(cy, ry + rh))
  const dx = cx - nx, dy = cy - ny
  return dx*dx + dy*dy <= cr*cr
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) }
