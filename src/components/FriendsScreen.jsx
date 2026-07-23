import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Screen } from './Menus.jsx'
import {
  loadFriendsAndRequests, sendFriendRequest, acceptFriendRequest,
  rejectFriendRequest, unfriend, searchUsers, isOnline,
} from '../lib/friends.js'
import { sfx } from '../game/sfx.js'

export default function FriendsScreen({ session, onBack }) {
  const uid = session?.user?.id
  const [tab, setTab] = useState('friends') // friends | requests | add
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')

  const refresh = async () => {
    if (!uid) return
    setLoading(true); setErr('')
    try {
      const d = await loadFriendsAndRequests(uid)
      setData(d)
    } catch (e) { setErr(e?.message || 'Failed to load') }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [uid])

  const incomingCount = data.incoming.length

  return (
    <Screen title="FRIENDS" onBack={onBack}>
      {!uid ? (
        <div className="text-center text-slate-300 py-10">Sign in to use friends.</div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-4">
            <TabBtn active={tab==='friends'}  onClick={() => { sfx.click(); setTab('friends')  }}>
              Friends <span className="ml-1 text-xs text-slate-400">({data.friends.length})</span>
            </TabBtn>
            <TabBtn active={tab==='requests'} onClick={() => { sfx.click(); setTab('requests') }}>
              Requests {incomingCount > 0 && (
                <span className="ml-1 inline-flex w-5 h-5 items-center justify-center rounded-full bg-amber-400 text-slate-900 text-[10px] font-black">{incomingCount}</span>
              )}
            </TabBtn>
            <TabBtn active={tab==='add'}      onClick={() => { sfx.click(); setTab('add')      }}>
              Add Friend
            </TabBtn>
          </div>

          {err && <div className="text-red-400 text-center mb-3">{err}</div>}
          {loading && <div className="text-slate-300 text-center py-6">Loading…</div>}

          {!loading && tab === 'friends' && (
            <FriendsList
              friends={data.friends}
              busy={busy}
              onRemove={async (row) => {
                if (!confirm(`Remove ${row.other.display_name} from friends?`)) return
                setBusy(row.rowId); await unfriend(row.rowId); setBusy(null); refresh()
              }}
            />
          )}

          {!loading && tab === 'requests' && (
            <RequestsList
              incoming={data.incoming}
              outgoing={data.outgoing}
              busy={busy}
              onAccept={async (row) => {
                setBusy(row.rowId); await acceptFriendRequest(row.rowId); setBusy(null); sfx.match?.() || sfx.click?.(); refresh()
              }}
              onReject={async (row) => {
                setBusy(row.rowId); await rejectFriendRequest(row.rowId); setBusy(null); refresh()
              }}
              onCancel={async (row) => {
                setBusy(row.rowId); await rejectFriendRequest(row.rowId); setBusy(null); refresh()
              }}
            />
          )}

          {!loading && tab === 'add' && (
            <AddFriendTab uid={uid} existing={data} onSent={refresh} />
          )}
        </div>
      )}
    </Screen>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm font-bold ${active ? 'bg-amber-500/20 border-amber-400 text-amber-100' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
      {children}
    </button>
  )
}

function Presence({ lastSeen }) {
  const on = isOnline(lastSeen)
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${on ? 'text-emerald-300' : 'text-slate-500'}`}>
      <span className={`w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      {on ? 'Online' : 'Offline'}
    </span>
  )
}

function FriendCard({ other, right }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-700">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-600 flex items-center justify-center">
        {other.avatar_url ? (
          <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-400 text-lg">{(other.display_name || '?')[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate">{other.display_name || 'Player'}</div>
        <Presence lastSeen={other.last_seen_at} />
      </div>
      {right}
    </div>
  )
}

function FriendsList({ friends, busy, onRemove }) {
  if (!friends.length) return <div className="text-slate-300 text-center py-6">No friends yet. Send a request from the Add Friend tab.</div>
  return (
    <div className="space-y-2">
      {friends.map(row => (
        <FriendCard key={row.rowId} other={row.other}
          right={
            <button onClick={() => onRemove(row)}
              disabled={busy === row.rowId}
              className="chip-btn text-xs text-red-300 hover:text-red-200">Remove</button>
          } />
      ))}
    </div>
  )
}

function RequestsList({ incoming, outgoing, busy, onAccept, onReject, onCancel }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm uppercase tracking-widest text-amber-300 mb-2">Incoming</div>
        {!incoming.length ? (
          <div className="text-slate-400 text-sm">No incoming requests.</div>
        ) : incoming.map(row => (
          <FriendCard key={row.rowId} other={row.other}
            right={
              <div className="flex gap-2">
                <button onClick={() => onAccept(row)} disabled={busy === row.rowId} className="arcade-btn text-xs py-1 px-2">Accept</button>
                <button onClick={() => onReject(row)} disabled={busy === row.rowId} className="chip-btn text-xs">Reject</button>
              </div>
            } />
        ))}
      </div>
      <div>
        <div className="text-sm uppercase tracking-widest text-slate-400 mb-2">Outgoing</div>
        {!outgoing.length ? (
          <div className="text-slate-400 text-sm">No outgoing requests.</div>
        ) : outgoing.map(row => (
          <FriendCard key={row.rowId} other={row.other}
            right={
              <button onClick={() => onCancel(row)} disabled={busy === row.rowId} className="chip-btn text-xs">Cancel</button>
            } />
        ))}
      </div>
    </div>
  )
}

function AddFriendTab({ uid, existing, onSent }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const debRef = useRef(null)

  const known = useMemo(() => {
    const s = new Set()
    for (const r of existing.friends) s.add(r.otherId)
    for (const r of existing.incoming) s.add(r.otherId)
    for (const r of existing.outgoing) s.add(r.otherId)
    return s
  }, [existing])

  useEffect(() => {
    clearTimeout(debRef.current)
    if (!q || q.length < 2) { setResults([]); return }
    debRef.current = setTimeout(async () => {
      const r = await searchUsers(q, uid)
      setResults(r)
    }, 250)
    return () => clearTimeout(debRef.current)
  }, [q, uid])

  const send = async (row) => {
    setBusy(row.id); setMsg('')
    const res = await sendFriendRequest(uid, row.id)
    setBusy(null)
    if (res.ok) {
      setMsg(res.accepted ? `Now friends with ${row.display_name}!` : `Request sent to ${row.display_name}.`)
      onSent && onSent()
    } else {
      setMsg(res.error || 'Failed to send')
    }
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by username…"
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white outline-none focus:border-amber-400"
      />
      {msg && <div className="text-sm text-emerald-300 mt-2">{msg}</div>}
      <div className="mt-3 space-y-2">
        {q.length >= 2 && !results.length && (
          <div className="text-slate-400 text-sm text-center py-4">No players found.</div>
        )}
        {results.map(row => {
          const already = known.has(row.id)
          return (
            <FriendCard key={row.id} other={row}
              right={
                already ? (
                  <span className="text-xs text-slate-400">Already added</span>
                ) : (
                  <button onClick={() => send(row)} disabled={busy === row.id}
                    className="arcade-btn text-xs py-1 px-3">
                    {busy === row.id ? '…' : 'Add'}
                  </button>
                )
              } />
          )
        })}
      </div>
    </div>
  )
}
