// Friends + presence.
// Presence = profiles.last_seen_at within the last N minutes.
import { supabase } from './supabase.js'

const ONLINE_WINDOW_MS = 2 * 60 * 1000 // considered online if seen in last 2 min
let heartbeatTimer = null

export function isOnline(lastSeen) {
  if (!lastSeen) return false
  const t = typeof lastSeen === 'string' ? Date.parse(lastSeen) : +lastSeen
  return Number.isFinite(t) && (Date.now() - t) < ONLINE_WINDOW_MS
}

// Ping presence every minute. Call once from useAuth on session ready.
export function startPresenceHeartbeat(userId) {
  if (!userId) return
  stopPresenceHeartbeat()
  const beat = () => {
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {}, () => {})
  }
  beat()
  heartbeatTimer = setInterval(beat, 60 * 1000)
}
export function stopPresenceHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
}

// Look up profiles by username substring, excluding self.
export async function searchUsers(query, selfId) {
  const q = (query || '').trim()
  if (q.length < 2) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, last_seen_at, country')
    .ilike('display_name', `%${q}%`)
    .neq('id', selfId)
    .limit(20)
  return data || []
}

// Send a friend request. If reverse already exists as pending, accept it.
export async function sendFriendRequest(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return { ok: false, error: 'invalid' }
  // Check for reverse pending
  const { data: rev } = await supabase
    .from('friendships')
    .select('*')
    .eq('requester_id', toId)
    .eq('addressee_id', fromId)
    .maybeSingle()
  if (rev && rev.status === 'pending') {
    const { error } = await supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', rev.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, accepted: true }
  }
  const { error } = await supabase.from('friendships').insert({
    requester_id: fromId, addressee_id: toId, status: 'pending',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function acceptFriendRequest(rowId) {
  const { error } = await supabase.from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', rowId)
  return { ok: !error, error: error?.message }
}

export async function rejectFriendRequest(rowId) {
  const { error } = await supabase.from('friendships').delete().eq('id', rowId)
  return { ok: !error, error: error?.message }
}

export async function unfriend(rowId) {
  const { error } = await supabase.from('friendships').delete().eq('id', rowId)
  return { ok: !error, error: error?.message }
}

// Return { friends, incoming, outgoing } — each is a list of
// { rowId, otherId, otherProfile: {display_name, avatar_url, last_seen_at, country}, status }
export async function loadFriendsAndRequests(userId) {
  if (!userId) return { friends: [], incoming: [], outgoing: [] }
  const { data: rows } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, updated_at')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (!rows || !rows.length) return { friends: [], incoming: [], outgoing: [] }

  const otherIds = Array.from(new Set(rows.map(r => r.requester_id === userId ? r.addressee_id : r.requester_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, last_seen_at, country')
    .in('id', otherIds)
  const byId = new Map((profiles || []).map(p => [p.id, p]))

  const friends = [], incoming = [], outgoing = []
  for (const r of rows) {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id
    const other = byId.get(otherId) || { id: otherId, display_name: 'Unknown' }
    const entry = { rowId: r.id, otherId, other, status: r.status }
    if (r.status === 'accepted') friends.push(entry)
    else if (r.status === 'pending') {
      if (r.addressee_id === userId) incoming.push(entry)
      else outgoing.push(entry)
    }
  }
  return { friends, incoming, outgoing }
}
