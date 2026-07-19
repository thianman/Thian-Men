import React from 'react'
import { CHARACTERS } from '../game/constants.js'

// Signature action for each character. Every pose is drawn in the same
// 100x140 humanoid grid so it swaps cleanly.
const POSES = {
  blaze:   { verb: 'DASH THROW',   render: renderBlaze   },
  tank:    { verb: 'POWER SLAM',   render: renderTank    },
  nova:    { verb: 'MID CATCH',    render: renderNova    },
  ghost:   { verb: 'AERIAL DODGE', render: renderGhost   },
  crusher: { verb: 'CANNON SHOT',  render: renderCrusher },
  striker: { verb: 'SLIDE STRIKE', render: renderStriker },
}

export function poseVerb(charId) {
  return POSES[charId]?.verb || 'READY'
}

// Renders the character mid-action inside a 100x140 SVG.
// Set `size` to control CSS pixel width (height auto-scales).
export default function CharacterPose({ character, size = 96, animated = true, showBall = true }) {
  const char = typeof character === 'string' ? CHARACTERS.find(c => c.id === character) : character
  if (!char) return null
  const pose = POSES[char.id]
  const skin = '#f2d5b0'
  const dark = '#0a1226'
  const pants = '#1e293b'
  const shoe = char.accent

  const ctx = { char, skin, dark, pants, shoe, animated, showBall }
  return (
    <svg
      viewBox="0 0 100 140"
      width={size}
      height={size * 1.4}
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="50" cy="132" rx="24" ry="3" fill="black" opacity="0.35" />
      {pose ? pose.render(ctx) : renderDefault(ctx)}
    </svg>
  )
}

// ==== per-character poses ==================================================
// All poses share body parts: legs, torso, head, hair, expression.
// They differ in arm angles, ball placement, and motion trails.

function torsoAndLegs(ctx, { squish = 1, torsoWide = 24 } = {}) {
  const { char, dark, pants, shoe } = ctx
  const legTop = 74
  const legH = 40 * squish
  const legY = legTop
  return (
    <g>
      {/* Legs */}
      <rect x="40" y={legY} width="8" height={legH} rx="3" fill={pants} />
      <rect x="52" y={legY} width="8" height={legH} rx="3" fill={pants} />
      {/* Shoes */}
      <rect x="38" y={legY + legH - 5} width="12" height="5" rx="2" fill={shoe} />
      <rect x="50" y={legY + legH - 5} width="12" height="5" rx="2" fill={shoe} />
      {/* Torso */}
      <rect x={50 - torsoWide/2} y="42" width={torsoWide} height={32 * squish} rx="6" fill={char.color} />
      {/* Belt accent */}
      <rect x={50 - torsoWide/2} y={42 + 32 * squish - 5} width={torsoWide} height="3" fill={char.accent} />
    </g>
  )
}

function headWithHair(ctx, cx = 50, cy = 32, extra = null) {
  const { char, skin, dark } = ctx
  const shape = char.shape || 'normal'
  return (
    <g>
      <circle cx={cx} cy={cy} r="11" fill={skin} />
      {shape === 'slim' && (
        <g fill={char.accent}>
          <polygon points={`${cx - 8},${cy - 8} ${cx - 4},${cy - 4} ${cx - 6},${cy - 14}`} />
          <polygon points={`${cx - 3},${cy - 10} ${cx + 1},${cy - 6} ${cx - 1},${cy - 16}`} />
          <polygon points={`${cx + 2},${cy - 10} ${cx + 6},${cy - 6} ${cx + 4},${cy - 16}`} />
          <polygon points={`${cx + 6},${cy - 8} ${cx + 9},${cy - 4} ${cx + 8},${cy - 14}`} />
        </g>
      )}
      {shape === 'bulky' && (
        <>
          <path d={`M ${cx - 11} ${cy} A 11 11 0 0 1 ${cx + 11} ${cy}`} fill="#1f2937" />
          <rect x={cx - 12} y={cy - 3} width="24" height="3" fill={dark} />
        </>
      )}
      {shape === 'tall' && (
        <>
          <path d={`M ${cx - 11} ${cy - 1} A 11 11 0 0 1 ${cx + 11} ${cy - 1}`} fill="#111827" />
          <rect x={cx - 11} y={cy - 3} width="22" height="3" fill={char.accent} />
        </>
      )}
      {shape === 'ghost' && (
        <path d={`M ${cx - 12} ${cy - 2} Q ${cx} ${cy - 18} ${cx + 12} ${cy - 2}`} fill="#ffffff" opacity="0.7" />
      )}
      {shape === 'short' && (
        <>
          <rect x={cx - 11} y={cy - 12} width="22" height="7" rx="3" fill={char.accent} />
          <rect x={cx - 2} y={cy - 5} width="14" height="3" fill={char.accent} />
        </>
      )}
      {shape === 'normal' && (
        <path d={`M ${cx - 11} ${cy - 1} A 11 11 0 0 1 ${cx + 11} ${cy - 1}`} fill="#4b3a2b" />
      )}
      {extra}
    </g>
  )
}

