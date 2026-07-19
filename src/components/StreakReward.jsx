import React, { useEffect, useState } from 'react'
import { sfx } from '../game/sfx.js'

// Fires once per UTC day right after sign-in, showing the streak bonus.
// Milestone streaks (7 / 14 / 30) trigger extra confetti.
export default function StreakReward({ streak, reward, longest, onClose }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => { sfx.match?.() || sfx.click?.() }, [])
  const milestone = reward?.isMilestone

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 ${visible ? '' : 'pointer-events-none opacity-0'}`}>
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-orange-900/40 to-slate-950 border border-amber-400/40 shadow-2xl p-6 overflow-hidden">
        {milestone && <MilestoneBurst />}
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-1 animate-pulse">🔥</div>
          <div className="text-xs uppercase tracking-widest text-amber-300/90">Login streak</div>
          <div className="text-4xl font-black text-white leading-none mt-1">Day {streak}</div>
          {milestone && (
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-500/25 border border-amber-300/60 text-amber-100 text-xs font-bold tracking-wider">
              MILESTONE!
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-lg p-3 text-center bg-gradient-to-b from-cyan-500 to-cyan-700 border border-white/10 shadow">
              <div className="text-xs uppercase tracking-wider text-white/80">XP Bonus</div>
              <div className="text-2xl font-black text-white">+{reward?.xp || 0}</div>
            </div>
            <div className="rounded-lg p-3 text-center bg-gradient-to-b from-amber-500 to-amber-700 border border-white/10 shadow">
              <div className="text-xs uppercase tracking-wider text-white/80">Coin Bonus</div>
              <div className="text-2xl font-black text-white">+{reward?.coins || 0}</div>
            </div>
          </div>
          {longest && longest > streak && (
            <div className="text-xs text-slate-400 mt-3">Longest streak: {longest} days</div>
          )}
          <button
            onClick={() => { sfx.click?.(); setVisible(false); onClose && onClose() }}
            className="arcade-btn mt-5 text-lg"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

function MilestoneBurst() {
  const bits = Array.from({ length: 24 })
  return (
    <div className="absolute inset-0 pointer-events-none">
      {bits.map((_, i) => {
        const angle = (i * 15) * (Math.PI / 180)
        const dx = Math.cos(angle) * 240
        const dy = Math.sin(angle) * 240
        return (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
            style={{
              background: i % 2 ? '#fde047' : '#fb923c',
              boxShadow: '0 0 8px currentColor',
              transform: `translate(${dx}px, ${dy}px)`,
              opacity: 0.85,
              animation: `mile-fly 900ms ease-out both`,
              animationDelay: `${i * 20}ms`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes mile-fly {
          0%   { transform: translate(0, 0);           opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translate(var(--dx, 100px), var(--dy, 100px)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
