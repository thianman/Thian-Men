import { ARENA_W, ARENA_H, FLOOR_Y, BALL_R, CHARACTERS } from './constants.js'
import { getAvatarImage } from '../lib/avatars.js'

export function render(ctx, state, mapObj, extras = {}) {
  ctx.save()
  if (state.shake > 0) {
    const s = state.shake / 30
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }
  // Background gradient
  const g = ctx.createLinearGradient(0, 0, 0, ARENA_H)
  g.addColorStop(0, mapObj.bg[0])
  g.addColorStop(1, mapObj.bg[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)

  // Map decoration
  drawMapDecor(ctx, mapObj)

  // Floor
  ctx.fillStyle = shadeColor(mapObj.bg[1], -20)
  ctx.fillRect(0, FLOOR_Y, ARENA_W, ARENA_H - FLOOR_Y)
  ctx.fillStyle = mapObj.accent
  ctx.fillRect(0, FLOOR_Y - 4, ARENA_W, 4)

  // Platforms
  for (const p of mapObj.platforms) {
    ctx.fillStyle = shadeColor(mapObj.bg[1], -10)
    ctx.fillRect(p.x, p.y, p.w, p.h)
    ctx.fillStyle = mapObj.accent
    ctx.fillRect(p.x, p.y, p.w, 3)
  }

  // Center-line barrier: neon vertical wall players can't cross.
  const midX = ARENA_W / 2
  const barrierGrad = ctx.createLinearGradient(midX - 8, 0, midX + 8, 0)
  barrierGrad.addColorStop(0.0, 'rgba(34,211,238,0)')
  barrierGrad.addColorStop(0.5, 'rgba(232,121,249,0.35)')
  barrierGrad.addColorStop(1.0, 'rgba(34,211,238,0)')
  ctx.fillStyle = barrierGrad
  ctx.fillRect(midX - 8, 0, 16, FLOOR_Y)
  ctx.strokeStyle = 'rgba(232,121,249,0.85)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 6])
  ctx.beginPath(); ctx.moveTo(midX, 0); ctx.lineTo(midX, FLOOR_Y); ctx.stroke()
  ctx.setLineDash([])

  // Balls
  for (const b of state.balls) {
    drawBall(ctx, b)
  }

  // Hazards
  if (state.hazards) {
    for (const h of state.hazards) {
      if (h.warn > 0) {
        // Warning zone on the floor
        const a = 1 - (h.warn / 700)
        ctx.globalAlpha = 0.4 + 0.5 * a
        ctx.strokeStyle = h.style.ring
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.ellipse(h.x, FLOOR_Y - 2, 30 + 6 * Math.sin(a * 12), 8, 0, 0, Math.PI*2); ctx.stroke()
        ctx.globalAlpha = 0.9
        ctx.fillStyle = h.style.ring
        ctx.font = 'bold 28px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('!', h.x, 40)
        ctx.globalAlpha = 1
      } else {
        drawHazard(ctx, h)
      }
    }
  }

  // Particles
  if (state.particles) {
    for (const p of state.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / 400))
      ctx.fillStyle = p.color
      ctx.globalAlpha = alpha
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 3, 0, Math.PI*2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Player afterimages (behind player)
  for (const p of state.players) {
    if (!p.afterImages) continue
    for (const a of p.afterImages) {
      const alpha = Math.max(0, a.life / 220) * 0.5
      ctx.globalAlpha = alpha
      ctx.fillStyle = a.color
      ctx.fillRect(a.x + 4, a.y + 12, a.w - 8, a.h - 20)
    }
    ctx.globalAlpha = 1
  }

  // Players
  const bigHead = state.mods && state.mods.has('bighead')
  for (const p of state.players) {
    drawPlayer(ctx, p, { bigHead })
  }

  // Charge bars
  for (const p of state.players) {
    if (p.charging) drawChargeBar(ctx, p)
  }

  // HUD
  drawHUD(ctx, state)

  // Phase overlays
  if (state.phase === 'roundEnd') drawCenterText(ctx, state.winnerSide === 'left' ? 'Round P1!' : 'Round P2!', '#fff')
  else if (state.phase === 'setEnd') drawCenterText(ctx, `Set ${state.set} — ${state.setsP1}-${state.setsP2}`, '#fbbf24')
  else if (state.phase === 'countdown') {
    const label = state.countdown > 0 ? String(state.countdown) : 'GO!'
    drawCenterText(ctx, label, state.countdown > 0 ? '#fff' : '#22c55e')
    // First round only: controls hint under the number
    if (state.round === 1 && state.set === 1) {
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '18px system-ui'
      ctx.textAlign = 'center'
      const hint = state.mode === '2p'
        ? 'P1: WASD + F/G     P2: Arrows + , / .'
        : 'Move: A/D   Jump: W   Duck: S   Throw: F (hold)   Catch: G'
      ctx.fillText(hint, ARENA_W/2, ARENA_H/2 + 90)
    }
  }
  else if (state.phase === 'matchEnd') drawMatchEnd(ctx, state)

  // KO flash (independent of phase overlays)
  if (state.koFlash > 0 && state.phase === 'play') {
    const alpha = Math.min(1, state.koFlash / 900)
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.35})`
    ctx.fillRect(0, 0, ARENA_W, ARENA_H)
    ctx.fillStyle = '#ef4444'
    ctx.font = `bold ${80 + (1 - alpha) * 30}px system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.globalAlpha = alpha
    ctx.fillText('K.O.!', ARENA_W/2, ARENA_H/2 - 60)
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawMatchEnd(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  const winner = state.matchWinnerSide
  ctx.fillStyle = winner === 'left' ? '#22d3ee' : '#f87171'
  ctx.font = 'bold 84px system-ui'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(winner === 'left' ? 'P1 WINS!' : 'P2 WINS!', ARENA_W/2, 200)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px system-ui'
  ctx.fillText(`Final: ${state.setsP1} — ${state.setsP2}`, ARENA_W/2, 260)

  // Stats box
  const s = state.stats
  const y0 = 320
  ctx.font = 'bold 22px system-ui'
  ctx.fillStyle = '#93c5fd'; ctx.textAlign = 'right'
  ctx.fillText('P1', ARENA_W/2 - 40, y0)
  ctx.fillStyle = '#fca5a5'; ctx.textAlign = 'left'
  ctx.fillText('P2', ARENA_W/2 + 40, y0)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '20px system-ui'
  const rows = [['Throws', s.left.throws, s.right.throws], ['Catches', s.left.catches, s.right.catches], ['Hits', s.left.hits, s.right.hits]]
  rows.forEach((r, i) => {
    ctx.textAlign = 'center'; ctx.fillStyle = '#cbd5e1'
    ctx.fillText(r[0], ARENA_W/2, y0 + 40 + i * 30)
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'
    ctx.fillText(r[1], ARENA_W/2 - 100, y0 + 40 + i * 30)
    ctx.textAlign = 'left'
    ctx.fillText(r[2], ARENA_W/2 + 100, y0 + 40 + i * 30)
  })
}

function drawMapDecor(ctx, m) {
  if (m.id === 'arena') {
    ctx.strokeStyle = 'rgba(34,211,238,0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i < 20; i++) {
      ctx.beginPath(); ctx.moveTo(i * 70, 0); ctx.lineTo(i * 70, FLOOR_Y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * 50); ctx.lineTo(ARENA_W, i * 50); ctx.stroke()
    }
  } else if (m.id === 'gym') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    for (let i = 0; i < 8; i++) ctx.fillRect(60, 200 + i * 40, ARENA_W - 120, 4)
  } else if (m.id === 'beach') {
    ctx.fillStyle = '#fef3c7'
    ctx.beginPath(); ctx.arc(1080, 120, 60, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(0,60,40,0.6)'
    ctx.fillRect(140, 300, 12, 240)
    ctx.beginPath(); ctx.arc(146, 300, 50, 0, Math.PI * 2); ctx.fill()
  } else if (m.id === 'rooftop') {
    // Moon
    ctx.fillStyle = '#f5f3ff'
    ctx.beginPath(); ctx.arc(1080, 120, 44, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(30,20,60,0.9)'
    ctx.beginPath(); ctx.arc(1096, 108, 44, 0, Math.PI * 2); ctx.fill()
    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    for (let i = 0; i < 30; i++) {
      const x = (i * 137) % 1280
      const y = ((i * 53) % 300)
      ctx.fillRect(x, y, 2, 2)
    }
    // City skyline silhouette
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    const buildings = [ [40,380], [120,320], [220,360], [320,280], [430,340], [560,300], [680,360], [790,290], [900,330], [1020,270], [1160,340] ]
    for (const [x, h] of buildings) {
      ctx.fillRect(x, 540 - h, 80, h)
      // Window lights
      ctx.fillStyle = 'rgba(232,121,249,0.55)'
      for (let wy = 540 - h + 10; wy < 540; wy += 20) {
        for (let wx = x + 8; wx < x + 72; wx += 16) {
          if ((wx * wy) % 7 === 0) ctx.fillRect(wx, wy, 6, 8)
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
    }
    // Antenna on the far right platform edge
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(1050, 460); ctx.lineTo(1050, 320); ctx.stroke()
    ctx.fillStyle = '#ef4444'
    ctx.beginPath(); ctx.arc(1050, 318, 4, 0, Math.PI * 2); ctx.fill()
  }
}

function drawPlayer(ctx, p, opts = {}) {
  drawHumanFigure(ctx, {
    x: p.x, y: p.y, w: p.w, h: p.h,
    char: p.char, side: p.side, facing: p.facing,
    ducking: p.ducking, hitFlash: p.hitFlash,
    bigHead: opts.bigHead, holdingBall: !!p.holdingBall,
    hp: p.hp, charging: p.charging, chargeVal: p.chargeVal,
    displayName: p.displayName, avatarUrl: p.avatarUrl,
  })
}

// Shared human-figure renderer. Same shape used by offline + online.
export function drawHumanFigure(ctx, p) {
  const flash = p.hitFlash > 0
  const shape = p.char.shape || 'normal'
  const headScale = p.bigHead ? 1.6 : 1
  ctx.save()
  ctx.translate(p.x, p.y)
  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath(); ctx.ellipse(p.w/2, p.h + 3, p.w/2 - 4, 5, 0, 0, Math.PI*2); ctx.fill()

  const cx = p.w / 2
  // Vertical layout (top y of each body part). Compressed when ducking.
  const duckSquish = p.ducking ? 0.5 : 1
  const headR = (shape === 'short' ? 12 : shape === 'ghost' ? 13 : 11) * headScale
  const headY = headR + 2
  const neckY = headY + headR - 2
  const torsoTop = neckY + 2
  const torsoH = (34 * duckSquish)
  const torsoBot = torsoTop + torsoH
  const legTop = torsoBot
  const legH = Math.max(6, p.h - legTop - 4)

  // === Legs ===
  const legColor = flash ? '#fff' : '#1e293b'
  const shoeColor = flash ? '#fff' : p.char.accent
  const legW = 8
  const legXL = cx - 10, legXR = cx + 2
  // Left leg
  ctx.fillStyle = legColor
  roundRect(ctx, legXL, legTop, legW, legH, 3, true)
  // Right leg
  roundRect(ctx, legXR, legTop, legW, legH, 3, true)
  // Shoes
  ctx.fillStyle = shoeColor
  roundRect(ctx, legXL - 1, legTop + legH - 4, legW + 3, 4, 2, true)
  roundRect(ctx, legXR - 1, legTop + legH - 4, legW + 3, 4, 2, true)

  // === Arms (behind torso) ===
  const armColor = flash ? '#fff' : shade(p.char.color, -25)
  const armW = 6
  const armH = torsoH - 4
  ctx.fillStyle = armColor
  // Back arm (opposite of facing)
  const backArmX = p.facing === 1 ? cx - p.w/2 + 4 : cx + p.w/2 - 4 - armW
  roundRect(ctx, backArmX, torsoTop + 2, armW, armH, 3, true)

  // === Torso / shirt ===
  const torsoW = shape === 'bulky' ? p.w - 12 : shape === 'slim' ? p.w - 24 : p.w - 18
  const torsoX = cx - torsoW / 2
  ctx.fillStyle = flash ? '#fff' : p.char.color
  if (shape === 'ghost') { ctx.globalAlpha = 0.85 }
  roundRect(ctx, torsoX, torsoTop, torsoW, torsoH, 6, true)
  ctx.globalAlpha = 1

  // Accent belt / stripe
  if (!flash && shape !== 'ghost') {
    ctx.fillStyle = p.char.accent
    ctx.fillRect(torsoX, torsoBot - 5, torsoW, 3)
  }

  // Number-style shirt panel (subtle inner rect)
  if (!flash && shape !== 'ghost') {
    ctx.fillStyle = shade(p.char.color, -15)
    ctx.fillRect(torsoX + 4, torsoTop + 6, torsoW - 8, torsoH - 12)
  }

  // === Front arm (in front of torso) ===
  ctx.fillStyle = armColor
  const frontArmX = p.facing === 1 ? cx + p.w/2 - 4 - armW : cx - p.w/2 + 4
  // If holding ball, arm reaches slightly forward
  const frontArmY = torsoTop + 2 + (p.holdingBall ? -3 : 0)
  roundRect(ctx, frontArmX, frontArmY, armW, armH, 3, true)
  // Hand at tip of front arm
  ctx.fillStyle = flash ? '#fff' : lighten(p.char.color, 25)
  ctx.beginPath(); ctx.arc(frontArmX + armW/2, frontArmY + armH, 4, 0, Math.PI*2); ctx.fill()

  // === Head ===
  const skinCol = flash ? '#fff' : '#f2d5b0'
  ctx.fillStyle = skinCol
  ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI*2); ctx.fill()

  // Hair / hat
  if (!flash) {
    if (shape === 'bulky') {
      // buzz cut + helmet band
      ctx.fillStyle = '#1f2937'
      ctx.beginPath(); ctx.arc(cx, headY, headR + 1, Math.PI, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(cx - headR - 1, headY - 2, headR * 2 + 2, 3)
    } else if (shape === 'tall') {
      // dark hair + headband
      ctx.fillStyle = '#111827'
      ctx.beginPath(); ctx.arc(cx, headY - 1, headR, Math.PI, Math.PI * 2); ctx.fill()
      ctx.fillStyle = p.char.accent
      ctx.fillRect(cx - headR, headY - 2, headR * 2, 3)
    } else if (shape === 'ghost') {
      // glowing hair
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath(); ctx.arc(cx, headY - 2, headR + 2, Math.PI, Math.PI * 2); ctx.fill()
    } else if (shape === 'slim') {
      // spiky hair up
      ctx.fillStyle = p.char.accent
      for (let i = -2; i <= 2; i++) {
        const sx = cx + i * 5
        ctx.beginPath()
        ctx.moveTo(sx - 3, headY - headR + 3)
        ctx.lineTo(sx + 3, headY - headR + 3)
        ctx.lineTo(sx, headY - headR - 5)
        ctx.closePath(); ctx.fill()
      }
    } else if (shape === 'short') {
      // baseball cap
      ctx.fillStyle = p.char.accent
      roundRect(ctx, cx - headR, headY - headR - 1, headR * 2, 8, 3, true)
      // Brim (facing forward)
      const brimX = p.facing === 1 ? cx : cx - headR - 4
      ctx.fillRect(brimX, headY - 4, headR + 4, 3)
    } else {
      // default: swept hair
      ctx.fillStyle = '#4b3a2b'
      ctx.beginPath(); ctx.arc(cx, headY - 1, headR, Math.PI, Math.PI * 2); ctx.fill()
    }
  }

  // Eyes + mouth vary by expression. Look up from CHARACTERS by id so the
  // tag can't get lost through a state mutation or a stale spread.
  if (!flash) {
    const base = CHARACTERS.find(c => c.id === p.char?.id)
    const expr = base?.expression || p.char?.expression || 'smile'
    drawExpression(ctx, cx, headY, p.facing, expr)
  }

  // Team outline halo
  ctx.strokeStyle = p.side === 'left' ? '#38bdf8' : '#f87171'
  ctx.lineWidth = 2
  roundRect(ctx, 2, 4, p.w - 4, p.h - 6, 12, false, true)

  // Holding ball indicator
  if (p.holdingBall) {
    ctx.fillStyle = '#fde047'
    ctx.beginPath(); ctx.arc(p.w/2 + p.facing * 22, 34, BALL_R, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 2; ctx.stroke()
  }

  // HP dots above head
  for (let i = 0; i < p.hp; i++) {
    ctx.fillStyle = '#22c55e'
    ctx.beginPath(); ctx.arc(p.w/2 - 12 + i * 12, -8, 4, 0, Math.PI*2); ctx.fill()
  }

  // Avatar + name plate above head. Human players show their display name
  // and (if uploaded) their photo; CPUs show the character name.
  const label = p.displayName || p.char.name
  const avatarImg = p.avatarUrl ? getAvatarImage(p.avatarUrl) : null
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  const labelW = ctx.measureText(label).width + (avatarImg ? 22 : 8)
  const plateH = 16
  const plateY = avatarImg ? -46 : -22
  ctx.fillRect(p.w/2 - labelW/2, plateY, labelW, plateH)
  if (avatarImg) {
    ctx.save()
    ctx.beginPath(); ctx.arc(p.w/2, -30, 12, 0, Math.PI*2); ctx.clip()
    ctx.drawImage(avatarImg, p.w/2 - 12, -42, 24, 24)
    ctx.restore()
    ctx.strokeStyle = p.side === 'left' ? '#38bdf8' : '#f87171'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(p.w/2, -30, 12, 0, Math.PI*2); ctx.stroke()
  }
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 12px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, p.w/2, plateY + plateH/2)

  ctx.restore()
}

// Draws eyes, brows, and mouth based on the character's personality tag.
export function drawExpression(ctx, cx, headY, facing, expression) {
  const eyeY = headY + 1
  const pupilOffset = facing === 1 ? 1 : -1
  const eyeWhite = '#fff'
  const pupil = '#0b0f1a'
  const brow = '#1f2937'
  const mouth = '#7c2d12'

  const drawEye = (ex, ey, r = 2.5, pr = 1.4, closed = false) => {
    if (closed) {
      ctx.strokeStyle = brow; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(ex - r, ey); ctx.lineTo(ex + r, ey); ctx.stroke()
      return
    }
    ctx.fillStyle = eyeWhite
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = pupil
    ctx.beginPath(); ctx.arc(ex + pupilOffset, ey, pr, 0, Math.PI*2); ctx.fill()
  }
  const drawBrow = (ex, ey, dx, dy) => {
    ctx.strokeStyle = brow; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(ex - dx, ey - dy); ctx.lineTo(ex + dx, ey + dy); ctx.stroke()
  }

  switch (expression) {
    case 'smug': {
      // one raised brow, half-smirk
      drawEye(cx - 4, eyeY); drawEye(cx + 4, eyeY)
      drawBrow(cx - 4, headY - 3, 3, 1)          // level brow
      drawBrow(cx + 4, headY - 4, 3, 0)          // raised brow
      ctx.strokeStyle = mouth; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(cx - 3, headY + 6); ctx.lineTo(cx + 4, headY + 4); ctx.stroke()
      break
    }
    case 'angry': {
      // furrowed V brows, gritted teeth
      drawEye(cx - 4, eyeY, 2.2, 1.2); drawEye(cx + 4, eyeY, 2.2, 1.2)
      drawBrow(cx - 4, headY - 3, 3, -2)         // \
      drawBrow(cx + 4, headY - 3, 3, 2)          // /
      ctx.fillStyle = mouth
      ctx.fillRect(cx - 4, headY + 5, 8, 2)
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8
      for (let i = -3; i <= 3; i += 2) {
        ctx.beginPath(); ctx.moveTo(cx + i, headY + 5); ctx.lineTo(cx + i, headY + 7); ctx.stroke()
      }
      break
    }
    case 'focused': {
      // level brows, neutral tight mouth
      drawEye(cx - 4, eyeY); drawEye(cx + 4, eyeY)
      drawBrow(cx - 4, headY - 3, 3, 0)
      drawBrow(cx + 4, headY - 3, 3, 0)
      ctx.strokeStyle = mouth; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(cx - 3, headY + 6); ctx.lineTo(cx + 3, headY + 6); ctx.stroke()
      break
    }
    case 'mischievous': {
      // wink + wide grin
      const winkLeft = facing === 1
      drawEye(cx - 4, eyeY, 2.5, 1.4, winkLeft)
      drawEye(cx + 4, eyeY, 2.5, 1.4, !winkLeft)
      drawBrow(cx - 4, headY - 4, 3, 1)
      drawBrow(cx + 4, headY - 4, 3, -1)
      ctx.strokeStyle = mouth; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.arc(cx, headY + 4, 4, 0, Math.PI); ctx.stroke()
      break
    }
    case 'intense': {
      // angled brows, gritted teeth
      drawEye(cx - 4, eyeY, 2.2, 1.4); drawEye(cx + 4, eyeY, 2.2, 1.4)
      drawBrow(cx - 4, headY - 3, 3, -1)
      drawBrow(cx + 4, headY - 3, 3, 1)
      ctx.fillStyle = mouth
      ctx.fillRect(cx - 4, headY + 5, 8, 2)
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8
      for (let i = -3; i <= 3; i += 2) {
        ctx.beginPath(); ctx.moveTo(cx + i, headY + 5); ctx.lineTo(cx + i, headY + 7); ctx.stroke()
      }
      break
    }
    case 'cocky': {
      // one raised brow, big sideways smirk (matches facing)
      drawEye(cx - 4, eyeY); drawEye(cx + 4, eyeY)
      const raiseRight = facing === 1
      drawBrow(cx - 4, headY - (raiseRight ? 3 : 4), 3, 0)
      drawBrow(cx + 4, headY - (raiseRight ? 4 : 3), 3, 0)
      ctx.strokeStyle = mouth; ctx.lineWidth = 1.6
      ctx.beginPath()
      if (facing === 1) { ctx.moveTo(cx - 3, headY + 6); ctx.lineTo(cx + 5, headY + 3) }
      else               { ctx.moveTo(cx - 5, headY + 3); ctx.lineTo(cx + 3, headY + 6) }
      ctx.stroke()
      break
    }
    default: {
      drawEye(cx - 4, eyeY); drawEye(cx + 4, eyeY)
      ctx.strokeStyle = mouth; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.arc(cx, headY + 5, 3, 0, Math.PI); ctx.stroke()
    }
  }
}

function drawHazard(ctx, h) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath(); ctx.ellipse(h.x, FLOOR_Y - 2, h.r, 5, 0, 0, Math.PI*2); ctx.fill()
  const shape = h.style.shape
  if (shape === 'bolt') {
    ctx.fillStyle = h.style.color
    ctx.shadowBlur = 16; ctx.shadowColor = h.style.ring
    ctx.beginPath()
    ctx.moveTo(h.x - 4, h.y - h.r)
    ctx.lineTo(h.x + 8, h.y - 4)
    ctx.lineTo(h.x, h.y - 4)
    ctx.lineTo(h.x + 6, h.y + h.r)
    ctx.lineTo(h.x - 6, h.y + 2)
    ctx.lineTo(h.x + 2, h.y + 2)
    ctx.closePath(); ctx.fill()
  } else if (shape === 'coconut') {
    ctx.fillStyle = h.style.color
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#3f1d0c'
    for (const [dx, dy] of [[-6, -4], [6, -4], [0, 4]]) {
      ctx.beginPath(); ctx.arc(h.x + dx, h.y + dy, 2.5, 0, Math.PI*2); ctx.fill()
    }
    ctx.fillStyle = h.style.ring
    ctx.fillRect(h.x - 2, h.y - h.r - 5, 4, 6)
  } else if (shape === 'aircon') {
    // AC unit: grey box with vents and a red LED
    const w = h.r * 2.2, hh = h.r * 1.6
    ctx.fillStyle = h.style.color
    ctx.fillRect(h.x - w/2, h.y - hh/2, w, hh)
    ctx.fillStyle = '#0f172a'
    for (let i = -1; i <= 1; i++) ctx.fillRect(h.x - w/2 + 4 + (i + 1) * (w/3), h.y - 6, (w - 8) / 3 - 2, 12)
    ctx.fillStyle = h.style.ring
    ctx.beginPath(); ctx.arc(h.x + w/2 - 5, h.y - hh/2 + 5, 2, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2
    ctx.strokeRect(h.x - w/2, h.y - hh/2, w, hh)
  } else {
    // basketball
    ctx.fillStyle = h.style.color
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = '#431407'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(h.x - h.r, h.y); ctx.lineTo(h.x + h.r, h.y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(h.x, h.y - h.r); ctx.lineTo(h.x, h.y + h.r); ctx.stroke()
  }
  ctx.restore()
}

function drawBall(ctx, b) {
  ctx.save()
  // trail (charge intensity glow)
  if (b.live && b.trail && b.trail.length > 1) {
    const charge = b.chargeAtThrow || 0.5
    const trailColor = charge > 0.85 ? '#ef4444' : charge > 0.6 ? '#f59e0b' : '#fbbf24'
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i]
      const alpha = (i / b.trail.length) * 0.6
      ctx.globalAlpha = alpha
      ctx.fillStyle = trailColor
      ctx.beginPath(); ctx.arc(t.x, t.y, b.r * (0.4 + 0.5 * (i / b.trail.length)), 0, Math.PI*2); ctx.fill()
    }
    ctx.globalAlpha = 1
    if (charge > 0.85) {
      ctx.shadowBlur = 20; ctx.shadowColor = '#ef4444'
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath(); ctx.ellipse(b.x, FLOOR_Y + 4, b.r, 4, 0, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = b.uncatchable ? '#a855f7' : (b.live ? '#ef4444' : '#fbbf24')
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill()
  ctx.strokeStyle = b.uncatchable ? '#f0abfc' : '#7c2d12'; ctx.lineWidth = 2; ctx.stroke()
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 4, -0.4, 0.4); ctx.stroke()
  if (b.uncatchable) {
    ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI*2); ctx.stroke()
  }
  ctx.restore()
}

function drawChargeBar(ctx, p) {
  const w = 60, h = 8
  const x = p.x + p.w/2 - w/2
  const y = p.y - 34
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(x, y, w, h)
  const pct = p.chargeVal
  ctx.fillStyle = pct > 0.85 ? '#ef4444' : pct > 0.5 ? '#f59e0b' : '#22c55e'
  ctx.fillRect(x + 1, y + 1, (w - 2) * pct, h - 2)
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h)
}

function drawHUD(ctx, state) {
  // Left HP
  const leftPlayers = state.players.filter(p => p.side === 'left')
  const rightPlayers = state.players.filter(p => p.side === 'right')
  drawHPGroup(ctx, 20, 20, leftPlayers, '#38bdf8', 'P1')
  drawHPGroup(ctx, ARENA_W - 240, 20, rightPlayers, '#f87171', state.mode === '2p' && state.matchType !== '2v2' ? 'P2' : 'CPU')

  // Center: round / set
  if (!state.isPractice) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(ARENA_W/2 - 130, 15, 260, 56)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    ctx.strokeRect(ARENA_W/2 - 130, 15, 260, 56)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(`SET ${state.set}/${state.setsToWin}   ROUND ${state.round}`, ARENA_W/2, 38)
    ctx.font = '14px system-ui'
    ctx.fillStyle = '#93c5fd'
    ctx.fillText(`P1 ${state.setsP1} : ${state.setsP2} P2`, ARENA_W/2, 60)
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(ARENA_W/2 - 100, 15, 200, 30)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('PRACTICE MODE', ARENA_W/2, 36)
  }
}

function drawHPGroup(ctx, x, y, players, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(x, y, 220, players.length * 26 + 24)
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.strokeRect(x, y, 220, players.length * 26 + 24)
  ctx.fillStyle = color
  ctx.font = 'bold 14px system-ui'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 10, y + 18)
  players.forEach((p, i) => {
    const py = y + 30 + i * 26
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px system-ui'
    ctx.fillText(p.char.name, x + 10, py + 12)
    for (let h = 0; h < 3; h++) {
      ctx.fillStyle = h < p.hp ? '#22c55e' : 'rgba(255,255,255,0.15)'
      ctx.fillRect(x + 100 + h * 34, py, 30, 14)
    }
  })
}

function drawCenterText(ctx, txt, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, ARENA_H/2 - 80, ARENA_W, 160)
  ctx.fillStyle = color
  ctx.font = 'bold 72px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(txt, ARENA_W/2, ARENA_H/2)
}

// helpers
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}
function lighten(hex, amt) { return shadeColor(hex, amt) }
function shade(hex, amt) { return shadeColor(hex, amt) }
function shadeColor(hex, amt) {
  const c = hex.replace('#','')
  const num = parseInt(c, 16)
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b))
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')
}
