import React, { useEffect, useState } from 'react'
import { Screen } from './Menus.jsx'
import { loadDailyChallenges, claimDailyChallenge, ensureDailyChallenges } from '../lib/daily.js'
import { findChallenge } from '../game/dailyConstants.js'
import { sfx } from '../game/sfx.js'
import LevelUpScreen from './LevelUpScreen.jsx'

export default function DailyChallengesScreen({ session, progression, onProgressionRefresh, onBack }) {
  const uid = session?.user?.id
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [claimResult, setClaimResult] = useState(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    // Roll today's challenges if they don't exist yet, then load.
    ensureDailyChallenges(uid)
      .then(() => loadDailyChallenges(uid))
      .then((r) => { if (!cancelled) { setRows(r); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [uid])

  const doClaim = async (row) => {
    if (!uid) return
    setBusy(row.challenge_id)
    const res = await claimDailyChallenge(uid, row, progression?.progression)
    setBusy(null)
    if (res.ok) {
      sfx.match?.() || sfx.click?.()
      setClaimResult({
        result: { ...res, gainedXp: res.xp, gainedCoin: res.coins, unlocked: [] },
        characterId: null,
      })
      const fresh = await loadDailyChallenges(uid)
      setRows(fresh)
      onProgressionRefresh && await onProgressionRefresh()
    }
  }

  return (
    <>
      <Screen title="DAILY CHALLENGES" subtitle="Resets every 24h. Complete to claim XP + coins." onBack={onBack}>
        {!uid ? (
          <div className="text-center text-slate-300 py-10">Sign in to receive daily challenges.</div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {rows.map((r) => {
              const def = findChallenge(r.challenge_id)
              const done = r.progress >= r.target
              const pct = Math.min(100, Math.round((r.progress / r.target) * 100))
              return (
                <div key={r.challenge_id} className="rounded-2xl border-2 border-amber-500/40 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-widest text-amber-300">{def?.label || r.challenge_id}</div>
                      <div className="text-lg font-bold text-white">{def?.desc(r) || `Complete ${r.target}`}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-cyan-300 font-bold">+{r.reward_xp} XP</div>
                      <div className="text-amber-200 font-bold">+{r.reward_coins} 🪙</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-3 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-300 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-sm font-mono text-slate-200">{r.progress}/{r.target}</div>
                    {r.claimed ? (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-sm">Claimed</div>
                    ) : done ? (
                      <button
                        onClick={() => doClaim(r)}
                        disabled={busy === r.challenge_id}
                        className="arcade-btn text-sm py-1.5 px-3"
                      >
                        {busy === r.challenge_id ? '…' : 'Claim'}
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-500 text-sm">Locked</div>
                    )}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="text-center text-slate-300 py-10">Loading today's challenges…</div>
            )}
            {!loading && !rows.length && (
              <div className="text-center text-slate-300 py-10">No challenges available. Try again in a moment.</div>
            )}
          </div>
        )}
      </Screen>
      {claimResult && (
        <LevelUpScreen
          result={claimResult.result}
          characterId={claimResult.characterId}
          onDone={() => setClaimResult(null)}
        />
      )}
    </>
  )
}