// Expression helper — one open eye + one closed for wink; else two open with brow.
function drawFace(ctx, cx, cy, expr = 'smile', facing = 1) {
  const eyeY = cy + 1
  const brow = '#1f2937'
  const mouth = '#7c2d12'
  const pOff = facing === 1 ? 0.5 : -0.5
  const shapes = []
  const eye = (ex, closed = false) => closed
    ? <line key={`e${ex}`} x1={ex - 2} y1={eyeY} x2={ex + 2} y2={eyeY} stroke={brow} strokeWidth="1.4" strokeLinecap="round" />
    : (
      <g key={`e${ex}`}>
        <circle cx={ex} cy={eyeY} r="1.8" fill="#fff" />
        <circle cx={ex + pOff} cy={eyeY} r="1" fill="#0b0f1a" />
      </g>
    )

  if (expr === 'smug') {
    shapes.push(eye(cx - 3), eye(cx + 3))
    shapes.push(<line key="b1" x1={cx - 5} y1={cy - 2} x2={cx - 1} y2={cy - 2} stroke={brow} strokeWidth="1.2" strokeLinecap="round" />)
    shapes.push(<line key="b2" x1={cx + 1} y1={cy - 4} x2={cx + 5} y2={cy - 3} stroke={brow} strokeWidth="1.2" strokeLinecap="round" />)
    shapes.push(<path key="m" d={`M ${cx - 2} ${cy + 4} L ${cx + 3} ${cy + 3}`} stroke={mouth} strokeWidth="1.2" strokeLinecap="round" fill="none" />)
  } else if (expr === 'angry') {
    shapes.push(eye(cx - 3), eye(cx + 3))
    shapes.push(<line key="b1" x1={cx - 5} y1={cy - 2} x2={cx - 1} y2={cy} stroke={brow} strokeWidth="1.4" strokeLinecap="round" />)
    shapes.push(<line key="b2" x1={cx + 1} y1={cy} x2={cx + 5} y2={cy - 2} stroke={brow} strokeWidth="1.4" strokeLinecap="round" />)
    shapes.push(<rect key="m" x={cx - 3} y={cy + 3} width="6" height="2" fill={mouth} />)
    shapes.push(
      <g key="t" stroke="#fff" strokeWidth="0.6">
        <line x1={cx - 2} y1={cy + 3} x2={cx - 2} y2={cy + 5} />
        <line x1={cx} y1={cy + 3} x2={cx} y2={cy + 5} />
        <line x1={cx + 2} y1={cy + 3} x2={cx + 2} y2={cy + 5} />
      </g>
    )
  } else if (expr === 'focused') {
    shapes.push(eye(cx - 3), eye(cx + 3))
    shapes.push(<line key="b1" x1={cx - 5} y1={cy - 2} x2={cx - 1} y2={cy - 2} stroke={brow} strokeWidth="1.2" strokeLinecap="round" />)
    shapes.push(<line key="b2" x1={cx + 1} y1={cy - 2} x2={cx + 5} y2={cy - 2} stroke={brow} strokeWidth="1.2" strokeLinecap="round" />)
    shapes.push(<line key="m" x1={cx - 2} y1={cy + 4} x2={cx + 2} y2={cy + 4} stroke={mouth} strokeWidth="1.2" strokeLinecap="round" />)
  } else if (expr === 'mischievous') {
    shapes.push(eye(cx - 3, facing === -1))
    shapes.push(eye(cx + 3, facing === 1))
    shapes.push(<path key="m" d={`M ${cx - 3} ${cy + 3} Q ${cx} ${cy + 6} ${cx + 3} ${cy + 3}`} stroke={mouth} strokeWidth="1.4" fill="none" strokeLinecap="round" />)
  } else if (expr === 'intense') {
    shapes.push(eye(cx - 3), eye(cx + 3))
    shapes.push(<line key="b1" x1={cx - 5} y1={cy - 2} x2={cx - 1} y2={cy - 1} stroke={brow} strokeWidth="1.4" strokeLinecap="round" />)
    shapes.push(<line key="b2" x1={cx + 1} y1={cy - 1} x2={cx + 5} y2={cy - 2} stroke={brow} strokeWidth="1.4" strokeLinecap="round" />)
    shapes.push(<rect key="m" x={cx - 3} y={cy + 3} width="6" height="2" fill={mouth} />)
  } else if (expr === 'cocky') {
    shapes.push(eye(cx - 3), eye(cx + 3))
    shapes.push(<line key="b1" x1={cx - 5} y1={cy - 3} x2={cx - 1} y2={cy - 2} stroke={brow} strokeWidth="1.2" strokeLinecap="round" />)
    shapes.push(<line key="b2" x1={cx + 1} y1={cy - 2} x2={cx + 5} y2={cy - 4} stroke={brow} strokeWidth="1.2" strokeLinecap="round" />)
    shapes.push(<path key="m" d={`M ${cx - 3} ${cy + 4} L ${cx + 4} ${cy + 2}`} stroke={mouth} strokeWidth="1.4" strokeLinecap="round" fill="none" />)
  } else {
    shapes.push(eye(cx - 3), eye(cx + 3))
    shapes.push(<path key="m" d={`M ${cx - 2} ${cy + 4} Q ${cx} ${cy + 6} ${cx + 2} ${cy + 4}`} stroke={mouth} strokeWidth="1.2" fill="none" strokeLinecap="round" />)
  }
  return <g>{shapes}</g>
}

