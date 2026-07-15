import React, { useEffect, useRef, useState } from 'react'
import { ARENA_W, ARENA_H, MAPS, P1_KEYS, P2_KEYS } from '../game/constants.js'
import { initState, tick, applyInput } from '../game/engine.js'
import { render } from '../game/render.js'
import { makeAIController } from '../game/ai.js'
import { playMusic, stopMusic, resumeAudio, sfx, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from '../game/sfx.js'

export default function GameCanvas({ config, onExit }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const prevKeysRef = useRef({})
  const touchRef = useRef({ p1: {}, p2: {} })
  const aiRef = useRef([])
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [tick2, setTick2] = useState(0)
  const [scale, setScale] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [rematchNonce, setRematchNonce] = useState(0)

  useEffect(() => {
    const mapObj = MAPS.find(m => m.id === config.map) || MAPS[0]
    const s = initState({
      mode: config.mode,
      matchType: config.matchType || (config.mode === '2p' ? '1v1' : '1v1'),
      map: config.map,
      p1Char: config.p1Char,
      p2Char: config.p2Char,
      difficulty: config.difficulty,
    })
    s.mapObj = mapObj
    stateRef.current = s

    // Prepare AI controllers for CPU players
    aiRef.current = s.players.map(p => p.isCPU ? makeAIController(s.difficulty) : null)

    playMusic('battle')
    resumeAudio()

    return () => { cancelAnimationFrame(rafRef.current); stopMusic() }
  }, [config, rematchNonce])

  // Input handling
  useEffect(() => {
    const down = e => {
      keysRef.current[e.code] = true
      if (e.code === 'Escape') { setPaused(p => !p); sfx.click() }
    }
    const up = e => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Resize / fit
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current; if (!el) return
      const rect = el.getBoundingClientRect()
      const s = Math.min(rect.width / ARENA_W, rect.height / ARENA_H)
      setScale(s)
      setIsMobile(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Main loop
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')

    const loop = (now) => {
      const dt = Math.min(50, now - (lastRef.current || now))
      lastRef.current = now
      const s = stateRef.current
      if (s && !paused) {
        const k = keysRef.current
        const pk = prevKeysRef.current

        // Only accept inputs while in the play phase
        if (s.phase === 'play') s.players.forEach((p, i) => {
          if (p.isCPU) {
            const ai = aiRef.current[i]
            if (ai) {
              const input = ai(p, s, dt)
              applyInput(p, input, dt, s)
            }
          } else {
            const keys = p.kind === 'p2' ? P2_KEYS : P1_KEYS
            const catchPressed = k[keys.catch] && !pk[keys.catch]
            const leftPressed = k[keys.left] && !pk[keys.left]
            const rightPressed = k[keys.right] && !pk[keys.right]
            const input = {
              left: !!k[keys.left],
              right: !!k[keys.right],
              jump: !!k[keys.jump],
              duck: !!k[keys.duck],
              throw: !!k[keys.throw],
              catchPressed, leftPressed, rightPressed,
            }
            // Merge in touch input
            const t = p.kind === 'p2' ? touchRef.current.p2 : touchRef.current.p1
            input.left = input.left || !!t.left
            input.right = input.right || !!t.right
            input.jump = input.jump || !!t.jump
            input.duck = input.duck || !!t.duck
            input.throw = input.throw || !!t.throw
            if (t.catchOnce) { input.catchPressed = true; t.catchOnce = false }
            if (t.dashLeftOnce) { input.leftPressed = true; t.dashLeftOnce = false }
            if (t.dashRightOnce) { input.rightPressed = true; t.dashRightOnce = false }
            applyInput(p, input, dt, s)
          }
        })

        prevKeysRef.current = { ...k }
        tick(s, dt)
        render(ctx, s, s.mapObj)
      } else if (s) {
        render(ctx, s, s.mapObj)
        // Dim overlay only; pause UI is a React layer above
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(0, 0, ARENA_W, ARENA_H)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [paused])

  const s = stateRef.current
  const matchEnd = s?.phase === 'matchEnd'

  const touchStart = (side, action) => () => {
    if (side === 'p1') touchRef.current.p1[action] = true
    else touchRef.current.p2[action] = true
    if (action === 'catch') {
      if (side === 'p1') touchRef.current.p1.catchOnce = true
      else touchRef.current.p2.catchOnce = true
    }
  }
  const touchEnd = (side, action) => () => {
    if (side === 'p1') touchRef.current.p1[action] = false
    else touchRef.current.p2[action] = false
  }

  return (
    <div ref={wrapRef} className="w-screen h-screen flex items-center justify-center bg-black relative overflow-hidden">
      <div style={{ width: ARENA_W * scale, height: ARENA_H * scale, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          style={{ width: ARENA_W * scale, height: ARENA_H * scale, background: '#000' }}
        />

        {/* Top bar */}
        <div className="absolute top-2 right-2 flex gap-2" style={{ transform: `scale(${scale})`, transformOrigin: 'top right' }}>
          <button onClick={() => setPaused(p => !p)} className="px-3 py-1 rounded bg-slate-800/80 border border-slate-500 text-white text-sm">
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>

        {/* Pause menu */}
        {paused && (
          <PauseMenu
            onResume={() => setPaused(false)}
            onRestart={() => { setPaused(false); setRematchNonce(n => n + 1) }}
            onQuit={onExit}
          />
        )}

        {/* Match end overlay */}
        {matchEnd && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-10 pointer-events-none">
            <div className="pointer-events-auto flex gap-3">
              <button onClick={() => setRematchNonce(n => n + 1)} className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg">
                Rematch
              </button>
              <button onClick={onExit} className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg">
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Mobile controls */}
        {isMobile && (
          <MobileControls
            twoPlayer={config.mode === '2p'}
            onDown={touchStart}
            onUp={touchEnd}
          />
        )}
      </div>
    </div>
  )
}

function PauseMenu({ onResume, onRestart, onQuit }) {
  const [music, setMusic] = useState(!isMusicMuted())
  const [sound, setSound] = useState(!isSfxMuted())
  const btn = 'w-56 px-5 py-3 rounded-xl font-bold text-lg shadow-lg border transition'
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-slate-900/95 border border-slate-600 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
        <h2 className="text-4xl font-black text-white mb-2">PAUSED</h2>
        <button className={btn + ' bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-300/40'} onClick={() => { sfx.click(); onResume() }}>Resume</button>
        <button className={btn + ' bg-amber-600 hover:bg-amber-500 text-white border-amber-300/40'} onClick={() => { sfx.click(); onRestart() }}>Restart Match</button>
        <button className={btn + ' bg-red-700 hover:bg-red-600 text-white border-red-300/40'} onClick={() => { sfx.click(); onQuit() }}>Quit to Menu</button>

        <div className="w-full flex gap-2 justify-between mt-3 text-slate-200 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={music} onChange={e => { setMusic(e.target.checked); setMusicMuted(!e.target.checked) }} />
            Music
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); setSfxMuted(!e.target.checked) }} />
            SFX
          </label>
        </div>
        <p className="text-slate-400 text-xs mt-1">Press ESC to resume</p>
      </div>
    </div>
  )
}

function MobileControls({ twoPlayer, onDown, onUp }) {
  const btnCls = 'w-14 h-14 rounded-full bg-white/20 active:bg-white/40 border border-white/40 text-white text-lg font-bold flex items-center justify-center touch-none select-none'
  const dpad = (side) => (
    <div className="flex flex-col items-center gap-1">
      <button className={btnCls} onTouchStart={onDown(side,'jump')} onTouchEnd={onUp(side,'jump')} onMouseDown={onDown(side,'jump')} onMouseUp={onUp(side,'jump')}>▲</button>
      <div className="flex gap-1">
        <button className={btnCls} onTouchStart={onDown(side,'left')} onTouchEnd={onUp(side,'left')} onMouseDown={onDown(side,'left')} onMouseUp={onUp(side,'left')}>◀</button>
        <button className={btnCls} onTouchStart={onDown(side,'duck')} onTouchEnd={onUp(side,'duck')} onMouseDown={onDown(side,'duck')} onMouseUp={onUp(side,'duck')}>▼</button>
        <button className={btnCls} onTouchStart={onDown(side,'right')} onTouchEnd={onUp(side,'right')} onMouseDown={onDown(side,'right')} onMouseUp={onUp(side,'right')}>▶</button>
      </div>
    </div>
  )
  const actions = (side) => (
    <div className="flex flex-col items-center gap-2">
      <button className={btnCls + ' bg-red-500/40'} onTouchStart={onDown(side,'throw')} onTouchEnd={onUp(side,'throw')} onMouseDown={onDown(side,'throw')} onMouseUp={onUp(side,'throw')}>THR</button>
      <button className={btnCls + ' bg-green-500/40'} onTouchStart={onDown(side,'catch')} onTouchEnd={onUp(side,'catch')} onMouseDown={onDown(side,'catch')} onMouseUp={onUp(side,'catch')}>CATCH</button>
    </div>
  )
  return (
    <>
      <div className="absolute bottom-4 left-4 pointer-events-auto">{dpad('p1')}</div>
      <div className="absolute bottom-4 right-4 pointer-events-auto">{actions('p1')}</div>
      {twoPlayer && (
        <>
          <div className="absolute top-24 left-4 pointer-events-auto opacity-90">{dpad('p2')}</div>
          <div className="absolute top-24 right-4 pointer-events-auto opacity-90">{actions('p2')}</div>
        </>
      )}
    </>
  )
}
