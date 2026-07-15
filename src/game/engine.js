import {
  ARENA_W, ARENA_H, GRAVITY, FLOOR_Y, PLAYER_W, PLAYER_H, DUCK_H,
  BALL_R, MAX_HP, CATCH_RANGE, THROW_CHARGE_MS, CHARACTERS,
} from './constants.js'
import { sfx } from './sfx.js'

export function makePlayer({ side, character, isCPU, kind }) {
  const char = CHARACTERS.find(c => c.id === character) || CHARACTERS[0]
  const startX = side === 'left' ? 180 : ARENA_W - 180 - PLAYER_W
  return {
    side, kind, isCPU: !!isCPU,
    char, name: char.name,
    x: startX, y: FLOOR_Y - PLAYER_H,
    vx: 0, vy: 0,
    w: PLAYER_W, h: PLAYER_H,
    facing: side === 'left' ? 1 : -1,
    onGround: true, ducking: false,
    hp: MAX_HP,
    hasBall: false,
    holdingBall: null,
    charging: false, chargeStart: 0, chargeVal: 0,
    catchWindow: 0, // ms remaining where catch attempted
    hitFlash: 0,
    // AI state
    aiTimer: 0, aiIntent: 'idle',
    lastTap: { dir: 0, ms: -1e9 },
    dashActive: 0,
    dashCd: 0,
    dashDir: 0,
    afterImages: [],
    doubleJumped: false,
  }
}

export function makeBall(x, y, vx = 0, vy = 0) {
  return { x, y, vx, vy, r: BALL_R, held: false, ownerSide: null, live: false, thrownBy: null, aliveMs: 0 }
}

export function initState({ mode, matchType, map, p1Char, p2Char, difficulty, modifiers }) {
  const mods = new Set(modifiers || [])
  const baseBalls = matchType === '2v2' ? 5 : 3
  const numBalls = mods.has('chaos') ? baseBalls * 2 : baseBalls
  const players = []
  if (matchType === '2v2') {
    players.push(makePlayer({ side: 'left',  kind: 'p1',   character: p1Char }))
    players.push(makePlayer({ side: 'left',  kind: 'p2',   character: p2Char || pickRandom(p1Char) }))
    const cpuA = pickRandom(p1Char)
    const cpuB = pickRandom(cpuA)
    players.push(makePlayer({ side: 'right', kind: 'cpu1', character: cpuA, isCPU: true }))
    players.push(makePlayer({ side: 'right', kind: 'cpu2', character: cpuB, isCPU: true }))
    // spread out
    players[1].x = 320
    players[3].x = ARENA_W - 320 - PLAYER_W
  } else if (mode === '2p') {
    players.push(makePlayer({ side: 'left',  kind: 'p1', character: p1Char }))
    players.push(makePlayer({ side: 'right', kind: 'p2', character: p2Char }))
  } else {
    // 1p vs CPU or practice
    players.push(makePlayer({ side: 'left',  kind: 'p1', character: p1Char }))
    players.push(makePlayer({ side: 'right', kind: 'cpu', character: p2Char, isCPU: true }))
  }
  const balls = []
  const spacing = ARENA_W / (numBalls + 1)
  for (let i = 1; i <= numBalls; i++) balls.push(makeBall(spacing * i, FLOOR_Y - BALL_R))
  return {
    mode, matchType, map, difficulty: difficulty || 'medium',
    players, balls,
    round: 1, set: 1,
    setsP1: 0, setsP2: 0,
    roundsP1: 0, roundsP2: 0,
    roundsPerSet: matchType === '2v2' ? 7 : 5,
    setsToWin: 3,
    phase: 'countdown',
    phaseTimer: 2200,
    countdown: 3,
    winnerSide: null,
    matchWinnerSide: null,
    isPractice: mode === 'practice',
    shake: 0,
    particles: [],
    hitstop: 0,
    koFlash: 0,
    stats: { left: { throws: 0, catches: 0, hits: 0 }, right: { throws: 0, catches: 0, hits: 0 } },
    mods,
    _initApplied: (() => {
      if (mods.has('glass')) players.forEach(p => p.hp = 1)
      return true
    })(),
  }
}

function pickRandom(exclude) {
  const others = CHARACTERS.filter(c => c.id !== exclude)
  return others[Math.floor(Math.random() * others.length)].id
}

