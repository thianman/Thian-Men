import React from 'react'
import { sfx } from '../game/sfx.js'

// Floating stack of pending party invites (top-right of screen).
// Not modal — the player can dismiss or accept without leaving what they're doing.
export default function InviteToast({ invites, onAccept, onDecline }) {
  if (!invites?.length) return null
  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {invites.slice(0, 3).map(inv => (
        <div key={inv.id}
          className="pointer-events-auto rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/50 shadow-2xl p-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-600 flex-shrink-0 flex items-center justify-center">
              {inv.sender?.avatar_url ? (
                <img src={inv.sender.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-400 text-lg">{(inv.sender?.display_name || '?')[0]?.toUpperCase()}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-widest text-amber-300">Party invite</div>
              <div className="font-bold truncate">{inv.sender?.display_name || 'Player'}</div>
              <div className="text-xs text-slate-400">wants you in their {inv.match_type} · <span className="font-mono text-cyan-300">{inv.join_code}</span></div>
            </div>
          </div>
          <div className="mt-2 flex gap-2 justify-end">
            <button onClick={() => { sfx.click?.(); onDecline?.(inv) }}
              className="chip-btn text-xs">Decline</button>
            <button onClick={() => { sfx.match?.() || sfx.click?.(); onAccept?.(inv) }}
              className="arcade-btn text-xs py-1 px-3">Join</button>
          </div>
        </div>
      ))}
    </div>
  )
}
