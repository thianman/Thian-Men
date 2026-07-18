import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CloudflareTransport } from '../net/cfTransport.js'
import { sfx } from '../game/sfx.js'

const ARENA_W = 1280
const ARENA_H = 720

const btn = 'px-6 py-3 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow-lg border border-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed'
const btnAlt = 'px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-semibold border border-slate-500'
const input = 'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:border-cyan-400 focus:outline-none text-white font-mono uppercase tracking-widest text-center text-2xl'

export default function OnlineTest({ profile, onExit }) {
  const [phase, setPhase] = useState('menu') // 'menu' | 'joining' | 'lobby' | 'playing' | 'error'
  const [code, setCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [rtt, setRtt] = useState(0)
  const [roster, setRoster] = useState([])
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const [state, setState] = useState(null)
  const transportRef = useRef(null)
  const canvasRef = useRef(null)
  const keysRef = useRef({})
  const inputTimerRef = useRef(null)

  const displayName = profile?.display_name || 'Guest'

  const connect = async (roomCode) => {
    setError('')
    const t = new CloudflareTransport({ name: displayName })
    transportRef.current = t

    t.on('connected', () => setPhase('lobby'))
    t.on('welcome',   (m) => { setMe({ playerId: m.playerId, side: m.side }); sfx.click() })
    t.on('roster',    (m) => setRoster(m.players))
    t.on('state',     (m) => setState(m))
    t.on('pong',      (r) => setRtt(r))
    t.on('error',     (e) => { setError('Connection error'); setPhase('error') })
    t.on('disconnected', () => { setPhase('menu'); setRoster([]); setState(null); setMe(null) })

    setPhase('joining')
    try {
      await t.join(roomCode)
    } catch (e) {
      setError(e.message || 'Failed to join')
      setPhase('error')
    }
  }

  const hostMatch = async () => {
    setError('')
    setPhase('joining')
    try {
      const t = new CloudflareTransport({ name: displayName })
      const c = await t.createMatch()
      transportRef.current = null // don't reuse; we'll reconnect
      setCode(c)
      await connect(c)
    } catch (e) {
      setError(e.message || 'Failed to create match')
      setPhase('error')
    }
  }

  const doJoin = async () => {
    const c = joinCode.trim().toUpperCase()
    if (c.length < 4) return
    setCode(c)
    await connect(c)
  }

  const leave = () => {
    if (transportRef.current) transportRef.current.disconnect()
    transportRef.current = null
    setPhase('menu')
    setRoster([]); setState(null); setMe(null); setCode('')
  }

  // Keyboard input capture + send loop
  useEffect(() => {
    const down = (e) => { keysRef.current[e.code] = true }
    const up   = (e) => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'lobby' && phase !== 'playing') return
    inputTimerRef.current = setInterval(() => {
      const k = keysRef.current
      const t = transportRef.current
      if (!t) return
      t.sendInput({
        left:  !!(k.KeyA || k.ArrowLeft),
        right: !!(k.KeyD || k.ArrowRight),
        jump:  !!(k.KeyW || k.Space || k.ArrowUp),
      })
    }, 33)
    return () => { if (inputTimerRef.current) clearInterval(inputTimerRef.current) }
  }, [phase])

  // Render loop
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      ctx.fillStyle = '#0b1024'
      ctx.fillRect(0, 0, ARENA_W, ARENA_H)
      // grid
      ctx.strokeStyle = 'rgba(34,211,238,0.15)'
      for (let x = 0; x < ARENA_W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke()
      }
      // floor
      ctx.fillStyle = '#111827'; ctx.fillRect(0, 640, ARENA_W, 80)
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(0, 636, ARENA_W, 4)
      // players
      if (state?.players) {
        for (const p of state.players) {
          ctx.fillStyle = p.side === 'left' ? '#38bdf8' : '#f87171'
          ctx.fillRect(p.x, p.y, 56, 96)
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, 56, 96)
          if (me && p.id === me.playerId) {
            ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3
            ctx.strokeRect(p.x - 4, p.y - 4, 64, 104)
          }
          ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'
          ctx.fillText(p.name || '', p.x + 28, p.y - 8)
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [state, me])

  const scale = useMemo(() => {
    if (typeof window === 'undefined') return 0.7
    return Math.min(window.innerWidth * 0.9 / ARENA_W, window.innerHeight * 0.55 / ARENA_H)
  }, [phase])

  if (phase === 'menu' || phase === 'error') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-4">
        <h1 className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300">PLAY ONLINE (BETA)</h1>
        <p className="text-slate-300 mb-6 text-center">Phase 2 preview — two players, server-authoritative movement. No balls yet.</p>
        <div className="w-full max-w-md grid gap-4">
          <button className={btn} onClick={hostMatch}>Host Match</button>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <label className="block text-sm text-slate-300 mb-2">Join a friend's match with a code</label>
            <input className={input} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABCDEF" maxLength={6} />
            <button className={btn + ' w-full mt-3'} onClick={doJoin} disabled={joinCode.length < 4}>Join Match</button>
          </div>
          {error && <div className="text-red-400 text-sm text-center">{error}</div>}
        </div>
        <button onClick={onExit} className="mt-6 px-4 py-2 rounded bg-slate-800 border border-slate-600 text-sm">← Back to Menu</button>
        <p className="text-slate-500 text-xs mt-3">Signed in as {displayName}</p>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-start bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-4">
      <div className="w-full max-w-6xl flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/70 border border-slate-600 rounded-lg px-3 py-1 font-mono text-lg tracking-widest">
            {code || '—'}
          </div>
          <button
            className={btnAlt + ' text-xs'}
            onClick={() => code && navigator.clipboard?.writeText(code)}
          >
            Copy code
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full ${phase === 'lobby' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span>{phase === 'joining' ? 'Connecting…' : 'Connected'}</span>
          <span className="text-slate-400">|</span>
          <span>Ping: <span className="font-mono">{rtt}ms</span></span>
          <button onClick={leave} className="ml-3 px-3 py-1 rounded bg-red-800 border border-red-500 text-xs">Leave</button>
        </div>
      </div>

      <div className="w-full max-w-6xl flex items-center gap-3 mb-2">
        <span className="text-slate-300 text-sm">Players:</span>
        {roster.map(r => (
          <span key={r.playerId} className={`px-2 py-1 rounded text-sm ${r.side === 'left' ? 'bg-sky-900/70 border border-sky-500' : 'bg-rose-900/70 border border-rose-500'}`}>
            {r.name} <span className="text-xs opacity-60">({r.side})</span>
          </span>
        ))}
        {roster.length < 2 && (
          <span className="text-slate-400 text-sm italic">
            {roster.length === 0 ? 'Waiting…' : 'Share the code with a friend to fill the other slot.'}
          </span>
        )}
      </div>

      <div style={{ width: ARENA_W * scale, height: ARENA_H * scale }} className="relative">
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          style={{ width: ARENA_W * scale, height: ARENA_H * scale, background: '#000' }}
          className="rounded-xl border border-slate-700"
        />
      </div>

      <p className="text-slate-400 text-sm mt-3">
        Controls: <span className="font-mono text-cyan-300">A / D</span> or arrows to move · <span className="font-mono text-cyan-300">W / Space</span> to jump
      </p>
    </div>
  )
}
