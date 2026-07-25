import React, { useEffect, useRef, useState } from 'react'
import { Screen } from './Menus.jsx'
import { sfx } from '../game/sfx.js'
import { ensureRanked, joinQueue, leaveQueue, tryMatchmake, pollMyQueue } from '../lib/ranked.js'
import { tierFromMmr, PLACEMENT_MATCHES } from '../game/rankedConstants.js'

export default function RankedScreen({ session, onEnterMatch, onBack }) {
  const uid = session?.user?.id
  const [profile, setProfile] = useState(null)
  const [state, setState] = useState('idle')   // 'idle' | 'queueing' | 'found' | 'error'
  const [queuedAt, setQueuedAt] = useState(null)
  const [waitSec, setWaitSec] = useState(0)
  const [err, setErr] = useState('')
  const tickerRef = useRef(null)

  useEffect(() => {
    if (!uid) return
    ensureRanked(uid).then(setProfile)
  }, [uid])

  // Queue polling loop
  useEffect(() => {
    if (state !== 'queueing' || !uid) return
    let cancelled = false
    const loop = async () => {
      if (cancelled) return
      try {
        // First check if someone matched us
        const mine = await pollMyQueue(uid)
        if (cancelled) return
        if (mine?.status === 'matched' && mine.room_code) {
          setState('found')
          sfx.match?.() || sfx.click?.()
          onEnterMatch(mine.room_code)
          return
        }
        // Try to matchmake ourselves
        const found = await tryMatchmake(uid, profile.mmr, queuedAt)
        if (cancelled) return
        if (found?.room_code) {
          setState('found')
          sfx.match?.() || sfx.click?.()
          onEnterMatch(found.room_code)
          return
        }
      } catch (e) { setErr(e?.message || 'Matchmaking failed') }
      tickerRef.current = setTimeout(loop, 3000)
    }
    tickerRef.current = setTimeout(loop, 500)
    return () => { cancelled = true; clearTimeout(tickerRef.current) }
  }, [state, uid, profile, queuedAt, onEnterMatch])

  // Wait-timer ticker
  useEffect(() => {
    if (state !== 'queueing' || !queuedAt) return
    const iv = setInterval(() => {
      setWaitSec(Math.max(0, Math.round((Date.now() - Date.parse(queuedAt)) / 1000)))
    }, 500)
    return () => clearInterval(iv)
  }, [state, queuedAt])

  const findMatch = async () => {
    if (!uid || !profile) return
    setErr('')
    const res = await joinQueue(uid, profile.mmr)
    if (!res.ok) { setErr(res.error || 'Failed to join queue'); return }
    setQueuedAt(new Date().toISOString())
    setState('queueing')
    sfx.click?.()
  }

  const cancel = async () => {
    if (!uid) return
    await leaveQueue(uid)
    setState('idle'); setQueuedAt(null); setWaitSec(0)
  }

  if (!uid) return <Screen title="RANKED" onBack={onBack}><div className="text-slate-300 text-center py-10">Sign in to play ranked.</div></Screen>
  if (!profile) return <Screen title="RANKED" onBack={onBack}><div className="text-slate-300 text-center py-10">Loading…</div></Screen>

  const tier = tierFromMmr(profile.mmr)
  const winRate = profile.wins + profile.losses > 0 ? Math.round(100 * profile.wins / (profile.wins + profile.losses)) : 0
  const inPlacement = profile.placement_left > 0

  return (
    <Screen title="RANKED" subtitle={inPlacement ? `Placement matches: ${profile.placement_left} of ${PLACEMENT_MATCHES} left` : 'Season 1 · Best of 3 rounds per match'} onBack={onBack}>
      <div className="max-w-lg mx-auto">
        {/* Rank card */}
        <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 p-6 mb-4 shadow-2xl"
          style={{ borderColor: tier.color }}>
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-slate-400">Current Tier</div>
            <div className="text-4xl font-black mt-1" style={{ color: tier.color, textShadow: `0 0 20px ${tier.color}` }}>
              {tier.name.toUpperCase()}
            </div>
            {inPlacement ? (
              <div className="text-slate-300 mt-2 text-sm italic">MMR hidden during placement</div>
            ) : (
              <div className="text-2xl font-mono font-black text-white mt-1">{profile.mmr} MMR</div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded bg-slate-800/70 p-2">
                <div className="text-slate-400 text-xs">Wins</div>
                <div className="text-emerald-300 font-black">{profile.wins}</div>
              </div>
              <div className="rounded bg-slate-800/70 p-2">
                <div className="text-slate-400 text-xs">Losses</div>
                <div className="text-red-300 font-black">{profile.losses}</div>
              </div>
              <div className="rounded bg-slate-800/70 p-2">
                <div className="text-slate-400 text-xs">Win Rate</div>
                <div className="text-cyan-300 font-black">{winRate}%</div>
              </div>
            </div>
            {!inPlacement && (
              <div className="text-xs text-slate-400 mt-2">Peak: {profile.peak_mmr} MMR</div>
            )}
          </div>
        </div>

        {err && <div className="text-red-400 text-center mb-3">{err}</div>}

        {state === 'idle' && (
          <button onClick={findMatch} className="arcade-btn text-xl w-full">🏆 Find Match</button>
        )}
        {state === 'queueing' && (
          <div className="rounded-2xl bg-slate-900 border border-cyan-400/60 p-5 text-center">
            <div className="text-cyan-300 font-black uppercase tracking-widest text-sm">Searching for opponent</div>
            <div className="text-4xl font-mono font-black text-white mt-2 tabular-nums">{waitSec}s</div>
            <div className="text-xs text-slate-400 mt-1">MMR ±{waitSec < 20 ? 100 : waitSec < 45 ? 250 : waitSec < 90 ? 500 : '∞'}</div>
            <button onClick={cancel} className="chip-btn mt-4">Cancel</button>
          </div>
        )}
        {state === 'found' && (
          <div className="rounded-2xl bg-emerald-900/50 border border-emerald-400 p-5 text-center">
            <div className="text-emerald-300 font-black uppercase tracking-widest">Match found — joining…</div>
          </div>
        )}
      </div>
    </Screen>
  )
}
