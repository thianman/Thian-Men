import React, { useRef, useState } from 'react'
import { COUNTRIES, countryName } from '../lib/countries.js'
import { processAvatarFile, uploadAvatar } from '../lib/avatars.js'
import { sfx } from '../game/sfx.js'

const btn = 'px-5 py-2.5 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow border border-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed'
const btnAlt = 'px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-semibold border border-slate-500'
const input = 'w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:border-cyan-400 focus:outline-none text-white'

export default function EditProfile({ session, profile, onSave, onDone }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [country, setCountry] = useState(profile?.country || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const pickFile = () => fileRef.current?.click()

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setUploading(true)
    try {
      const blob = await processAvatarFile(file)
      const url = await uploadAvatar(session.user.id, blob)
      setAvatarUrl(url)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeAvatar = () => setAvatarUrl(null)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const name = displayName.trim()
    if (name.length < 3 || name.length > 20) return setError('Display name must be 3–20 characters.')
    if (!/^[A-Za-z0-9 ._-]+$/.test(name)) return setError('Only letters, numbers, spaces, and . _ - allowed.')
    if (!country) return setError('Please pick your country.')
    setError(''); setBusy(true)
    const { error } = await onSave({ display_name: name, country, is_adult: true, avatar_url: avatarUrl })
    setBusy(false)
    if (error) setError(error.message || 'Could not save profile.')
    else onDone && onDone()
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center text-white p-3 overflow-hidden">
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 text-center mb-2">EDIT PROFILE</h1>
      <p className="text-slate-300 mb-4 text-sm text-center">Change how you look to other players.</p>
      <form onSubmit={submit} className="w-full max-w-md space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-cyan-400 overflow-hidden bg-slate-800 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">👤</span>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs">Uploading…</div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <button type="button" onClick={pickFile} className={btn + ' text-sm'}>Upload photo</button>
            {avatarUrl && (
              <button type="button" onClick={removeAvatar} className="text-xs text-slate-400 hover:text-red-400 underline text-left">Remove photo</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Display name <span className="text-slate-500">(3–20 characters)</span></label>
          <input className={input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Raiden" />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Country</label>
          <select className={input} value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">— pick your country —</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Signed in as</label>
          <div className="font-mono text-cyan-300 text-sm break-all bg-slate-800/60 rounded px-3 py-2 border border-slate-700">
            {session?.user?.email}
          </div>
        </div>
        {error && <div className="text-red-400 text-sm text-center">{error}</div>}
        <div className="flex gap-2">
          <button className={btn + ' flex-1'} type="submit" disabled={busy || uploading}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className={btnAlt} onClick={() => { sfx.click(); onDone && onDone() }}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