function ball(cx, cy, r = 5) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#ef4444" />
      <circle cx={cx - r*0.35} cy={cy - r*0.35} r={r*0.35} fill="#fca5a5" opacity="0.85" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="#7c2d12" strokeWidth="1" fill="none" />
    </g>
  )
}

function motionLines(x, y, color = '#fde047', count = 3) {
  return (
    <g stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
      {Array.from({ length: count }).map((_, i) => (
        <line key={i} x1={x} y1={y + i * 4} x2={x - 10} y2={y + i * 4} />
      ))}
    </g>
  )
}

// === BLAZE — dash throw ===================================================
function renderBlaze(ctx) {
  const { char, skin, dark, animated } = ctx
  return (
    <g className={animated ? 'pose-lean' : ''}>
      {/* Speed lines behind */}
      {motionLines(28, 60, char.accent, 4)}
      {torsoAndLegs(ctx)}
      {/* Back arm swept back */}
      <path d="M 40 46 Q 28 60 20 66" stroke={char.color} strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Front arm mid-throw extending right */}
      <path d="M 60 46 Q 80 40 90 46" stroke={char.color} strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="90" cy="46" r="4" fill={skin} />
      {headWithHair(ctx, 50, 32)}
      {drawFace(ctx, 50, 32, char.expression || 'smug', 1)}
      {ctx.showBall && ball(96, 40, 5)}
    </g>
  )
}

// === TANK — power slam (both arms overhead with ball) =====================
function renderTank(ctx) {
  const { char, skin } = ctx
  return (
    <g>
      {torsoAndLegs(ctx, { torsoWide: 30 })}
      {/* Back arm reaching up */}
      <path d="M 38 46 Q 34 26 44 14" stroke={char.color} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Front arm up too */}
      <path d="M 62 46 Q 66 26 56 14" stroke={char.color} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Ball overhead */}
      {ctx.showBall && ball(50, 12, 7)}
      {headWithHair(ctx, 50, 36)}
      {drawFace(ctx, 50, 36, char.expression || 'angry', 1)}
      {/* Impact starburst */}
      <g stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
        <line x1="50" y1="4" x2="50" y2="0" />
        <line x1="42" y1="8" x2="38" y2="4" />
        <line x1="58" y1="8" x2="62" y2="4" />
      </g>
    </g>
  )
}

