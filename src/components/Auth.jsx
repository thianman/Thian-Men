import React, { useState } from 'react'
import { COUNTRIES, countryName } from '../lib/countries.js'
import { sfx } from '../game/sfx.js'

const btn = 'px-6 py-3 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow-lg border border-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed'
const btnAlt = 'px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-semibold border border-slate-500'
const input = 'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:border-cyan-400 focus:outline-none text-white'

function ScreenShell({ title, subtitle, onBack, children }) {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-4 overflow-y-auto">
      {title && <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 mb-2 text-center">{title}</h1>}
      {subtitle && <p className="text-slate-300 mb-6 text-center max-w-md">{subtitle}</p>}
      <div className="w-full max-w-md">{children}</div>
      {onBack && (
        <button onClick={() => { sfx.click(); onBack() }} className="mt-6 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm">
          ← Back
        </button>
      )}
    </div>
  )
}

export function SignInScreen({ onBack, onSignIn, onVerifyCode, onOpenLegal }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid email.'); return }
    setBusy(true); setError('')
    const { error } = await onSignIn(email.trim())
    setBusy(false)
    if (error) {
      console.error('[sign-in] error:', error, 'keys:', Object.keys(error || {}))
      const raw = error.message || error.error_description || error.msg || (error.status ? `HTTP ${error.status}` : '') || ''
      setError(raw || 'Sign-in failed. Open the browser console for details.')
    }
    else setSent(true)
  }

  const submitCode = async (e) => {
    e.preventDefault()
    if (verifyBusy) return
    const clean = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean)) { setError('Enter the 6-digit code from the email.'); return }
    setVerifyBusy(true); setError('')
    const { error } = await onVerifyCode(email.trim(), clean)
    setVerifyBusy(false)
    if (error) setError(error.message || error.error_description || JSON.stringify(error) || 'Invalid or expired code.')
    // On success, useAuth session update navigates us away automatically.
  }

  return (
    <ScreenShell title="SIGN IN" subtitle={sent ? "We sent a magic link + 6-digit code to your inbox. Use whichever is easier." : 'Enter your email. We\'ll send you a magic link and a 6-digit code — no password needed.'} onBack={onBack}>
      {!sent ? (
        <form onSubmit={submit} className="space-y-4">
          <input
            className={input}
            type="email"
            placeholder="you@example.com"
            value={email}
            autoFocus
            onChange={e => setEmail(e.target.value)}
          />
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button className={btn + ' w-full'} type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send Sign-in Email'}
          </button>
          <p className="text-xs text-slate-400 text-center">
            By continuing you agree to our{' '}
            <button type="button" className="underline text-cyan-300" onClick={() => onOpenLegal('tos')}>Terms</button>
            {' '}and{' '}
            <button type="button" className="underline text-cyan-300" onClick={() => onOpenLegal('privacy')}>Privacy Policy</button>.
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-800/70 border border-slate-600 rounded-xl p-6 text-center">
            <div className="text-6xl mb-2">📧</div>
            <div className="text-lg mb-1">Email sent to</div>
            <div className="font-mono text-cyan-300 mb-4 break-all">{email}</div>
            <div className="text-sm text-slate-300 mb-1"><b>Option 1:</b> click the link in the email — signs you in on whichever device opened it.</div>
            <div className="text-sm text-slate-300"><b>Option 2:</b> read the inbox on another device? Enter the 6-digit code below to sign in <em>right here</em>.</div>
          </div>
          <form onSubmit={submitCode} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-3 rounded-lg bg-slate-800 border border-slate-600 focus:border-cyan-400 focus:outline-none text-white font-mono text-3xl text-center tracking-widest"
              autoFocus
            />
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            <button className={btn + ' w-full'} type="submit" disabled={verifyBusy || code.length !== 6}>
              {verifyBusy ? 'Verifying…' : 'Verify code & sign in'}
            </button>
          </form>
          <div className="text-center">
            <button type="button" onClick={() => { setSent(false); setCode(''); setError('') }} className="text-xs text-slate-400 underline">Use a different email</button>
          </div>
        </div>
      )}
    </ScreenShell>
  )
}

export function RegisterScreen({ session, onSave, onOpenLegal, onSignOut }) {
  const [displayName, setDisplayName] = useState('')
  const [country, setCountry] = useState('')
  const [ageOk, setAgeOk] = useState(false)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const name = displayName.trim()
    if (name.length < 3 || name.length > 20) return setError('Display name must be 3–20 characters.')
    if (!/^[A-Za-z0-9 ._-]+$/.test(name)) return setError('Only letters, numbers, spaces, and . _ - allowed.')
    if (!country) return setError('Please pick your country.')
    if (!ageOk) return setError('You must be 13 or older to play.')
    if (!agree) return setError('Please accept the Terms and Privacy Policy.')
    setError(''); setBusy(true)
    const { error } = await onSave({ display_name: name, country, is_adult: true })
    setBusy(false)
    if (error) setError(error.message || 'Could not save profile.')
  }

  return (
    <ScreenShell title="CREATE PROFILE" subtitle="One-time setup. This is how other players will see you.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Signed in as</label>
          <div className="font-mono text-cyan-300 text-sm break-all bg-slate-800/60 rounded px-3 py-2 border border-slate-700">
            {session?.user?.email}
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Display name <span className="text-slate-500">(3–20 characters)</span></label>
          <input className={input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Raiden" autoFocus />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Country</label>
          <select className={input} value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">— pick your country —</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-200 cursor-pointer">
          <input type="checkbox" checked={ageOk} onChange={e => setAgeOk(e.target.checked)} className="mt-1" />
          <span>I confirm I am at least 13 years old.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-200 cursor-pointer">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" />
          <span>I have read and agree to the{' '}
            <button type="button" className="underline text-cyan-300" onClick={() => onOpenLegal('tos')}>Terms</button>
            {' '}and{' '}
            <button type="button" className="underline text-cyan-300" onClick={() => onOpenLegal('privacy')}>Privacy Policy</button>.
          </span>
        </label>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex gap-2">
          <button className={btn + ' flex-1'} type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save & Play'}
          </button>
          <button type="button" className={btnAlt} onClick={onSignOut}>Sign out</button>
        </div>
      </form>
    </ScreenShell>
  )
}

