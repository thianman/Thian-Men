import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CloudflareTransport } from '../net/cfTransport.js'
import { CHARACTERS, MAPS, ARENA_W, ARENA_H, FLOOR_Y } from '../game/constants.js'
import { sfx } from '../game/sfx.js'

const btn = 'px-6 py-3 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow-lg border border-cyan-300/40 disabled:opacity-40 disabled:cursor-not-allowed'
const btnAlt = 'px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-semibold border border-slate-500'
const input = 'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:border-cyan-400 focus:outline-none text-white font-mono uppercase tracking-widest text-center text-2xl'

export default function OnlineMatch({ profile, onExit }) {
  const [screen, setScreen] = useState('menu') // 'menu' | 'connecting' | 'lobby' | 'match' | 'ended' | 'error'
  const [joinCode, setJoinCode] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [rtt, setRtt] = useState(0)
  const [me, setMe] = useState(null)          // { playerId, side, isHost }
  const [roster, setRoster] = useState([])
  const [lobby, setLobby] = useState(null)    // { left, right, mapId, state }
  const [snap, setSnap] = useState(null)      // gameplay snapshot
  const [matchEnd, setMatchEnd] = useState(null)
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)
  const transportRef = useRef(null)
  const keysRef = useRef({})
  const prevKeysRef = useRef({})
  const inputTimerRef = useRef(null)

  const name = profile?.display_name || 'Guest'

  // Connect / disconnect helpers
  const connect = async (roomCode) => {
    setError('')
    const t = new CloudflareTransport({ name })
    transportRef.current = t
    t.on('connected',   () => setScreen('lobby'))
    t.on('welcome',     (m) => { setMe({ playerId: m.playerId, side: m.side, isHost: m.isHost }); sfx.click() })
    t.on('roster',      (m) => setRoster(m.players))
    t.on('lobby',       (m) => setLobby(m))
    t.on('matchStart',  () => { setMatchEnd(null); setScreen('match') })
    t.on('state',       (m) => setSnap(m.snap))
    t.on('matchEnd',    (m) => { setMatchEnd(m); setScreen('ended') })
    t.on('pong',        (r) => setRtt(r))
    t.on('error',       () => { setError('Connection error'); setScreen('error') })
    t.on('disconnected', () => { setScreen('menu'); setRoster([]); setSnap(null); setMe(null); setLobby(null) })
    setScreen('connecting')
    try { await t.join(roomCode) }
    catch (e) { setError(e.message || 'Failed to join'); setScreen('error') }
  }

  const hostMatch = async () => {
    setError(''); setScreen('connecting')
    try {
      const t = new CloudflareTransport({ name })
      const c = await t.createMatch()
      transportRef.current = null
      setCode(c)
      await connect(c)
    } catch (e) { setError(e.message || 'Failed to create match'); setScreen('error') }
  }
  const doJoin = async () => {
    const c = joinCode.trim().toUpperCase()
    if (c.length < 4) return
    setCode(c); await connect(c)
  }
  const leave = () => {
    if (transportRef.current) transportRef.current.disconnect()
    transportRef.current = null
    setScreen('menu'); setRoster([]); setSnap(null); setMe(null); setLobby(null); setCode(''); setMatchEnd(null)
  }

  // Keyboard capture
  useEffect(() => {
    const d = e => { keysRef.current[e.code] = true }
    const u = e => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  // Input send loop (only when match is live)
  useEffect(() => {
    if (screen !== 'match') return
    inputTimerRef.current = setInterval(() => {
      const k = keysRef.current, pk = prevKeysRef.current, t = transportRef.current
      if (!t) return
      const catchPressed = !!k.KeyG && !pk.KeyG
      t.sendInput({
        left:  !!k.KeyA,
        right: !!k.KeyD,
        jump:  !!k.KeyW,
        duck:  !!k.KeyS,
        throwHeld: !!k.KeyF,
        catchPressed,
      })
      prevKeysRef.current = { ...k }
    }, 33)
    return () => { if (inputTimerRef.current) clearInterval(inputTimerRef.current) }
  }, [screen])

  // Fit canvas
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

  // Render snapshot
  useEffect(() => {
    if (screen !== 'match') return
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      drawGame(ctx, snap, me)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [screen, snap, me])

  // Play SFX for server events
  const lastEventsTick = useRef(-1)
  useEffect(() => {
    if (!snap || !snap.events || snap.tick === lastEventsTick.current) return
    lastEventsTick.current = snap.tick
    for (const e of snap.events) {
      if (e.t === 'throw') sfx.throw()
      else if (e.t === 'catch') sfx.catch()
      else if (e.t === 'hit') sfx.hit()
      else if (e.t === 'jump') sfx.jump()
      else if (e.t === 'roundEnd') sfx.round()
      else if (e.t === 'matchEnd') sfx.match()
    }
  }, [snap])

  // -------- Rendering paths --------
  if (screen === 'menu' || screen === 'error') return (
    <MenuLayout title="PLAY ONLINE" name={name} error={error} onExit={onExit}>
      <button className={btn} onClick={hostMatch}>Host Match</button>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <label className="block text-sm text-slate-300 mb-2">Join a friend's match with a code</label>
        <input className={input} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABCDEF" maxLength={6} />
        <button className={btn + ' w-full mt-3'} onClick={doJoin} disabled={joinCode.length < 4}>Join Match</button>
      </div>
    </MenuLayout>
  )

  if (screen === 'connecting') return (
    <MenuLayout title="CONNECTING…" name={name}>
      <div className="text-center text-slate-300">Establishing link with the server…</div>
    </MenuLayout>
  )

  if (screen === 'lobby' || screen === 'ended') return (
    <LobbyScreen
      code={code} rtt={rtt} me={me} roster={roster} lobby={lobby}
      matchEnd={matchEnd} onLeave={leave} name={name}
      onPickCharacter={(id) => transportRef.current?.setCharacter(id)}
      onPickMap={(id) => transportRef.current?.setMap(id)}
      onReady={() => transportRef.current?.ready()}
      onUnready={() => transportRef.current?.unready()}
      onRematch={() => transportRef.current?.rematch()}
    />
  )

  return (
    <div ref={wrapRef} className="w-screen h-screen flex flex-col items-center justify-start bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-2">
      <div className="w-full max-w-6xl flex items-center justify-between mb-2 text-sm">
        <div>Room <span className="font-mono text-cyan-300">{code}</span></div>
        <div className="flex items-center gap-3">
          <span>Ping: <span className="font-mono">{rtt}ms</span></span>
          {snap && (
            <span>Round <span className="font-mono">{snap.round}</span> · P1 <span className="font-mono">{snap.roundsLeft}</span> — <span className="font-mono">{snap.roundsRight}</span> P2</span>
          )}
          <button onClick={leave} className="px-3 py-1 rounded bg-red-800 border border-red-500 text-xs">Leave</button>
        </div>
      </div>
      <div style={{ width: ARENA_W * scale, height: ARENA_H * scale, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          style={{ width: ARENA_W * scale, height: ARENA_H * scale, background: '#000' }}
          className="rounded-xl border border-slate-700"
        />
      </div>
      <p className="text-slate-400 text-sm mt-2">
        <span className="font-mono text-cyan-300">A/D</span> move · <span className="font-mono text-cyan-300">W</span> jump · <span className="font-mono text-cyan-300">S</span> duck · <span className="font-mono text-cyan-300">F</span> throw (hold) · <span className="font-mono text-cyan-300">G</span> catch
      </p>
    </div>
  )
}

function MenuLayout({ title, name, children, error, onExit }) {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-4">
      <h1 className="text-4xl md:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300">{title}</h1>
      <div className="w-full max-w-md grid gap-4">{children}</div>
      {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
      {onExit && (
        <button onClick={onExit} className="mt-6 px-4 py-2 rounded bg-slate-800 border border-slate-600 text-sm">← Back to Menu</button>
      )}
      <p className="text-slate-500 text-xs mt-3">Signed in as {name}</p>
    </div>
  )
}

function LobbyScreen({ code, rtt, me, roster, lobby, matchEnd, onLeave, onPickCharacter, onPickMap, onReady, onUnready, onRematch, name }) {
  const mySide = me?.side
  const myPick = lobby ? lobby[mySide]?.character : null
  const myReady = lobby ? lobby[mySide]?.ready : false
  const oppSide = mySide === 'left' ? 'right' : 'left'
  const oppInfo = lobby ? lobby[oppSide] : null

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-4 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Room Code</div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-3xl tracking-widest text-cyan-300">{code || '—'}</div>
              <button onClick={() => code && navigator.clipboard?.writeText(code)} className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1">Copy</button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>Ping: <span className="font-mono">{rtt}ms</span></span>
            <button onClick={onLeave} className="px-3 py-1 rounded bg-red-800 border border-red-500 text-xs">Leave</button>
          </div>
        </div>

        {matchEnd && (
          <div className="mb-4 p-4 rounded-xl bg-slate-900/80 border-2 border-amber-400 text-center">
            <div className="text-3xl font-black">
              {matchEnd.winner === mySide ? '🏆 You Win!' : 'You Lose'}
            </div>
            {matchEnd.forfeit && <div className="text-slate-300 text-sm mt-1">Opponent disconnected — win by forfeit.</div>}
            <button onClick={onRematch} className="mt-3 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold">Rematch</button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <PlayerSlot title="You" side={mySide} me picks={lobby?.[mySide]} name={name} />
          <PlayerSlot title="Opponent" side={oppSide} picks={oppInfo} name={oppInfo?.name} waiting={roster.length < 2} />
        </div>

        <div className="mb-4">
          <div className="text-sm text-slate-300 mb-2">Pick your fighter</div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {CHARACTERS.map(c => (
              <button key={c.id}
                onClick={() => onPickCharacter(c.id)}
                className={`p-3 rounded-xl border-2 ${myPick === c.id ? 'border-amber-400 bg-amber-900/30' : 'border-slate-600 bg-slate-800 hover:border-slate-400'}`}>
                <div className="w-full h-8 rounded" style={{ background: c.color }} />
                <div className="text-xs font-bold mt-1">{c.name}</div>
              </button>
            ))}
          </div>
        </div>

        {me?.isHost && (
          <div className="mb-4">
            <div className="text-sm text-slate-300 mb-2">Map (host picks)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {MAPS.map(m => (
                <button key={m.id}
                  onClick={() => onPickMap(m.id)}
                  className={`p-3 rounded-xl border-2 text-left ${lobby?.mapId === m.id ? 'border-cyan-400 bg-cyan-900/30' : 'border-slate-600 bg-slate-800 hover:border-slate-400'}`}>
                  <div className="h-10 rounded" style={{ background: `linear-gradient(${m.bg[0]}, ${m.bg[1]})` }} />
                  <div className="text-xs font-bold mt-1">{m.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {!me?.isHost && lobby?.mapId && (
          <div className="text-sm text-slate-300 mb-4">Map: <span className="font-bold text-cyan-300">{MAPS.find(m => m.id === lobby.mapId)?.name || lobby.mapId}</span> (host chose)</div>
        )}

        <div className="text-center">
          {!myReady ? (
            <button onClick={onReady} disabled={!myPick || roster.length < 2}
              className="px-8 py-3 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-black text-xl border border-emerald-300/40 disabled:opacity-40 disabled:cursor-not-allowed">
              {roster.length < 2 ? 'Waiting for opponent…' : (!myPick ? 'Pick a fighter first' : 'READY UP')}
            </button>
          ) : (
            <button onClick={onUnready}
              className="px-8 py-3 rounded-xl bg-slate-800 border border-amber-400 text-amber-300 font-bold">
              Ready — click to cancel
            </button>
          )}
          <div className="mt-3 text-sm text-slate-400">
            You: {myReady ? '✅ Ready' : '⏳ Not ready'}
            {' · '}
            Opponent: {oppInfo?.ready ? '✅ Ready' : '⏳ Not ready'}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayerSlot({ title, side, picks, name, me, waiting }) {
  const char = picks?.character ? CHARACTERS.find(c => c.id === picks.character) : null
  const sideColor = side === 'left' ? 'border-sky-500' : 'border-rose-500'
  return (
    <div className={`p-4 rounded-xl border-2 bg-slate-900/60 ${sideColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400 uppercase">{title}</div>
          <div className="text-lg font-bold">{name || (waiting ? '(waiting…)' : '—')}</div>
          <div className="text-xs text-slate-500 mt-0.5">Side: {side}</div>
        </div>
        {char ? (
          <div className="flex items-center gap-2">
            <div className="w-14 h-14 rounded-lg" style={{ background: char.color }} />
            <div>
              <div className="font-black">{char.name}</div>
              <div className="text-xs text-slate-400">{char.vibe}</div>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 italic text-sm">No fighter picked</div>
        )}
      </div>
    </div>
  )
}

// ------------------- Canvas draw -------------------

function drawGame(ctx, snap, me) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  if (!snap) {
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 36px system-ui'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Waiting for server state…', ARENA_W / 2, ARENA_H / 2)
    return
  }
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
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([8, 10])
  ctx.beginPath(); ctx.moveTo(ARENA_W / 2, 0); ctx.lineTo(ARENA_W / 2, FLOOR_Y); ctx.stroke()
  ctx.setLineDash([])

  // Balls
  for (const b of snap.balls) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath(); ctx.ellipse(b.x, FLOOR_Y + 4, 14, 5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = b.uncatchable ? '#a855f7' : (b.live ? '#ef4444' : '#fbbf24')
    ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = b.uncatchable ? '#f0abfc' : '#7c2d12'; ctx.lineWidth = 2; ctx.stroke()
  }

  // Players
  for (const p of snap.players) {
    const char = CHARACTERS.find(c => c.id === p.character)
    const color = char?.color || '#888'
    const w = 56, h = p.ducking ? 48 : 96
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(p.x + w/2, p.y + h + 4, w/2, 6, 0, 0, Math.PI * 2); ctx.fill()
    // body
    ctx.fillStyle = p.hitFlash > 0 ? '#fff' : color
    ctx.fillRect(p.x + 4, p.y + 12, w - 8, h - 20)
    // head
    ctx.fillStyle = p.hitFlash > 0 ? '#fff' : lighten(color, 20)
    ctx.beginPath(); ctx.arc(p.x + w/2, p.y + 12, 14, 0, Math.PI * 2); ctx.fill()
    // outline
    ctx.strokeStyle = p.side === 'left' ? '#38bdf8' : '#f87171'
    ctx.lineWidth = 3; ctx.strokeRect(p.x + 2, p.y + 10, w - 4, h - 16)
    // "you" marker
    if (me && p.side === me.side) {
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3
      ctx.strokeRect(p.x - 4, p.y - 4, w + 8, h + 8)
    }
    // hp dots
    for (let i = 0; i < p.hp; i++) {
      ctx.fillStyle = '#22c55e'
      ctx.beginPath(); ctx.arc(p.x + w/2 - 12 + i * 12, p.y - 8, 4, 0, Math.PI * 2); ctx.fill()
    }
    // name
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'
    ctx.fillText(p.name || '', p.x + w/2, p.y - 20)
    // holding indicator
    if (p.holdingBall) {
      ctx.fillStyle = '#fde047'
      ctx.beginPath(); ctx.arc(p.x + w/2 + p.facing * 22, p.y + 34, 14, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 2; ctx.stroke()
    }
    // charge bar
    if (p.charging) {
      const bw = 60, bh = 8
      const bx = p.x + w/2 - bw/2, by = p.y - 34
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh)
      const pct = p.chargeVal
      ctx.fillStyle = pct > 0.85 ? '#ef4444' : pct > 0.5 ? '#f59e0b' : '#22c55e'
      ctx.fillRect(bx + 1, by + 1, (bw - 2) * pct, bh - 2)
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh)
    }
  }

  // Phase overlays
  if (snap.phase === 'countdown') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, ARENA_H/2 - 80, ARENA_W, 160)
    ctx.fillStyle = snap.countdown > 0 ? '#fff' : '#22c55e'
    ctx.font = 'bold 96px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(snap.countdown > 0 ? String(snap.countdown) : 'GO!', ARENA_W/2, ARENA_H/2)
  } else if (snap.phase === 'roundEnd') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, ARENA_H/2 - 60, ARENA_W, 120)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 56px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(snap.winnerSide === 'left' ? 'Round P1!' : 'Round P2!', ARENA_W/2, ARENA_H/2)
  } else if (snap.phase === 'matchEnd') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, ARENA_W, ARENA_H)
    ctx.fillStyle = snap.matchWinnerSide === 'left' ? '#22d3ee' : '#f87171'
    ctx.font = 'bold 96px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(snap.matchWinnerSide === 'left' ? 'P1 WINS' : 'P2 WINS', ARENA_W/2, ARENA_H/2)
  }
}

function lighten(hex, amt) {
  const c = hex.replace('#', '')
  const num = parseInt(c, 16)
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b))
  return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6, '0')
}
