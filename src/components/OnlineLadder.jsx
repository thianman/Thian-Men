import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CloudflareTransport } from '../net/cfTransport.js'
import { CHARACTERS, MAPS, ARENA_W, ARENA_H, FLOOR_Y } from '../game/constants.js'
import { sfx } from '../game/sfx.js'
import { countryName } from '../lib/countries.js'
import { TouchControls, isMobile as detectMobile } from './TouchControls.jsx'
import { getAvatarImage } from '../lib/avatars.js'
import { characterUnlockInfo } from '../lib/progression.js'
import CharacterPose, { poseVerb } from './CharacterPose.jsx'
import { STAT_STARS } from '../game/constants.js'
import { drawHumanFigure } from '../game/render.js'

const btn = 'px-6 py-3 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow-lg border border-cyan-300/40 disabled:opacity-40 disabled:cursor-not-allowed'
const btnBig = 'px-8 py-3 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-black text-xl border border-emerald-300/40 disabled:opacity-40 disabled:cursor-not-allowed'

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  const hun = Math.floor((ms % 1000) / 10)
  return `${m}:${String(rem).padStart(2, '0')}.${String(hun).padStart(2, '0')}`
}

export default function OnlineLadder({ profile, session, onExit, onLadderOver, progression }) {
  const [screen, setScreen] = useState('menu') // 'menu' | 'connecting' | 'select' | 'fighting' | 'end'
  const [error, setError] = useState('')
  const [rtt, setRtt] = useState(0)
  const [me, setMe] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [ladderOpponents, setLadderOpponents] = useState([])
  const [currentFight, setCurrentFight] = useState(null) // { index, total, opponent, mapId }
  const [snap, setSnap] = useState(null)
  const [ladderEnd, setLadderEnd] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)
  const transportRef = useRef(null)
  const keysRef = useRef({})
  const prevKeysRef = useRef({})
  const inputTimerRef = useRef(null)
  const startedAtRef = useRef(null)
  const touchRef = useRef({})
  const [isMobile, setIsMobile] = useState(false)

  const name = profile?.display_name || 'Guest'

  const beginLadder = async () => {
    setError(''); setScreen('connecting')
    try {
      const t = new CloudflareTransport({
        name, userId: session?.user?.id, country: profile?.country || 'ZZ',
        avatarUrl: profile?.avatar_url,
      })
      const code = await t.createMatch('ladder')
      transportRef.current = t
      t.on('welcome',      (m) => setMe(m))
      t.on('lobby',        (m) => setLobby(m))
      t.on('ladderInfo',   (m) => setLadderOpponents(m.opponents))
      t.on('ladderFightStart', (m) => {
        setCurrentFight({ index: m.index, total: m.total, opponent: m.opponent, mapId: m.mapId })
        if (startedAtRef.current == null) startedAtRef.current = Date.now()
      })
      t.on('ladderFightWon', (m) => {
        setElapsedMs(m.elapsedMs)
      })
      t.on('ladderEnd',    (m) => {
        setLadderEnd(m); setScreen('end')
        if (onLadderOver) {
          const fightsWon = m.ok ? ladderOpponents.length : (m.atFight ?? 0)
          onLadderOver({ cleared: !!m.ok, fightsWon, character: lobby?.slots?.[0]?.character || null })
        }
      })
      t.on('state',        (m) => setSnap(m.snap))
      t.on('pong',         (r) => setRtt(r))
      t.on('error',        () => { setError('Connection error'); setScreen('menu') })
      t.on('disconnected', () => { if (screen !== 'end') setScreen('menu') })
      t.on('connected',    () => setScreen('select'))
      await t.join(code)
    } catch (e) { setError(e.message || 'Failed to start ladder'); setScreen('menu') }
  }

  const pickCharacter = (id) => transportRef.current?.setCharacter(id)
  const readyUp = () => { transportRef.current?.ready(); setScreen('fighting') }
  const leave = () => {
    if (transportRef.current) transportRef.current.disconnect()
    transportRef.current = null
    startedAtRef.current = null
    setScreen('menu'); setMe(null); setLobby(null); setCurrentFight(null); setSnap(null); setLadderEnd(null); setLadderOpponents([]); setElapsedMs(0)
  }

  // Live timer during fight (or between fights). The startedAt ref is
  // populated on ladderFightStart; the interval reads it each tick so
  // it "wakes up" even if the ref wasn't set when the effect first ran.
  useEffect(() => {
    if (screen !== 'fighting') return
    const t = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current)
    }, 33)
    return () => clearInterval(t)
  }, [screen])

  // Keyboard capture + mobile detection
  useEffect(() => {
    const d = e => { keysRef.current[e.code] = true }
    const u = e => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    const mobileCheck = () => setIsMobile(detectMobile())
    mobileCheck()
    window.addEventListener('resize', mobileCheck)
    return () => {
      window.removeEventListener('keydown', d); window.removeEventListener('keyup', u)
      window.removeEventListener('resize', mobileCheck)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'fighting') return
    inputTimerRef.current = setInterval(() => {
      const k = keysRef.current, pk = prevKeysRef.current, tc = touchRef.current, t = transportRef.current
      if (!t) return
      const catchKey = !!k.KeyG && !pk.KeyG
      const catchPressed = catchKey || !!tc.catchPressedOnce
      if (tc.catchPressedOnce) tc.catchPressedOnce = false
      t.sendInput({
        left:      !!k.KeyA || !!tc.left,
        right:     !!k.KeyD || !!tc.right,
        jump:      !!k.KeyW || !!tc.jump,
        duck:      !!k.KeyS || !!tc.duck,
        throwHeld: !!k.KeyF || !!tc.throwHeld,
        catchPressed,
      })
      prevKeysRef.current = { ...k }
    }, 33)
    return () => { if (inputTimerRef.current) clearInterval(inputTimerRef.current) }
  }, [screen])

  // Fit
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current; if (!el) return
      const rect = el.getBoundingClientRect()
      const s = Math.min(rect.width / ARENA_W, rect.height / ARENA_H)
      setScale(s)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [screen])

  // Render
  useEffect(() => {
    if (screen !== 'fighting') return
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    let raf = 0
    const draw = () => { raf = requestAnimationFrame(draw); drawGame(ctx, snap, me) }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [screen, snap, me])

  const lastEventsTick = useRef(-1)
  useEffect(() => {
    if (!snap?.events || snap.tick === lastEventsTick.current) return
    lastEventsTick.current = snap.tick
    for (const e of snap.events) {
      if (e.t === 'throw') sfx.throw()
      else if (e.t === 'catch') sfx.catch()
      else if (e.t === 'hit') sfx.hit()
      else if (e.t === 'jump') sfx.jump()
      else if (e.t === 'roundEnd') sfx.round()
    }
  }, [snap])

  if (screen === 'menu') return (
    <MenuLayout title="ONLINE LADDER" name={name} error={error} onExit={onExit}>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-slate-200 text-sm">
        <p>Face all 6 fighters back-to-back on a rising difficulty ladder. Your time is measured on the server, and clears go to the global leaderboard.</p>
        <ul className="list-disc pl-5 mt-3 space-y-1">
          <li>First to 3 rounds wins each fight (out of ~5 rounds)</li>
          <li>One life to fail — losing any fight ends the run</li>
          <li>Times below 30 seconds are rejected as impossible</li>
        </ul>
      </div>
      <button className={btn} onClick={beginLadder}>Start Ladder Run</button>
    </MenuLayout>
  )

  if (screen === 'connecting') return (
    <MenuLayout title="CONNECTING…" name={name}>
      <div className="text-center text-slate-300">Setting up your ladder run…</div>
    </MenuLayout>
  )

  if (screen === 'select') {
    const slot = lobby?.slots?.[0]
    const picked = slot?.character
    return (
      <MenuLayout title="PICK YOUR FIGHTER" name={name}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-2">
          {CHARACTERS.map(c => {
            const info = progression ? characterUnlockInfo(progression.unlocked, c.id, progression.progression?.level || 1) : { unlocked: true }
            const locked = progression && !info.unlocked
            return (
              <button key={c.id}
                disabled={locked}
                onClick={() => !locked && pickCharacter(c.id)}
                title={locked ? (info.kind === 'level' ? `Unlocks at Level ${info.at}` : `Buy in single-player menu (${info.price} coins)`) : c.name}
                className={`p-2 rounded-xl border-2 relative flex flex-col items-center ${locked ? 'opacity-50 border-slate-700 bg-slate-800/50 cursor-not-allowed' : picked === c.id ? 'border-amber-400 bg-amber-900/30' : 'border-slate-600 bg-slate-800 hover:border-slate-400'}`}>
                {locked && <span className="absolute top-1 right-1 text-sm">🔒</span>}
                <div className="w-full flex items-end justify-center rounded pose-hover" style={{ background: `radial-gradient(circle at 50% 30%, ${c.color}44, transparent 70%)`, height: 84 }}>
                  <CharacterPose character={c} size={60} />
                </div>
                <div className="text-xs font-bold mt-1">{c.name}</div>
                <div className="text-[9px] uppercase tracking-widest text-amber-300">{poseVerb(c.id)}</div>
                <div className="text-[10px] text-slate-300 mt-1 flex gap-1">
                  <span>SPD {STAT_STARS.speed[c.id]}</span>·
                  <span>STR {STAT_STARS.strength[c.id]}</span>·
                  <span>JMP {STAT_STARS.jump[c.id]}</span>
                </div>
              </button>
            )
          })}
        </div>
        <button className={btnBig} disabled={!picked} onClick={readyUp}>
          {picked ? 'BEGIN RUN' : 'Pick a fighter first'}
        </button>
        <button onClick={leave} className="mt-3 px-4 py-2 rounded bg-slate-800 border border-slate-600 text-sm mx-auto block">← Cancel</button>
      </MenuLayout>
    )
  }

  if (screen === 'end') return (
    <MenuLayout title={ladderEnd?.ok ? 'LADDER CLEARED!' : 'RUN ENDED'} name={name}>
      {ladderEnd?.ok ? (
        <div className="bg-gradient-to-r from-emerald-900/70 to-cyan-900/70 border border-emerald-500 rounded-2xl p-6 text-center">
          <div className="text-slate-200 text-sm uppercase tracking-wide">Clear Time</div>
          <div className="text-6xl font-black font-mono text-amber-300 mt-1">{formatTime(ladderEnd.timeMs)}</div>
          <div className="mt-3 text-sm">
            {ladderEnd.submitted ? (
              <span className="text-emerald-300">✓ Submitted to global leaderboard</span>
            ) : (
              <span className="text-red-300">Could not submit: {ladderEnd.submitError || 'unknown'}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 text-center">
          <div className="text-2xl font-bold text-red-300 mb-1">
            {ladderEnd?.reason === 'quit' ? 'You quit.' : `Lost at fight ${ (ladderEnd?.atFight ?? 0) + 1 } / ${ladderEnd?.totalFights ?? 6}`}
          </div>
          {ladderEnd?.timeMs > 0 && (
            <div className="text-slate-300 mt-2">Ran for <span className="font-mono">{formatTime(ladderEnd.timeMs)}</span></div>
          )}
        </div>
      )}
      <div className="flex gap-2 mt-4 justify-center">
        <button onClick={leave} className={btn}>Back to Menu</button>
      </div>
    </MenuLayout>
  )

  // fighting
  return (
    <div ref={wrapRef} className="w-screen h-screen flex flex-col items-center justify-start text-white p-2">
      <div className="w-full max-w-6xl flex items-center justify-between mb-2 text-sm">
        <div>
          Fight <span className="font-mono text-amber-300">{(currentFight?.index ?? 0) + 1}</span> / {currentFight?.total || 6}
          {currentFight?.opponent && (
            <>{' '}·{' '}<span className="text-fuchsia-300">vs {CHARACTERS.find(c => c.id === currentFight.opponent.character)?.name}</span>
              <span className="text-slate-400"> ({currentFight.opponent.difficulty})</span></>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-cyan-300 text-lg">{formatTime(elapsedMs)}</span>
          <span>Ping: <span className="font-mono">{rtt}ms</span></span>
          <button onClick={leave} className="px-3 py-1 rounded bg-red-800 border border-red-500 text-xs">Quit</button>
        </div>
      </div>
      <div style={{ width: ARENA_W * scale, height: ARENA_H * scale, position: 'relative' }}>
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H}
          style={{ width: ARENA_W * scale, height: ARENA_H * scale, background: '#000' }}
          className="rounded-xl border border-slate-700" />
      </div>
      <p className="text-slate-400 text-sm mt-2">
        <span className="font-mono text-cyan-300">A/D</span> move · <span className="font-mono text-cyan-300">W</span> jump · <span className="font-mono text-cyan-300">S</span> duck · <span className="font-mono text-cyan-300">F</span> throw (hold) · <span className="font-mono text-cyan-300">G</span> catch
      </p>
      {ladderOpponents.length > 0 && (
        <div className="mt-2 flex gap-1 flex-wrap justify-center">
          {ladderOpponents.map((o, i) => {
            const done = (currentFight?.index ?? -1) > i
            const now = (currentFight?.index ?? -1) === i
            const c = CHARACTERS.find(ch => ch.id === o.character)
            return (
              <div key={i} className={`px-2 py-0.5 rounded text-xs border ${done ? 'bg-emerald-800/60 border-emerald-500 text-emerald-100' : now ? 'bg-amber-800/60 border-amber-500 text-amber-100' : 'bg-slate-800/60 border-slate-600 text-slate-400'}`}>
                {c?.name || o.character}{done && ' ✓'}
              </div>
            )
          })}
        </div>
      )}
      {isMobile && <TouchControls touchRef={touchRef} />}
    </div>
  )
}

function MenuLayout({ title, name, children, error, onExit }) {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center text-white p-4 overflow-y-auto">
      <h1 className="text-4xl md:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 text-center">{title}</h1>
      <div className="w-full max-w-md grid gap-4">{children}</div>
      {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
      {onExit && (
        <button onClick={onExit} className="mt-6 px-4 py-2 rounded bg-slate-800 border border-slate-600 text-sm">← Back to Menu</button>
      )}
      <p className="text-slate-500 text-xs mt-3">Signed in as {name}</p>
    </div>
  )
}

// -- draw (compact copy shared with OnlineMatch) --
function drawGame(ctx, snap, me) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  if (!snap) return
  const map = MAPS.find(m => m.id === snap.mapId) || MAPS[0]
  const g = ctx.createLinearGradient(0, 0, 0, ARENA_H)
  g.addColorStop(0, map.bg[0]); g.addColorStop(1, map.bg[1])
  ctx.fillStyle = g; ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, FLOOR_Y, ARENA_W, ARENA_H - FLOOR_Y)
  ctx.fillStyle = map.accent; ctx.fillRect(0, FLOOR_Y - 4, ARENA_W, 4)
  for (const pl of map.platforms) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(pl.x, pl.y, pl.w, pl.h)
    ctx.fillStyle = map.accent; ctx.fillRect(pl.x, pl.y, pl.w, 3)
  }
  const midX = ARENA_W / 2
  const barrierGrad = ctx.createLinearGradient(midX - 8, 0, midX + 8, 0)
  barrierGrad.addColorStop(0.0, 'rgba(34,211,238,0)')
  barrierGrad.addColorStop(0.5, 'rgba(232,121,249,0.35)')
  barrierGrad.addColorStop(1.0, 'rgba(34,211,238,0)')
  ctx.fillStyle = barrierGrad
  ctx.fillRect(midX - 8, 0, 16, FLOOR_Y)
  ctx.strokeStyle = 'rgba(232,121,249,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6])
  ctx.beginPath(); ctx.moveTo(midX, 0); ctx.lineTo(midX, FLOOR_Y); ctx.stroke()
  ctx.setLineDash([])
  for (const b of snap.balls) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath(); ctx.ellipse(b.x, FLOOR_Y + 4, 14, 5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = b.uncatchable ? '#a855f7' : (b.live ? '#ef4444' : '#fbbf24')
    ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = b.uncatchable ? '#f0abfc' : '#7c2d12'; ctx.lineWidth = 2; ctx.stroke()
  }
  for (const p of snap.players) {
    const char = CHARACTERS.find(c => c.id === p.character) || {}
    const w = 56, h = p.ducking ? 48 : 96
    drawHumanFigure(ctx, {
      x: p.x, y: p.y, w, h, char,
      side: p.side, facing: p.facing, ducking: p.ducking, hitFlash: p.hitFlash,
      holdingBall: p.holdingBall, hp: p.hp,
      displayName: p.name, avatarUrl: p.avatarUrl,
    })
    if (me && p.playerId === me.playerId) {
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3
      ctx.strokeRect(p.x - 4, p.y - 4, w + 8, h + 8)
    }
    if (p.charging) {
      const bw = 60, bh = 8, bx = p.x + w/2 - bw/2, by = p.y - 34
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh)
      const pct = p.chargeVal
      ctx.fillStyle = pct > 0.85 ? '#ef4444' : pct > 0.5 ? '#f59e0b' : '#22c55e'
      ctx.fillRect(bx + 1, by + 1, (bw - 2) * pct, bh - 2)
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh)
    }
  }
  if (snap.phase === 'countdown') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, ARENA_H/2 - 80, ARENA_W, 160)
    ctx.fillStyle = snap.countdown > 0 ? '#fff' : '#22c55e'
    ctx.font = 'bold 96px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(snap.countdown > 0 ? String(snap.countdown) : 'GO!', ARENA_W/2, ARENA_H/2)
  } else if (snap.phase === 'roundEnd') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, ARENA_H/2 - 60, ARENA_W, 120)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 56px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(snap.winnerSide === 'left' ? 'Round!' : 'Lost.', ARENA_W/2, ARENA_H/2)
  } else if (snap.phase === 'matchEnd') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, ARENA_W, ARENA_H)
    ctx.fillStyle = snap.matchWinnerSide === 'left' ? '#22d3ee' : '#f87171'
    ctx.font = 'bold 96px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(snap.matchWinnerSide === 'left' ? 'FIGHT WON' : 'DEFEATED', ARENA_W/2, ARENA_H/2)
  }
}
function lighten(hex, amt) {
  const c = hex.replace('#', ''), num = parseInt(c, 16)
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b))
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6, '0')
}
