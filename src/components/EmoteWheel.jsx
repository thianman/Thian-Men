import React, { useEffect, useRef, useState } from 'react'
import { EMOTES } from '../game/emotes.js'
import { sfx } from '../game/sfx.js'

// Radial menu of emotes. Opens centered on the given screen position.
// Click / tap an emote to pick, or press number keys 1-8 while open.
// Closes on Escape, second wheel-key press, or clicking outside.
export default function EmoteWheel({ open, onPick, onClose, playerLabel = 'You' }) {
  const rootRef = useRef(null)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.code === 'Escape') { onClose && onClose(); return }
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= EMOTES.length) {
        const emote = EMOTES[n - 1]
        onPick && onPick(emote)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onPick, onClose])

  if (!open) return null

  const size = 320
  const radius = 110
  const cx = size / 2
  const cy = size / 2

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={onClose}
      ref={rootRef}
    >
      <div
        className="relative"
        style={{ width: size, height: size }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ring */}
        <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
          <circle cx={cx} cy={cy} r={radius + 42} fill="rgba(15,23,42,0.85)" stroke="rgba(253,224,71,0.4)" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={35} fill="#0a1226" stroke="rgba(253,224,71,0.45)" strokeWidth="2" />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-amber-300">{playerLabel}</div>
            <div className="text-sm font-bold text-white">{hover?.label || 'Emote'}</div>
          </div>
        </div>
        {/* Slices */}
        {EMOTES.map((e, i) => {
          const angle = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          return (
            <button
              key={e.id}
              onMouseEnter={() => setHover(e)}
              onMouseLeave={() => setHover(null)}
              onClick={() => { sfx.click?.(); onPick && onPick(e) }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex flex-col items-center justify-center bg-slate-900 border-2 border-slate-700 hover:border-amber-400 hover:scale-110 transition"
              style={{ left: x, top: y, boxShadow: `0 0 14px ${e.color}66` }}
            >
              <div className="text-2xl leading-none">{e.emoji}</div>
              <div className="text-[10px] text-slate-400 font-bold">{i + 1}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
