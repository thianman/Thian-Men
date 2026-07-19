import React, { useEffect, useRef, useState } from 'react'
import { CHARACTERS } from '../game/constants.js'
import { xpToLevel, xpForNextLevel } from '../game/progressionConstants.js'
import { sfx } from '../game/sfx.js'

// Post-match "you earned XP + coins" screen. Animates the XP bar filling
// from prevXp → newXp; if the fill crosses a level threshold it re-fills
// from 0 with a shine burst for each level gained. A Skip button jumps
// straight to the final state.
export default function LevelUpScreen({ result, characterId, onDone }) {
  const char = CHARACTERS.find(c => c.id === characterId)
  const prevLevel = result.prevLevel ?? 1
  const newLevel  = result.newLevel  ?? prevLevel
  const prevXp    = result.prevXp    ?? 0
  const newXp     = result.newXp     ?? prevXp

  const [displayLevel, setDisplayLevel] = useState(prevLevel)
  const [barPct, setBarPct] = useState(() => pctInLevel(prevXp, prevLevel))
  const [shining, setShining] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [done, setDone] = useState(false)
  const skipRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      // If already at final state, just show final.
      if (prevXp === newXp) { finish(); return }
      let curLevel = prevLevel
      let curXp    = prevXp
      // Move through each level's segment, then shine on level-up.
      while (!cancelled && !skipRef.current && (curLevel < newLevel || curXp < newXp)) {
        const nextLevelStart = xpToLevel(curLevel + 1)
        const segmentTarget  = Math.min(nextLevelStart, newXp)
        // animate bar from curXp → segmentTarget within this level
        await animatePct({
          from: pctInLevel(curXp, curLevel),
          to:   pctInLevel(segmentTarget, curLevel),
          duration: 900,
          setter: setBarPct,
          skipRef,
        })
        if (cancelled || skipRef.current) break
        if (segmentTarget >= nextLevelStart && curLevel < newLevel) {
          // Level up!
          sfx.click?.()
          setShining(true)
          setFlashKey(k => k + 1)
          curLevel += 1
          curXp = nextLevelStart
          setDisplayLevel(curLevel)
          setBarPct(0)
          await wait(900, skipRef)
          setShining(false)
        } else {
          curXp = segmentTarget
        }
      }
      finish()
    }
    function finish() {
      if (cancelled) return
      setDisplayLevel(newLevel)
      setBarPct(pctInLevel(newXp, newLevel))
      setDone(true)
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSkip = () => {
    skipRef.current = true
    setDisplayLevel(newLevel)
    setBarPct(pctInLevel(newXp, newLevel))
    setShining(false)
    setDone(true)
  }

  const levelsGained = newLevel - prevLevel
  const unlocked = result.unlocked || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-400/30 shadow-2xl p-6 overflow-hidden">
        {shining && <ShineBurst key={flashKey} accent={char?.accent || '#22d3ee'} />}

        <div className="relative z-10">
          <div className="text-center mb-2">
            <div className="text-xs uppercase tracking-widest text-cyan-300/80">Victory</div>
            <div className="text-2xl md:text-3xl font-black text-white">MATCH REWARDS</div>
          </div>

          <div className="flex items-center justify-center gap-4 my-3">
            <MiniHead char={char} />
            <div>
              <div className="text-slate-300 text-sm">Level</div>
              <div className={`text-4xl font-black ${shining ? 'text-amber-300' : 'text-white'}`}>{displayLevel}</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>XP</span>
              <span>+{result.gainedXp}</span>
            </div>
            <div className="h-4 w-full rounded-full bg-slate-800 border border-slate-700 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300 transition-[width] duration-700 ease-out"
                style={{ width: `${barPct}%` }}
              />
              {shining && (
                <div className="absolute inset-0 pointer-events-none animate-pulse bg-white/25" />
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 text-right">
              next level: {xpForNextLevel(displayLevel)} XP
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <RewardTile label="XP Earned"    value={`+${result.gainedXp}`}   color="from-cyan-500 to-cyan-700" />
            <RewardTile label="Coins Earned" value={`+${result.gainedCoin}`} color="from-amber-500 to-amber-700" />
          </div>

          {levelsGained > 0 && (
            <div className="mt-4 text-center">
              <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-200 font-bold tracking-wide">
                LEVEL UP! +{levelsGained}
              </div>
            </div>
          )}

          {unlocked.length > 0 && (
            <div className="mt-3 text-center">
              <div className="text-xs uppercase tracking-widest text-fuchsia-300/80">New character unlocked</div>
              <div className="flex justify-center gap-3 mt-1">
                {unlocked.map(id => {
                  const c = CHARACTERS.find(x => x.id === id)
                  return (
                    <div key={id} className="px-3 py-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-400/50 text-fuchsia-100 font-semibold">
                      🔓 {c?.name || id}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-center gap-3">
            {!done ? (
              <button
                onClick={handleSkip}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-500 text-slate-100 text-sm"
              >
                Skip
              </button>
            ) : (
              <button
                onClick={() => { sfx.click?.(); onDone() }}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 border border-cyan-300/40 text-white font-bold shadow"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function pctInLevel(totalXp, level) {
  const base = xpToLevel(level)
  const span = xpForNextLevel(level)
  if (span <= 0) return 100
  const pct = ((totalXp - base) / span) * 100
  return Math.max(0, Math.min(100, pct))
}

function wait(ms, skipRef) {
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms)
    const iv = setInterval(() => {
      if (skipRef?.current) { clearTimeout(t); clearInterval(iv); resolve() }
    }, 50)
    setTimeout(() => clearInterval(iv), ms + 50)
  })
}

async function animatePct({ from, to, duration, setter, skipRef }) {
  const start = performance.now()
  return new Promise(resolve => {
    function tick(now) {
      if (skipRef?.current) { resolve(); return }
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setter(from + (to - from) * eased)
      if (t < 1) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
}

function MiniHead({ char }) {
  if (!char) return null
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center border-2"
      style={{ background: char.color, borderColor: char.accent }}
    >
      <div className="text-white font-black text-lg drop-shadow">{char.name[0]}</div>
    </div>
  )
}

function RewardTile({ label, value, color }) {
  return (
    <div className={`rounded-lg p-3 text-center bg-gradient-to-b ${color} border border-white/10 shadow`}>
      <div className="text-xs uppercase tracking-wider text-white/80">{label}</div>
      <div className="text-xl font-black text-white">{value}</div>
    </div>
  )
}

function ShineBurst({ accent }) {
  const rays = Array.from({ length: 14 })
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div
        className="absolute w-[220%] h-[220%] rounded-full opacity-70 animate-pulse"
        style={{
          background: `radial-gradient(closest-side, ${accent}55, transparent 70%)`,
          filter: 'blur(2px)',
        }}
      />
      <div className="relative w-full h-full">
        {rays.map((_, i) => {
          const angle = (i * 360) / rays.length
          return (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 origin-left h-1 w-[70%] shine-ray"
              style={{
                transform: `translate(-0%,-50%) rotate(${angle}deg)`,
                background: `linear-gradient(to right, ${accent}, transparent)`,
                animationDelay: `${i * 40}ms`,
              }}
            />
          )
        })}
      </div>
      <style>{`
        @keyframes shineRay {
          0%   { transform: translate(-0%, -50%) scaleX(0)   rotate(var(--rot, 0deg)); opacity: 0; }
          40%  { opacity: 1; }
          100% { transform: translate(-0%, -50%) scaleX(1.4) rotate(var(--rot, 0deg)); opacity: 0; }
        }
        .shine-ray {
          animation: shineRay 900ms ease-out both;
        }
      `}</style>
    </div>
  )
}
