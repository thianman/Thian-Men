import React, { useEffect, useState } from 'react'
import { CHARACTERS } from '../game/constants.js'
import { CloudflareTransport } from '../net/cfTransport.js'
import { countryName } from '../lib/countries.js'
import { sfx } from '../game/sfx.js'

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  const hun = Math.floor((ms % 1000) / 10)
  return `${m}:${String(rem).padStart(2, '0')}.${String(hun).padStart(2, '0')}`
}

function flagEmoji(code) {
  if (!code || code.length !== 2) return '🏳️'
  const cc = code.toUpperCase()
  const A = 0x1F1E6, off = 'A'.charCodeAt(0)
  return String.fromCodePoint(A + cc.charCodeAt(0) - off, A + cc.charCodeAt(1) - off)
}

export default function GlobalLeaderboard({ onBack }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    const q = filter === 'all' ? {} : { character: filter }
    CloudflareTransport.fetchLeaderboard({ ...q, limit: 30 })
      .then(setRows)
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-start text-white p-4 overflow-y-auto">
      <h1 className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 text-center">GLOBAL LEADERBOARD</h1>
      <p className="text-slate-300 mb-4 text-center">Fastest Survival Ladder clears from around the world.</p>

      <div className="max-w-3xl w-full mx-auto mb-4">
        <div className="flex flex-wrap gap-2 items-center justify-center">
          <button onClick={() => { sfx.click(); setFilter('all') }}
            className={`px-3 py-1 rounded-full border text-sm ${filter === 'all' ? 'bg-cyan-800 border-cyan-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
            All fighters
          </button>
          {CHARACTERS.map(c => (
            <button key={c.id} onClick={() => { sfx.click(); setFilter(c.id) }}
              className={`px-3 py-1 rounded-full border text-sm flex items-center gap-1 ${filter === c.id ? 'bg-cyan-800 border-cyan-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="text-center text-slate-400 py-10">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-400 py-10">
            No runs yet — be the first to submit a clear!
          </div>
        ) : (
          <div className="bg-slate-900/70 rounded-2xl border border-slate-700 divide-y divide-slate-800 overflow-hidden">
            {rows.map((r, i) => {
              const c = CHARACTERS.find(ch => ch.id === r.character)
              const rankColor = i === 0 ? 'text-amber-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'
              return (
                <div key={r.id || i} className="flex items-center gap-4 px-4 py-3">
                  <div className={`w-10 text-center font-black text-xl ${rankColor}`}>#{i + 1}</div>
                  <div className="text-2xl w-10 text-center" title={countryName(r.country)}>{flagEmoji(r.country)}</div>
                  <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: c?.color || '#666' }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{r.display_name}</div>
                    <div className="text-xs text-slate-400 truncate">{c?.name || r.character}</div>
                  </div>
                  <div className="text-xl font-mono font-black text-cyan-300">{formatTime(r.time_ms)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button onClick={onBack} className="mt-6 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm">← Back</button>
    </div>
  )
}