// === NOVA — mid catch (arms out ready) ====================================
function renderNova(ctx) {
  const { char, skin } = ctx
  return (
    <g>
      {torsoAndLegs(ctx)}
      {/* Both arms forward reaching */}
      <path d="M 40 46 Q 26 46 22 58" stroke={char.color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M 60 46 Q 74 46 78 58" stroke={char.color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="22" cy="58" r="4" fill={skin} />
      <circle cx="78" cy="58" r="4" fill={skin} />
      {headWithHair(ctx, 50, 32)}
      {drawFace(ctx, 50, 32, char.expression || 'focused', 1)}
      {/* Ball coming in from left */}
      {ctx.showBall && (
        <>
          <path d="M 4 66 Q 12 62 20 60" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.7" />
          {ball(20, 60, 5)}
        </>
      )}
      {/* Catch flash ring */}
      <circle cx="22" cy="58" r="10" fill="none" stroke={char.accent} strokeWidth="1.2" opacity="0.65" />
    </g>
  )
}

// === GHOST — aerial backflip dodge ========================================
function renderGhost(ctx) {
  const { char, skin } = ctx
  return (
    <g transform="rotate(-12 50 70)">
      {/* Motion afterimage */}
      <g opacity="0.3" transform="translate(6 4)">
        {torsoAndLegs({ ...ctx, char: { ...char, color: char.color } }, { torsoWide: 24 })}
      </g>
      {torsoAndLegs(ctx, { torsoWide: 24 })}
      {/* Arms outstretched leaning back */}
      <path d="M 40 46 Q 22 52 12 46" stroke={char.color} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M 60 46 Q 78 42 86 32" stroke={char.color} strokeWidth="6" strokeLinecap="round" fill="none" />
      {headWithHair(ctx, 50, 32)}
      {drawFace(ctx, 50, 32, char.expression || 'mischievous', -1)}
      {/* Ball zipping past over the shoulder */}
      {ctx.showBall && (
        <>
          <path d="M 90 60 Q 70 70 40 76" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.75" />
          {ball(90, 60, 5)}
        </>
      )}
    </g>
  )
}

// === CRUSHER — mid-jump cannon throw ======================================
function renderCrusher(ctx) {
  const { char, skin } = ctx
  return (
    <g transform="translate(0 -4)">
      {/* Jump dust */}
      <g stroke="#a3a3a3" strokeWidth="1.4" opacity="0.65">
        <line x1="26" y1="132" x2="18" y2="128" />
        <line x1="34" y1="134" x2="32" y2="140" />
        <line x1="66" y1="134" x2="68" y2="140" />
        <line x1="74" y1="132" x2="82" y2="128" />
      </g>
      {torsoAndLegs(ctx, { torsoWide: 26 })}
      {/* Back arm winding */}
      <path d="M 40 46 Q 30 40 22 30" stroke={char.color} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Front arm firing forward */}
      <path d="M 60 46 Q 78 40 94 46" stroke={char.color} strokeWidth="8" strokeLinecap="round" fill="none" />
      {headWithHair(ctx, 50, 30)}
      {drawFace(ctx, 50, 30, char.expression || 'intense', 1)}
      {/* Ball fires with fire trail */}
      {ctx.showBall && (
        <>
          <path d="M 60 46 Q 78 40 94 46" stroke="#f97316" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
          {ball(94, 44, 6)}
          <path d="M 100 44 L 106 40 M 100 44 L 106 48" stroke="#facc15" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

// === STRIKER — sliding strike ============================================
function renderStriker(ctx) {
  const { char, skin, pants } = ctx
  return (
    <g transform="rotate(-18 50 100)">
      {/* Slide streak */}
      <path d="M 20 122 L 90 122" stroke={char.accent} strokeWidth="4" opacity="0.4" strokeLinecap="round" />
      <path d="M 15 118 L 30 118" stroke="#fff" strokeWidth="1.5" opacity="0.55" strokeLinecap="round" />
      {/* Extended sliding legs */}
      <rect x="30" y="94" width="45" height="8" rx="4" fill={pants} />
      <rect x="26" y="98" width="10" height="6" rx="2" fill={char.accent} />
      {/* Torso lifted */}
      <rect x="60" y="66" width="20" height="26" rx="5" fill={char.color} />
      <rect x="60" y="86" width="20" height="3" fill={char.accent} />
      {/* Back arm bracing floor */}
      <path d="M 62 78 Q 58 92 52 100" stroke={char.color} strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Front arm mid-throw */}
      <path d="M 80 72 Q 92 66 96 58" stroke={char.color} strokeWidth="6" strokeLinecap="round" fill="none" />
      {headWithHair(ctx, 74, 56)}
      {drawFace(ctx, 74, 56, char.expression || 'cocky', 1)}
      {ctx.showBall && ball(96, 54, 5)}
    </g>
  )
}

function renderDefault(ctx) {
  return (
    <g>
      {torsoAndLegs(ctx)}
      {headWithHair(ctx, 50, 32)}
      {drawFace(ctx, 50, 32, ctx.char.expression || 'smile', 1)}
    </g>
  )
}
