// Party invites — signal a friend into an online match code.
import { supabase } from './supabase.js'

// Send a pending invite to a friend. Idempotent-ish: if an unexpired
// pending invite from you to them for the same code exists, does nothing.
export async function sendPartyInvite({ fromId, toId, joinCode, matchType = '1v1', message = null }) {
  if (!fromId || !toId || !joinCode) return { ok: false, error: 'missing fields' }
  const { data: existing } = await supabase
    .from('party_invites')
    .select('id')
    .eq('from_id', fromId)
    .eq('to_id', toId)
    .eq('join_code', joinCode)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (existing) return { ok: true, dedup: true }

  const { error } = await supabase.from('party_invites').insert({
    from_id: fromId, to_id: toId, join_code: joinCode, match_type: matchType, message,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// All pending invites addressed to me that haven't expired.
// Joins the sender's profile for display.
export async function loadIncomingInvites(userId) {
  if (!userId) return []
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from('party_invites')
    .select('id, from_id, join_code, match_type, message, created_at, expires_at')
    .eq('to_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
  const rows = data || []
  if (!rows.length) return []
  const senderIds = Array.from(new Set(rows.map(r => r.from_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', senderIds)
  const byId = new Map((profiles || []).map(p => [p.id, p]))
  return rows.map(r => ({ ...r, sender: byId.get(r.from_id) || { id: r.from_id, display_name: 'Player' } }))
}

export async function acceptInvite(rowId) {
  const { error } = await supabase.from('party_invites')
    .update({ status: 'accepted' }).eq('id', rowId)
  return { ok: !error, error: error?.message }
}

export async function declineInvite(rowId) {
  const { error } = await supabase.from('party_invites').delete().eq('id', rowId)
  return { ok: !error, error: error?.message }
}