export function resetRound(state) {
  const glass = state.mods && state.mods.has('glass')
  state.players.forEach(p => {
    p.hp = glass ? 1 : MAX_HP
    p.x = p.side === 'left' ? (p.kind === 'p2' ? 320 : 180) : (p.kind === 'cpu2' ? ARENA_W - 320 - PLAYER_W : ARENA_W - 180 - PLAYER_W)
    p.y = FLOOR_Y - PLAYER_H
    p.vx = 0; p.vy = 0
    p.hasBall = false; p.holdingBall = null
    p.charging = false; p.chargeVal = 0
    p.hitFlash = 0; p.ducking = false; p.onGround = true
    p.doubleJumped = false; p.dashActive = 0; p.dashCd = 0
  })
  state.balls.forEach((b, i) => {
    const spacing = ARENA_W / (state.balls.length + 1)
    b.x = spacing * (i + 1); b.y = FLOOR_Y - BALL_R
    b.vx = 0; b.vy = 0; b.held = false; b.ownerSide = null; b.live = false; b.thrownBy = null; b.aliveMs = 0
  })
}

function sideAlive(state, side) {
  return state.players.some(p => p.side === side && p.hp > 0)
}

// ---- Input application ----
export function applyInput(player, input, dtMs, state) {
  if (player.hp <= 0) return
  const speed = player.char.speed
  const now = performance.now()

  const perk = (state.mods && state.mods.has('noperks')) ? {} : (player.char.perk || {})
  const dashCdBase = 900 * (perk.dashCdMul || 1)
  const dashSpeed = (speed + 6) * (perk.dashPowerMul || 1)

  // Detect dash: double-tap direction within 260ms
  if (input.leftPressed || input.rightPressed) {
    const dir = input.leftPressed ? -1 : 1
    if (player.lastTap.dir === dir && now - player.lastTap.ms < 260 && player.dashCd <= 0) {
      player.dashActive = 220
      player.dashCd = dashCdBase
      player.dashDir = dir
      player.facing = dir
      sfx.jump()
    }
    player.lastTap = { dir, ms: now }
  }
  if (player.dashCd > 0) player.dashCd -= dtMs
  if (player.dashActive > 0) {
    player.dashActive -= dtMs
    player.vx = player.dashDir * dashSpeed
    player.afterImages.push({ x: player.x, y: player.y, w: player.w, h: player.h, life: 220, color: player.char.color })
  } else if (input.left) { player.vx = -speed; player.facing = -1 }
  else if (input.right) { player.vx = speed; player.facing = 1 }
  else player.vx = 0

  // Age afterimages
  for (const a of player.afterImages) a.life -= dtMs
  player.afterImages = player.afterImages.filter(a => a.life > 0)

  player.ducking = !!input.duck && player.onGround
  const jumpEdge = !!input.jump && !player.jumpHeld
  player.jumpHeld = !!input.jump
  if (jumpEdge && player.onGround && !player.ducking) {
    player.vy = -player.char.jump
    player.onGround = false
    player.doubleJumped = false
    sfx.jump()
  } else if (jumpEdge && !player.onGround && perk.doubleJump && !player.doubleJumped) {
    player.vy = -player.char.jump * 0.85
    player.doubleJumped = true
    sfx.jump()
  }
  // Fast-fall: duck while airborne and rising slowly / falling gives extra downward velocity
  if (input.duck && !player.onGround && player.vy < 12) {
    player.vy += 2.2
  }

  // Charging throw
  if (input.throw && !player.charging && !player.holdingBall && hasNearbyBall(player, state)) {
    // Pick up nearest idle ball
    grabNearestBall(player, state)
  }
  if (player.holdingBall) {
    const chargeSpeed = perk.chargeSpeedMul || 1
    if (input.throw) {
      if (!player.charging) { player.charging = true; player.chargeStart = performance.now() }
      const elapsed = (performance.now() - player.chargeStart) * chargeSpeed
      player.chargeVal = Math.min(1, elapsed / THROW_CHARGE_MS)
    } else if (player.charging) {
      throwBall(player, state)
      player.charging = false; player.chargeVal = 0
    }
  }

  // Catch attempt (edge triggered by caller)
  if (input.catchPressed) attemptCatch(player, state)
}

function hasNearbyBall(player, state) {
  return state.balls.some(b => !b.held && !b.live && dist(player.x + player.w/2, player.y + player.h/2, b.x, b.y) < 70)
}
function grabNearestBall(player, state) {
  let best = null, bd = 1e9
  for (const b of state.balls) {
    if (b.held || b.live) continue
    const d = dist(player.x + player.w/2, player.y + player.h/2, b.x, b.y)
    if (d < bd && d < 90) { bd = d; best = b }
  }
  if (best) {
    best.held = true; best.ownerSide = player.side
    player.holdingBall = best
  }
}

