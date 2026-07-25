import React, { useEffect, useRef, useState } from 'react'
import { ARENA_W, ARENA_H, MAPS, P1_KEYS } from '../game/constants.js'
import { initState, tick, applyInput } from '../game/engine.js'
import { render } from '../game/render.js'
import { sfx, playMusic, stopMusic, resumeAudio } from '../game/sfx.js'
import { TUTORIAL_STEPS, checkStep, runStepSetup } from '../game/tutorialSteps.js'

const TUTORIAL_KEY = 'db_tutorial_done_v1'
export function isTutorialDone() { try { return localStorage.getItem(TUTORIAL_KEY) === '1' } catch { return false } }
function markTutorialDone() { try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {} }

// Standalone canvas dedicated to the tutorial. Uses the real engine but the
// opponent is a passive training dummy and we drive step objectives on top.
export default function TutorialCanvas({ onComplete, onExit, onReward }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const prevKeysRef = useRef({})
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const scratchRef = useRef({})
  const [stepIdx, setStepIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [scale, setScale] = useState(1)

  const step = TUTORIAL_STEPS[stepIdx]

  useEffect(() => {
    const mapObj = MAPS[0]
    const s = initState({
      mode: '1p', matchType: '1v1', map: mapObj.id,
      p1Char: 'nova', p2Char: 'tank',
      difficulty: 'easy',
    })
    s.mapObj = mapObj
    // Force play phase immediately, no countdown
    s.phase = 'play'; s.phaseTimer = 0; s.countdown = 0
    // Make both players full health, disable practice restart hooks
    s.isPractice = false
    s.isTutorial = true
    stateRef.current = s
    scratchRef.current = {}
    playMusic('menu')
    resumeAudio()
    return () => { cancelAnimationFrame(rafRef.current); stopMusic() }
  }, [])

  // First step setup + on-step-change setup
  useEffect(() => {
    const s = stateRef.current; if (!s || !step) return
    // Reset scratch counters between steps
    scratchRef.current = {}
    runStepSetup(step, s, scratchRef.current)
  }, [stepIdx])

  // Input handling
  useEffect(() => {
    const d = e => { keysRef.current[e.code] = true }
    const u = e => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', d)
    window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current; if (!el) return
      const rect = el.getBoundingClientRect()
      const scl = Math.min(rect.width / ARENA_W, rect.height / ARENA_H)
      setScale(scl)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const loop = (t) => {
      const dt = Math.min(50, t - (lastRef.current || t))
      lastRef.current = t
      const s = stateRef.current
      if (s) {
        // Build P1 input from keys
        const k = keysRef.current, pk = prevKeysRef.current
        const p1 = s.players[0]
        const dummy = s.players[1]
        if (p1) {
          const input = readInput(k, pk, P1_KEYS)
          applyInput(p1, input, dt, s)
        }
        // Dummy just stands there; no input for the CPU.
        // Skip AI. Also zero its input so it doesn't move.

        tick(s, dt)

        // Never end the tutorial via HP loss — refill both players.
        for (const p of s.players) { if (p.hp < 3) p.hp = 3 }
        if (s.phase !== 'play') { s.phase = 'play'; s.phaseTimer = 0 }

        // Per-step recurring hook (e.g. re-throwing a ball on cooldown)
        if (step && !done && step.onTick) {
          try { step.onTick(s, scratchRef.current, dt) } catch {}
        }

        // Step-complete check
        if (step && !done) {
          const p1now = s.players[0]
          if (checkStep(step, s, p1now, scratchRef.current)) {
            sfx.match?.() || sfx.click?.()
            if (stepIdx + 1 >= TUTORIAL_STEPS.length) {
              markTutorialDone()
              setDone(true)
              onReward && onReward()
            } else {
              setStepIdx(i => i + 1)
            }
          }
        }

        prevKeysRef.current = { ...k }

        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) render(ctx, s, s.mapObj)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [stepIdx, step, done, onReward])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div ref={wrapRef} className="relative w-full h-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={ARENA_W} height={ARENA_H}
          style={{ width: ARENA_W * scale, height: ARENA_H * scale }}
        />

        {/* Instruction bar */}
        {!done && step && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 max-w-2xl w-[90%] rounded-xl bg-slate-950/85 border border-amber-400/60 backdrop-blur px-5 py-3 text-center shadow-2xl">
            <div className="text-[10px] uppercase tracking-widest text-amber-300 mb-1">Step {stepIdx + 1} / {TUTORIAL_STEPS.length}</div>
            <div className="text-xl font-black">{step.title}</div>
            <div className="text-sm text-slate-200">{step.text}</div>
          </div>
        )}

        {/* Complete overlay */}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="max-w-md w-[90%] rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/60 p-6 text-center shadow-2xl">
              <div className="text-6xl mb-2">🏆</div>
              <div className="text-3xl font-black">Basic Training Complete!</div>
              <div className="text-slate-300 mt-2">You're ready to hit the arena.</div>
              <button onClick={() => { sfx.click?.(); onComplete && onComplete() }}
                className="arcade-btn mt-5 text-lg">Continue</button>
            </div>
          </div>
        )}

        {/* Skip button */}
        {!done && (
          <button onClick={() => { markTutorialDone(); sfx.click?.(); onExit && onExit() }}
            className="chip-btn absolute top-4 right-4 text-xs">Skip Tutorial</button>
        )}
      </div>
    </div>
  )
}

// Read the same input keys the offline engine expects. Edge-detect pressed
// keys so double-tap dash still works.
function readInput(k, pk, keys) {
  const pressed = (key) => !!(k[key] && !pk[key])
  return {
    left:  !!k[keys.left],
    right: !!k[keys.right],
    jump:  !!k[keys.jump],
    duck:  !!k[keys.duck],
    throw: !!k[keys.throw],
    catchPressed: pressed(keys.catch),
    leftPressed:  pressed(keys.left),
    rightPressed: pressed(keys.right),
    jumpPressed:  pressed(keys.jump),
    duckPressed:  pressed(keys.duck),
  }
}