export function LegalScreen({ kind, onBack }) {
  const isTos = kind === 'tos'
  return (
    <ScreenShell title={isTos ? 'TERMS OF SERVICE' : 'PRIVACY POLICY'} onBack={onBack}>
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-6 text-sm text-slate-200 space-y-3 max-h-[70vh] overflow-y-auto">
        {isTos ? <TosBody /> : <PrivacyBody />}
      </div>
    </ScreenShell>
  )
}

function TosBody() {
  return (
    <>
      <p><b>Effective date:</b> {new Date().toISOString().slice(0, 10)}</p>
      <p>Welcome to Thian Men Dodgeball (the "Game"). By creating an account or playing, you agree to these Terms.</p>
      <p><b>1. Eligibility.</b> You must be at least 13 years old to create an account. If you are under 18, you must have permission from a parent or guardian.</p>
      <p><b>2. Account.</b> You are responsible for keeping your login email secure. Do not share your account. One account per person.</p>
      <p><b>3. Conduct.</b> No harassment, hate speech, cheating, exploits, or attempts to disrupt other players. Violators may be permanently banned.</p>
      <p><b>4. Content.</b> Your display name must not include slurs, impersonation, or trademarked names. We may reset offensive names without notice.</p>
      <p><b>5. Availability.</b> The Game is provided "as is" with no uptime guarantee. Free service — expect occasional downtime.</p>
      <p><b>6. Termination.</b> We may suspend or delete accounts that violate these terms. You may delete your account at any time from the Account menu.</p>
      <p><b>7. Changes.</b> We may update these Terms. Continued play means you accept the update.</p>
      <p><b>8. Contact.</b> Reach out through the game's project repository for questions.</p>
    </>
  )
}

function PrivacyBody() {
  return (
    <>
      <p><b>Effective date:</b> {new Date().toISOString().slice(0, 10)}</p>
      <p>Your privacy matters. This policy explains what we collect and why.</p>
      <p><b>What we collect.</b> Your email address, a display name you pick, the country you choose, an age confirmation, and gameplay data (match results, ladder times).</p>
      <p><b>What we do NOT collect.</b> No real names, no addresses, no phone numbers, no payment info (the Game is free), no analytics tracking beyond what's needed to run matchmaking.</p>
      <p><b>Why we use it.</b> Email to sign you in via magic link. Display name and country to show you to opponents and on leaderboards. Age check to comply with COPPA (US) and similar laws.</p>
      <p><b>Who sees it.</b> Your display name and country are visible to other players. Your email is never shown to others. We do not sell data.</p>
      <p><b>Storage.</b> Data is stored on Supabase servers. Auth sessions live in your browser.</p>
      <p><b>Your rights.</b> You can delete your account at any time; that erases your profile, matches, and ladder records within 30 days. Contact us for a data export.</p>
      <p><b>Cookies.</b> We use one login cookie to keep you signed in. No advertising or tracking cookies.</p>
      <p><b>Children.</b> The Game is not for users under 13. If we learn we've collected data from a child under 13, we delete it.</p>
      <p><b>Changes.</b> We'll post updates here with a new effective date.</p>
    </>
  )
}

export function AccountMenu({ profile, session, onSignOut, onEditProfile, onClose }) {
  return (
    <div className="absolute top-16 right-4 z-40 bg-slate-900/95 border border-slate-600 rounded-xl p-4 w-64 shadow-2xl text-white">
      <div className="text-xs text-slate-400 uppercase tracking-wide">Signed in as</div>
      <div className="font-bold text-lg mb-1">{profile?.display_name || '—'}</div>
      <div className="text-xs text-slate-400 mb-1 break-all">{session?.user?.email}</div>
      {profile && (
        <div className="text-xs text-slate-300 mb-3">Country: <span className="font-mono">{countryName(profile.country)}</span></div>
      )}
      <div className="flex flex-col gap-2">
        <button className={btnAlt + ' text-sm'} onClick={onEditProfile}>Edit profile</button>
        <button className="px-4 py-2 rounded bg-red-800 hover:bg-red-700 border border-red-500 text-sm" onClick={onSignOut}>Sign out</button>
        <button className="text-xs text-slate-400 hover:text-white mt-1" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