function throwBall(player, state) {
  const b = player.holdingBall; if (!b) return
  const power = 6 + 18 * player.chargeVal
  b.vx = player.facing * power * player.char.throwMul
  b.vy = -4 - 8 * player.chargeVal
  b.x = player.x + player.w/2 + player.facing * (player.w/2 + BALL_R + 2)
  b.y = player.y + 30
  b.held = false; b.ownerSide = null; b.live = true; b.thrownBy = player.side; b.chargeAtThrow = player.chargeVal; b.aliveMs = 0
  b.trail = []
  const perk = (state.mods && state.mods.has('noperks')) ? {} : (player.char.perk || {})
  b.uncatchable = !!(perk.uncatchableAt && player.chargeVal >= perk.uncatchableAt)
  player.holdingBall = null
  state.stats[player.side].throws++
  sfx.throw()
}

function attemptCatch(player, state) {
  const perk = (state.mods && state.mods.has('noperks')) ? {} : (player.char.perk || {})
  for (const b of state.balls) {
    if (!b.live) continue
    if (b.thrownBy === player.side) continue
    if (b.uncatchable) continue
    const d = dist(player.x + player.w/2, player.y + player.h/2, b.x, b.y)
    const baseWindow = CATCH_RANGE * (1 - 0.4 * (b.chargeAtThrow || 0.5))
    const window = baseWindow * (perk.catchWindowMul || 1)
    if (d < window) {
      b.live = false; b.vx = 0; b.vy = 0
      b.held = true; b.ownerSide = player.side
      player.holdingBall = b
      state.stats[player.side].catches++
      sfx.catch()
      return
    }
  }
}

