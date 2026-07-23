import React, { useEffect, useState } from 'react'
import { loadFriendsAndRequests, isOnline } from '../lib/friends.js'
import { sendPartyInvite } from '../lib/party.js'
import { sfx } from '../game/sfx.js'

// Modal that lists the caller's accepted friends. Clicking Invite fires a
// party_invite row addressed at that friend, referencing the current
// online match code + type.
export default function FriendPicker({ session, joinCode, matchType, onClose }) {
  const uid = session?.user?.id
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState({})  // { [friendId]: 'sent' | 'error' }
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    loadFriendsAndRequests(uid).then(d => { setFriends(d.friends); setLoading(false) })
  }, [uid])

  const invite = async (row) => {
    setErr('')
    const res = await sendPartyInvite({
      fromId: uid, toId: row.otherId,
      joinCode, matchType,
    })
    setSent(s => ({ ...s, [row.otherId]: res.ok ? 'sent' : 'error' }))
    if (!res.ok) setErr(res.error || 'Failed to send')
    else sfx.click?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/40 shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-300">Invite a friend</div>
            <div className="text-lg font-bold">Room <span className="font-mono text-cyan-300">{joinCode}</span></div>
          </div>
          <button onClick={onClose} className="chip-btn text-sm">Close</button>
        </div>

        {err && <div className="text-red-400 text-sm mb-2">{err}</div>}

        {loading ? (
          <div className="text-slate-300 text-center py-6">Loading friends…</div>
        ) : !friends.length ? (
          <div className="text-slate-300 text-center py-6">No friends yet. Add some from the title screen.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {friends.map(row => {
              const on = isOnline(row.other?.last_seen_at)
              const st = sent[row.otherId]
              return (
                <div key={row.rowId} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/70 border border-slate-700">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 border border-slate-600 flex items-center justify-center">
                    {row.other?.avatar_url ? (
                      <img src={row.other.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-400">{(row.other?.display_name || '?')[0]?.toUpperCase()}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{row.other?.display_name || 'Player'}</div>
                    <div className={`text-xs ${on ? 'text-emerald-300' : 'text-slate-500'}`}>{on ? 'Online' : 'Offline'}</div>
                  </div>
                  {st === 'sent' ? (
                    <span className="text-xs text-emerald-300">✓ Sent</span>
                  ) : (
                    <button
                      onClick={() => invite(row)}
                      className="arcade-btn text-xs py-1 px-3"
                    >
                      Invite
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
