import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, country, email, is_adult, created_at')
      .eq('id', uid)
      .maybeSingle()
    if (!error) setProfile(data)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session || null)
      loadProfile(data.session?.user?.id).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      loadProfile(s?.user?.id)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const signInWithEmail = useCallback(async (email) => {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    })
  }, [])

  // Verify a 6-digit code from the email, so users can sign in on a device
  // that never received the link (e.g. checked their inbox on their phone).
  const verifyEmailCode = useCallback(async (email, token) => {
    return supabase.auth.verifyOtp({ email, token, type: 'email' })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const saveProfile = useCallback(async ({ display_name, country, is_adult }) => {
    if (!session?.user) return { error: new Error('Not signed in') }
    const payload = {
      id: session.user.id,
      display_name,
      country,
      email: session.user.email,
      is_adult: !!is_adult,
    }
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (!error) await loadProfile(session.user.id)
    return { error }
  }, [session, loadProfile])

  return { session, profile, loading, signInWithEmail, verifyEmailCode, signOut, saveProfile, refreshProfile: () => loadProfile(session?.user?.id) }
}