// ---- Main tick ----
export function tick(state, dtMs) {
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dtMs)
  if (state.koFlash > 0) state.koFlash = Math.max(0, state.koFlash - dtMs)
  if (state.hitstop > 0) {
    state.hitstop = Math.max(0, state.hitstop - dtMs)
    return
  }
  // particles
  for (const pt of state.particles) {
    pt.x += pt.vx; pt.y += pt.vy
    pt.vy += 0.4
    pt.life -= dtMs
  }
  state.particles = state.particles.filter(p => p.life > 0)

  if (state.phase !== 'play') {
    state.phaseTimer -= dtMs
    if (state.phase === 'countdown') {
      const remaining = Math.ceil(state.phaseTimer / 700)
      state.countdown = remaining
    }
    if (state.phaseTimer <= 0) advancePhase(state)
    if (state.phase !== 'play') return
  }

  const platforms = (state.mapObj?.platforms) || []
  for (const p of state.players) {
    if (p.hp <= 0) continue
    p.x += p.vx
    if (p.x < 0) p.x = 0
    if (p.x + p.w > ARENA_W) p.x = ARENA_W - p.w

    if (!p.onGround) p.vy += GRAVITY
    p.y += p.vy

    const curH = p.ducking ? DUCK_H : PLAYER_H
    p.h = curH

    // Floor collision
    if (p.y + p.h >= FLOOR_Y) {
      p.y = FLOOR_Y - p.h
      p.vy = 0; p.onGround = true
    } else {
      // Platform collisions (top-only, only when falling)
      let landed = false
      for (const pl of platforms) {
        if (p.vy < 0) continue
        const px = p.x + p.w/2
        if (px >= pl.x && px <= pl.x + pl.w) {
          const feetPrev = p.y + p.h - p.vy
          const feetNow = p.y + p.h
          if (feetPrev <= pl.y && feetNow >= pl.y) {
            p.y = pl.y - p.h
            p.vy = 0; p.onGround = true; landed = true; break
          }
        }
      }
      if (!landed) p.onGround = false
    }

    if (p.hitFlash > 0) p.hitFlash -= dtMs
  }

  // Balls
  for (const b of state.balls) {
    if (b.held) {
      const owner = state.players.find(pl => pl.holdingBall === b)
      if (owner) { b.x = owner.x + owner.w/2 + owner.facing * 20; b.y = owner.y + 30 }
      continue
    }
    if (b.live) {
      b.vy += GRAVITY * 0.6
      b.x += b.vx; b.y += b.vy
      b.aliveMs += dtMs
      if (!b.trail) b.trail = []
      b.trail.push({ x: b.x, y: b.y })
      if (b.trail.length > 10) b.trail.shift()
      if (b.x < BALL_R) { b.x = BALL_R; b.vx = -b.vx * 0.5 }
      if (b.x > ARENA_W - BALL_R) { b.x = ARENA_W - BALL_R; b.vx = -b.vx * 0.5 }
      if (b.y + b.r >= FLOOR_Y) { b.y = FLOOR_Y - b.r; b.vy *= -0.4; b.vx *= 0.7 }
      if (Math.abs(b.vx) < 0.5 && Math.abs(b.vy) < 1 && b.y >= FLOOR_Y - b.r - 1) {
        b.live = false; b.vx = 0; b.vy = 0
      }

      // Hit detection (Big Head: enlarge upper head region)
      const bigHead = state.mods && state.mods.has('bighead')
      for (const p of state.players) {
        if (p.hp <= 0) continue
        if (b.thrownBy === p.side) continue
        if (p.dashActive > 0) continue
        if (rectCircle(p.x, p.y, p.w, p.h, b.x, b.y, b.r)) { hitPlayer(state, p, b); break }
        if (bigHead) {
          const hx = p.x - 8, hy = p.y - 10, hw = p.w + 16, hh = 30
          if (rectCircle(hx, hy, hw, hh, b.x, b.y, b.r)) { hitPlayer(state, p, b); break }
        }
      }
    } else {
      // Idle ball on ground
      b.vx *= 0.9
      b.x += b.vx
      if (b.x < BALL_R) b.x = BALL_R
      if (b.x > ARENA_W - BALL_R) b.x = ARENA_W - BALL_R
      b.y = FLOOR_Y - b.r
    }
  }

  // Check win conditions
  if (!state.isPractice) {
    const leftAlive = sideAlive(state, 'left')
    const rightAlive = sideAlive(state, 'right')
    if (!leftAlive || !rightAlive) {
      const winner = leftAlive ? 'left' : 'right'
      state.winnerSide = winner
      if (winner === 'left') state.roundsP1++; else state.roundsP2++
      sfx.round()
      // Check set win
      if (state.roundsP1 >= state.roundsPerSet || state.roundsP2 >= state.roundsPerSet) {
        if (state.roundsP1 > state.roundsP2) state.setsP1++; else state.setsP2++
        if (state.setsP1 >= state.setsToWin || state.setsP2 >= state.setsToWin) {
          state.matchWinnerSide = state.setsP1 > state.setsP2 ? 'left' : 'right'
          state.phase = 'matchEnd'; state.phaseTimer = 3000
          sfx.match()
        } else {
          state.phase = 'setEnd'; state.phaseTimer = 2200
        }
      } else {
        state.phase = 'roundEnd'; state.phaseTimer = 1600
      }
    }
  }
}

function advancePhase(state) {
  if (state.phase === 'roundEnd') {
    state.round++
    resetRound(state)
    state.phase = 'countdown'
    state.phaseTimer = 2200
    state.countdown = 3
  } else if (state.phase === 'setEnd') {
    state.set++
    state.round = 1
    state.roundsP1 = 0; state.roundsP2 = 0
    resetRound(state)
    state.phase = 'countdown'
    state.phaseTimer = 2200
    state.countdown = 3
  } else if (state.phase === 'countdown') {
    state.phase = 'play'
  }
}

function hitPlayer(state, p, b) {
  p.hp -= 1
  p.hitFlash = 260
  sfx.hit()
  state.shake = 220
  state.hitstop = p.hp <= 0 ? 140 : 70
  if (p.hp <= 0) state.koFlash = 900
  state.stats[b.thrownBy].hits++
  for (let i = 0; i < 14; i++) {
    state.particles.push({
      x: b.x, y: b.y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 500 + Math.random() * 300,
      color: '#ef4444', r: 3 + Math.random() * 3,
    })
  }
  b.live = false; b.vx = 0; b.vy = 0
  b.y = FLOOR_Y - b.r
}

function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
  const nx = Math.max(rx, Math.min(cx, rx + rw))
  const ny = Math.max(ry, Math.min(cy, ry + rh))
  const dx = cx - nx, dy = cy - ny
  return dx*dx + dy*dy <= cr*cr
}
function dist(ax, ay, bx, by) { return Math.hypot(ax-bx, ay-by) }
