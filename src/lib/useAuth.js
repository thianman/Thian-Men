import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'
import { ensureProgression, loadProgression } from './progression.js'
import { ensureDailyChallenges, tickLoginStreak } from './daily.js'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [progression, setProgression] = useState(null) // { progression, unlocked:Set, mastery }
  const [streakReward, setStreakReward] = useState(null) // { streak, reward, ... }
  const [loading, setLoading] = useState(true)

  const loadProgressionState = useCallback(async (uid) => {
    if (!uid) { setProgression(null); return }
    await ensureProgression(uid)
    const p = await loadProgression(uid)
    // Fire the daily streak + daily challenge roll on session ready.
    // Only reward once per UTC day (tickLoginStreak is idempotent).
    const streak = await tickLoginStreak(uid, p?.progression)
    if (streak?.rewarded) setStreakReward(streak)
    await ensureDailyChallenges(uid)
    // Reload progression to include the streak reward
    const p2 = streak?.rewarded ? await loadProgression(uid) : p
    setProgression(p2)
  }, [])

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, country, email, is_adult, avatar_url, created_at')
      .eq('id', uid)
      .maybeSingle()
    if (!error) setProfile(data)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session || null)
      const uid = data.session?.user?.id
      Promise.all([loadProfile(uid), loadProgressionState(uid)])
        .finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      loadProfile(s?.user?.id)
      loadProgressionState(s?.user?.id)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [loadProfile, loadProgressionState])

  const signInWithEmail = useCallback(async (email) => {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    })
  }, [])

  // Verify the OTP code from the email. signInWithOtp with an email uses the
  // magic-link flow, whose OTP is verified with type 'email'. Some Supabase
  // versions also accept 'magiclink'. Try 'email' first, fall back to
  // 'magiclink' if that returns an "expired/invalid" error, since the code
  // could be either depending on the project's auth version.
  const verifyEmailCode = useCallback(async (email, token) => {
    const first = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (!first.error) return first
    // Only fall through on the type-mismatch style error, not real failures
    const msg = (first.error?.message || '').toLowerCase()
    if (msg.includes('expired') || msg.includes('invalid')) {
      const second = await supabase.auth.verifyOtp({ email, token, type: 'magiclink' })
      if (!second.error) return second
    }
    return first
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const saveProfile = useCallback(async ({ display_name, country, is_adult, avatar_url }) => {
    if (!session?.user) return { error: new Error('Not signed in') }
    const payload = {
      id: session.user.id,
      display_name,
      country,
      email: session.user.email,
      is_adult: !!is_adult,
    }
    if (avatar_url !== undefined) payload.avatar_url = avatar_url
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (!error) await loadProfile(session.user.id)
    return { error }
  }, [session, loadProfile])

  return {
    session, profile, progression, loading,
    streakReward,
    dismissStreak: () => setStreakReward(null),
    signInWithEmail, verifyEmailCode, signOut, saveProfile,
    refreshProfile: () => loadProfile(session?.user?.id),
    refreshProgression: () => loadProgressionState(session?.user?.id),
  }
}
