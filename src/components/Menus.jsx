import React, { useState } from 'react'
import { CHARACTERS, MAPS, DIFFICULTIES, STAT_STARS, MODIFIERS } from '../game/constants.js'
import CharacterPose, { poseVerb } from './CharacterPose.jsx'
import { sfx, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from '../game/sfx.js'
import { getRecords, bestForCharacter, formatTime, clearRecords } from '../game/ladderStore.js'
import { characterUnlockInfo } from '../lib/progression.js'
import { buyCharacterWithCoins } from '../lib/progression.js'
import { CHARACTER_COIN_PRICE } from '../game/progressionConstants.js'

const btn = 'px-6 py-3 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow-lg text-lg border border-cyan-300/40 transition'
const btnAlt = 'px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold shadow border border-slate-500 transition'

// Ambient arena visuals — reused across every non-battle page.
// Place inside any root container that has `position: relative` (or make it fixed).
export function ArenaBackdrop({ fixed = false }) {
  const lights = [10, 30, 50, 70, 90]
  return (
    <div className={(fixed ? 'fixed' : 'absolute') + ' inset-0 arena-bg overflow-hidden pointer-events-none'} style={{ zIndex: 0 }}>
      <div className="arena-lights">
        {lights.map((left, i) => (
          <div key={i} className="arena-light" style={{ left: `calc(${left}% - 34px)` }} />
        ))}
      </div>
      <div className="arena-crowd" />
      <div className="arena-floor" />
    </div>
  )
}

export function Screen({ children, title, subtitle, onBack }) {
  return (
    <div className="relative w-screen h-screen flex flex-col items-center text-white overflow-hidden">
      <ArenaBackdrop />
      <div className="relative z-10 flex flex-col items-center w-full h-full p-3">
        {title && (
          <h1 className="arena-heading">{title}</h1>
        )}
        {subtitle && <p className="text-amber-100/80 mb-3 text-center text-sm md:text-base tracking-[0.25em] uppercase">{subtitle}</p>}
        <div className="w-full max-w-6xl overflow-y-auto" style={{ maxHeight: onBack ? '72vh' : '82vh' }}>{children}</div>
        {onBack && (
          <button onClick={() => { sfx.click(); onBack() }} className="chip-btn mt-3">
            ← Back
          </button>
        )}
      </div>
    </div>
  )
}

function HeroScene() {
  return (
    <div className="relative w-full max-w-3xl mx-auto mb-3" style={{ maxHeight: '32vh' }}>
      <svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMid meet" className="w-full h-auto drop-shadow-2xl" style={{ maxHeight: '32vh' }}>
        <defs>
          <linearGradient id="heroBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1e1b4b" />
            <stop offset="60%"  stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#831843" />
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <radialGradient id="ballGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#fecaca" />
            <stop offset="60%"  stopColor="#ef4444" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#22d3ee" strokeOpacity="0.12" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width="800" height="320" fill="url(#heroBg)" rx="18" />
        <rect width="800" height="320" fill="url(#grid)" rx="18" />

        {/* Scan line sweep */}
        <g style={{ overflow: 'hidden' }}>
          <rect className="hero-scan" x="0" y="0" width="200" height="320" fill="url(#scanFade)" opacity="0.15" />
        </g>
        <linearGradient id="scanFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>

        {/* City silhouette + stars */}
        {[...Array(24)].map((_, i) => {
          const x = (i * 91) % 800, y = (i * 37) % 90 + 20
          return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.6 : 1} fill="#e0e7ff" opacity={0.6} />
        })}
        <path d="M 0 210 L 40 210 L 40 170 L 90 170 L 90 200 L 140 200 L 140 150 L 200 150 L 200 190 L 260 190 L 260 160 L 320 160 L 320 195 L 380 195 L 380 170 L 440 170 L 440 200 L 500 200 L 500 155 L 560 155 L 560 190 L 620 190 L 620 170 L 680 170 L 680 200 L 740 200 L 740 175 L 800 175 L 800 240 L 0 240 Z" fill="rgba(0,0,0,0.55)" />
        {/* Building window lights */}
        {[[55, 185], [110, 210], [155, 175], [220, 200], [290, 175], [345, 185], [400, 195], [465, 180], [520, 175], [585, 200], [640, 195], [710, 190], [755, 200]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="4" height="6" fill="#e879f9" opacity="0.85" className={i % 3 === 0 ? 'hero-flick' : ''} />
        ))}

        {/* Floor */}
        <rect x="0" y="240" width="800" height="80" fill="url(#floor)" />
        <rect x="0" y="238" width="800" height="3" fill="#22d3ee" opacity="0.7" />
        {/* Floor grid perspective lines */}
        {[...Array(9)].map((_, i) => (
          <line key={i} x1={i * 100} y1="240" x2={400 + (i - 4) * 260} y2="320" stroke="#22d3ee" strokeOpacity="0.18" strokeWidth="1" />
        ))}
        <line x1="0" y1="270" x2="800" y2="270" stroke="#22d3ee" strokeOpacity="0.2" />
        <line x1="0" y1="300" x2="800" y2="300" stroke="#22d3ee" strokeOpacity="0.12" />

        {/* Center dashed line */}
        <line x1="400" y1="50" x2="400" y2="240" stroke="white" strokeOpacity="0.15" strokeDasharray="6 8" />

        {/* --- BLAZE on left, mid-throw (humanoid, smug) --- */}
        <g className="hero-blaze">
          {/* shadow */}
          <ellipse cx="180" cy="245" rx="34" ry="6" fill="black" opacity="0.35" />
          {/* motion afterimage */}
          <g opacity="0.28">
            <rect x="150" y="170" width="30" height="42" rx="6" fill="#ff5c33" />
            <circle cx="165" cy="158" r="12" fill="#f2d5b0" />
          </g>
          {/* Legs */}
          <rect x="168" y="205" width="9" height="34" rx="3" fill="#1e293b" />
          <rect x="187" y="205" width="9" height="34" rx="3" fill="#1e293b" />
          {/* Shoes */}
          <rect x="166" y="235" width="13" height="6" rx="2" fill="#ffd400" />
          <rect x="185" y="235" width="13" height="6" rx="2" fill="#ffd400" />
          {/* Back arm (behind torso) */}
          <path d="M 170 175 Q 145 200 138 218" stroke="#c94422" strokeWidth="7" strokeLinecap="round" fill="none" />
          {/* Torso (slim) */}
          <rect x="165" y="170" width="35" height="40" rx="6" fill="#ff5c33" />
          <rect x="167" y="200" width="31" height="4" fill="#ffd400" />
          <rect x="169" y="176" width="27" height="28" fill="#e2481f" opacity="0.55" />
          {/* Front arm mid-throw (extending right toward ball) */}
          <path d="M 195 178 Q 240 158 285 168" stroke="#c94422" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="286" cy="168" r="6.5" fill="#f2d5b0" />
          {/* Head */}
          <circle cx="183" cy="158" r="12" fill="#f2d5b0" />
          {/* Spiky hair (slim) */}
          <g fill="#ffd400">
            <polygon points="173,148 179,152 176,140" />
            <polygon points="178,146 184,151 182,138" />
            <polygon points="184,146 190,150 187,138" />
            <polygon points="190,148 194,152 194,140" />
          </g>
          {/* Smug expression, facing right */}
          {/* Eyes */}
          <circle cx="180" cy="159" r="2.4" fill="#fff" />
          <circle cx="188" cy="159" r="2.4" fill="#fff" />
          <circle cx="181" cy="159" r="1.3" fill="#0b0f1a" />
          <circle cx="189" cy="159" r="1.3" fill="#0b0f1a" />
          {/* Level brow + raised brow */}
          <line x1="177" y1="155" x2="183" y2="155" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="185" y1="153" x2="191" y2="153" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
          {/* Half-smirk */}
          <path d="M 180 166 L 187 164" stroke="#7c2d12" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Team outline halo */}
          <rect x="162" y="153" width="42" height="88" rx="10" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
          {/* charge/burst behind body */}
          <g filter="url(#softGlow)" opacity="0.7">
            <circle cx="150" cy="200" r="6" fill="#ffd400" />
            <circle cx="130" cy="180" r="4" fill="#f97316" />
            <circle cx="145" cy="170" r="3" fill="#facc15" />
          </g>
        </g>

        {/* --- BALL in flight with motion trail --- */}
        <g>
          {/* arc trail */}
          <path d="M 292 172 Q 420 90 570 150" stroke="#ef4444" strokeWidth="3" strokeOpacity="0.35" fill="none" strokeDasharray="4 6" />
          <path d="M 300 172 Q 430 100 560 156" stroke="#fbbf24" strokeWidth="2" strokeOpacity="0.55" fill="none" />
          {/* trail dots */}
          {[0.15, 0.3, 0.45, 0.6, 0.75].map((t, i) => {
            const x = (1 - t) * (1 - t) * 300 + 2 * (1 - t) * t * 430 + t * t * 560
            const y = (1 - t) * (1 - t) * 172 + 2 * (1 - t) * t * 100 + t * t * 156
            return <circle key={i} cx={x} cy={y} r={4 + i * 0.8} fill="#f97316" opacity={0.2 + i * 0.12} />
          })}
          {/* the ball */}
          <g className="hero-ball" style={{ transform: 'translate(520px, 140px)' }}>
            <circle r="14" fill="url(#ballGlow)" filter="url(#softGlow)" />
            <circle r="14" fill="none" stroke="#7c2d12" strokeWidth="2" />
            <path d="M -10 0 A 14 14 0 0 1 10 0" stroke="#7c2d12" strokeWidth="1.5" fill="none" />
          </g>
          {/* sparks on the ball */}
          <g style={{ transformOrigin: '540px 148px' }}>
            <circle cx="548" cy="140" r="2" fill="#fef3c7" className="hero-spark" />
            <circle cx="558" cy="150" r="1.6" fill="#fde68a" className="hero-spark" style={{ animationDelay: '0.3s' }} />
            <circle cx="536" cy="158" r="1.5" fill="#fbbf24" className="hero-spark" style={{ animationDelay: '0.6s' }} />
          </g>
        </g>

        {/* --- GHOST on right (humanoid, mischievous, leaning back mid-dodge) --- */}
        <g className="hero-ghost" transform="rotate(-8 660 180)">
          {/* shadow */}
          <ellipse cx="660" cy="245" rx="34" ry="6" fill="black" opacity="0.3" />
          {/* motion afterimages */}
          <g opacity="0.28">
            <rect x="655" y="170" width="30" height="42" rx="6" fill="#9adfff" />
            <circle cx="670" cy="158" r="13" fill="#f2d5b0" />
          </g>
          {/* Legs */}
          <rect x="646" y="205" width="9" height="34" rx="3" fill="#1e293b" />
          <rect x="665" y="205" width="9" height="34" rx="3" fill="#1e293b" />
          {/* Shoes */}
          <rect x="644" y="235" width="13" height="6" rx="2" fill="#ffffff" />
          <rect x="663" y="235" width="13" height="6" rx="2" fill="#ffffff" />
          {/* Back arm (behind torso) — flung out behind */}
          <path d="M 673 178 Q 705 195 720 218" stroke="#5da3c4" strokeWidth="7" strokeLinecap="round" fill="none" />
          {/* Torso — translucent ghost */}
          <rect x="643" y="170" width="35" height="40" rx="8" fill="#9adfff" opacity="0.9" />
          {/* Front arm — reaching out, dodging */}
          <path d="M 648 178 Q 620 172 605 158" stroke="#5da3c4" strokeWidth="7" strokeLinecap="round" fill="none" />
          <circle cx="604" cy="157" r="6" fill="#f2d5b0" />
          {/* Head */}
          <circle cx="661" cy="158" r="13" fill="#f2d5b0" />
          {/* Glowing hair */}
          <path d="M 648 152 Q 661 138 674 152" fill="#ffffff" opacity="0.65" />
          <circle cx="661" cy="150" r="15" fill="#ffffff" opacity="0.18" />
          {/* Mischievous expression, facing left */}
          {/* Wink (left eye, since facing left) */}
          <line x1="653" y1="159" x2="659" y2="159" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
          {/* Open right eye */}
          <circle cx="666" cy="159" r="2.4" fill="#fff" />
          <circle cx="665" cy="159" r="1.3" fill="#0b0f1a" />
          {/* Playful brows */}
          <line x1="650" y1="154" x2="656" y2="155" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="663" y1="154" x2="669" y2="153" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
          {/* Wide grin */}
          <path d="M 656 165 Q 660 170 665 165" stroke="#7c2d12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* Team outline halo */}
          <rect x="640" y="153" width="42" height="88" rx="10" fill="none" stroke="#f87171" strokeWidth="2" opacity="0.7" />
        </g>
        {/* trailing streak lines behind dodger */}
        <path d="M 720 130 Q 760 140 790 125" stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 720 150 Q 760 158 790 148" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 720 170 Q 760 175 790 168" stroke="#22d3ee" strokeOpacity="0.25" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Foreground sparks near ball impact side */}
        <g>
          <circle cx="595" cy="120" r="2" fill="#22d3ee" className="hero-spark" style={{ animationDelay: '0.2s' }} />
          <circle cx="612" cy="105" r="1.5" fill="#a5f3fc" className="hero-spark" style={{ animationDelay: '0.5s' }} />
          <circle cx="600" cy="140" r="1.8" fill="#67e8f9" className="hero-spark" style={{ animationDelay: '0.8s' }} />
        </g>
      </svg>
    </div>
  )
}

export function TitleScreen({ onPlay, onInstructions, onQuickPlay, onSettings, onLeaderboard, onGlobalLeaderboard, onCredits, onDaily, onFriends, friendRequests = 0, dailyUnclaimed = 0, streak = 0 }) {
  const stars = Array.from({ length: 14 }).map((_, i) => ({
    left:  (i * 71) % 100,
    delay: (i * 0.43) % 8,
    dur:   9 + ((i * 1.3) % 6),
    size:  10 + (i % 3) * 4,
  }))
  const lights = [8, 22, 36, 50, 64, 78, 92]

  return (
    <div className="arena-bg relative w-screen h-screen flex flex-col items-center text-white overflow-hidden">
      {/* Brand chip corner */}
      <div className="brand-chip">Season 1 · dodgeballstars.com</div>

      {/* Stadium lights row across the top */}
      <div className="arena-lights">
        {lights.map((left, i) => (
          <div key={i} className="arena-light" style={{ left: `calc(${left}% - 34px)` }} />
        ))}
      </div>

      {/* Crowd silhouette + court */}
      <div className="arena-crowd" />
      <div className="arena-floor" />

      {/* Floating stars */}
      <div className="star-field">
        {stars.map((s, i) => (
          <span key={i} style={{
            left: `${s.left}%`,
            fontSize: `${s.size}px`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}>★</span>
        ))}
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col items-center w-full h-full px-3 pt-6 pb-4">
        {/* Logo lockup */}
        <div className="stars-wrap text-center">
          <div className="stars-halo" />
          <div className="stars-top">DODGEBALL</div>
          <div className="stars-banner">
            <div className="stars-sub">
              <span className="stars-flank">★</span>
              STARS
              <span className="stars-flank">★</span>
            </div>
          </div>
          <div className="stars-shine" />
        </div>
        <p className="text-amber-100/80 mt-3 mb-1 text-center text-xs md:text-sm tracking-[0.4em] uppercase">
          Dodge · Catch · Throw · Reign
        </p>

        <HeroScene />

        {/* Primary CTA row */}
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button className="arcade-btn text-xl md:text-2xl" onClick={() => { sfx.click(); onPlay() }}>▶ Play</button>
          <button className="arcade-btn arcade-btn--cyan text-xl md:text-2xl" onClick={() => { sfx.click(); onQuickPlay() }}>⚡ Quick Play</button>
        </div>

        {/* Secondary chip row */}
        <div className="mt-3 flex flex-wrap justify-center gap-2 max-w-3xl">
          {onDaily && (
            <button className="chip-btn relative" onClick={() => { sfx.click(); onDaily() }}>
              🎯 Daily
              {dailyUnclaimed > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center">{dailyUnclaimed}</span>
              )}
            </button>
          )}
          {onFriends && (
            <button className="chip-btn relative" onClick={() => { sfx.click(); onFriends() }}>
              👥 Friends
              {friendRequests > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{friendRequests}</span>
              )}
            </button>
          )}
          {streak > 0 && (
            <div className="chip-btn cursor-default">🔥 {streak}d</div>
          )}
          <button className="chip-btn" onClick={() => { sfx.click(); onLeaderboard() }}>Local Board</button>
          <button className="chip-btn" onClick={() => { sfx.click(); onGlobalLeaderboard() }}>Global Board</button>
          <button className="chip-btn" onClick={() => { sfx.click(); onInstructions() }}>How To Play</button>
          <button className="chip-btn" onClick={() => { sfx.click(); onSettings() }}>Settings</button>
          <button className="chip-btn" onClick={() => { sfx.click(); onCredits() }}>Credits</button>
        </div>

        <p className="text-center text-amber-100/50 text-xs mt-auto tracking-[0.3em] uppercase pb-1">
          Best of 3 · Winner stays king
        </p>
      </div>
    </div>
  )
}

export function CreditsScreen({ onBack }) {
  const Section = ({ title, children }) => (
    <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700">
      <h3 className="text-lg font-bold mb-2 text-cyan-300">{title}</h3>
      <div className="text-slate-200 text-sm space-y-1">{children}</div>
    </div>
  )
  return (
    <Screen title="ABOUT & CREDITS" onBack={onBack}>
      <div className="max-w-3xl mx-auto space-y-3 overflow-y-auto pr-2" style={{ maxHeight: '65vh' }}>
        <Section title="About">
          <p>A 2D platformer dodgeball game — solo or local 2P — with 6 fighters, 4 maps, four CPU tiers, a Survival Ladder, cosmetic skins, difficulty modifiers, and arena hazards. Built to be picked up in seconds and mastered over hundreds of matches.</p>
        </Section>

        <Section title="Design & Direction">
          <p>Raiden — game design, character roster, match pacing, art direction, vibe QA.</p>
        </Section>

        <Section title="Engineering">
          <p>Claude (Anthropic) — React + Vite + Tailwind scaffolding, Canvas 2D engine, physics, AI, mobile controls, VFX pipeline.</p>
        </Section>

        <Section title="Fighters">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CHARACTERS.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm" style={{ background: c.color }} />
                <span className="font-bold">{c.name}</span>
                <span className="text-slate-400 italic text-xs">— {c.vibe}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Maps">
          <div className="flex flex-wrap gap-3">
            {MAPS.map(m => (
              <span key={m.id} className="px-2 py-1 rounded bg-slate-800 border border-slate-600">{m.name}</span>
            ))}
          </div>
        </Section>

        <Section title="Tech">
          <p>React 18 · Vite · Tailwind CSS · HTML5 Canvas 2D · Web Audio API (procedural music &amp; SFX)</p>
        </Section>

        <p className="text-center text-slate-500 text-xs pt-4">
          Version 0.1 · Made with care by vibe coders · Winner stays king.
        </p>
      </div>
    </Screen>
  )
}

export function LeaderboardScreen({ onBack }) {
  const [nonce, setNonce] = useState(0)
  const records = getRecords().slice(0, 10)
  return (
    <Screen title="LADDER LEADERBOARD" subtitle="Fastest survival ladder clears on this device." onBack={onBack}>
      {records.length === 0 ? (
        <div className="text-center text-slate-400 py-10">
          No clears yet. Beat the Survival Ladder to record your first time.
        </div>
      ) : (
        <div className="max-w-2xl mx-auto bg-slate-900/70 rounded-2xl border border-slate-700 divide-y divide-slate-800 overflow-hidden">
          {records.map((r, i) => {
            const c = CHARACTERS.find(ch => ch.id === r.char)
            const date = new Date(r.date)
            return (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className={`w-8 text-center font-black text-xl ${i === 0 ? 'text-amber-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'}`}>#{i + 1}</div>
                <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: c?.color || '#666' }} />
                <div className="flex-1">
                  <div className="font-bold">{r.name || c?.name || r.char}</div>
                  <div className="text-xs text-slate-400">{c?.name || r.char} · {date.toLocaleDateString()}</div>
                </div>
                <div className="text-2xl font-mono font-black text-cyan-300">{formatTime(r.timeMs)}</div>
              </div>
            )
          })}
        </div>
      )}
      {records.length > 0 && (
        <div className="text-center mt-4">
          <button onClick={() => { if (confirm('Clear all leaderboard records?')) { clearRecords(); setNonce(n => n + 1) } }}
            className="text-xs text-red-400 hover:text-red-300 underline">Clear records</button>
        </div>
      )}
    </Screen>
  )
}

export function SettingsScreen({ onBack }) {
  const [music, setMusic] = useState(!isMusicMuted())
  const [sound, setSound] = useState(!isSfxMuted())
  const Toggle = ({ on, onChange, label, color }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800 border border-slate-600">
      <span className="text-lg font-semibold">{label}</span>
      <button
        onClick={() => { sfx.click(); onChange(!on) }}
        className={`w-16 h-8 rounded-full relative transition ${on ? color : 'bg-slate-600'}`}
      >
        <span className={`absolute top-1 ${on ? 'right-1' : 'left-1'} w-6 h-6 rounded-full bg-white shadow transition-all`} />
      </button>
    </div>
  )
  return (
    <Screen title="SETTINGS" onBack={onBack}>
      <div className="max-w-md mx-auto flex flex-col gap-3">
        <Toggle on={music} color="bg-fuchsia-500" label="Music" onChange={(v) => { setMusic(v); setMusicMuted(!v) }} />
        <Toggle on={sound} color="bg-cyan-500" label="Sound Effects" onChange={(v) => { setSound(v); setSfxMuted(!v) }} />
      </div>
      <p className="text-slate-400 text-sm text-center mt-6">Preferences save automatically.</p>
    </Screen>
  )
}

export function InstructionsScreen({ onBack }) {
  const Row = ({ k, v }) => (
    <div className="flex justify-between border-b border-slate-800 py-1">
      <span className="text-slate-300">{k}</span>
      <span className="font-mono text-cyan-300">{v}</span>
    </div>
  )
  return (
    <Screen title="HOW TO PLAY" onBack={onBack}>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold mb-2 text-cyan-300">Player 1 (WASD)</h3>
          <Row k="Move Left / Right" v="A / D" />
          <Row k="Jump" v="W" />
          <Row k="Duck" v="S" />
          <Row k="Throw (hold to charge)" v="F" />
          <Row k="Catch (timed)" v="G" />
        </div>
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold mb-2 text-rose-300">Player 2 (Arrows)</h3>
          <Row k="Move Left / Right" v="← / →" />
          <Row k="Jump" v="↑" />
          <Row k="Duck" v="↓" />
          <Row k="Throw" v="," />
          <Row k="Catch" v="." />
        </div>
      </div>
      <div className="mt-5 bg-slate-900/60 p-5 rounded-xl border border-slate-700 text-slate-200 text-sm leading-relaxed">
        <p><b className="text-amber-300">Throw:</b> Hold Throw to charge (0–100%). Higher charge = more power but harder to catch.</p>
        <p><b className="text-emerald-300">Catch:</b> Tap Catch when a ball is near — timing matters.</p>
        <p><b className="text-sky-300">Fast-fall:</b> Hold Duck while in the air to drop faster — useful for slipping under high throws.</p>
        <p><b className="text-purple-300">Dash:</b> Double-tap left or right for a quick invulnerable dash (short cooldown). Perfect for weaving past a shot.</p>
        <p><b className="text-fuchsia-300">HP:</b> 3 hits. Last player standing wins the round. First to 5 rounds wins the set. First to 3 sets wins the match.</p>
      </div>
    </Screen>
  )
}

export function ModeSelect({ onPick, onBack }) {
  const modes = [
    { id: 'online', name: 'Play Online (Beta)', desc: 'Real-time multiplayer preview', highlight: true },
    { id: 'onlineLadder', name: 'Online Ladder', desc: 'Server-timed 6-fight ladder + global leaderboard', highlight: true },
    { id: '1p', name: '1P vs CPU', desc: 'Play against the AI' },
    { id: '2p', name: '2P Local', desc: 'Two players, one keyboard' },
    { id: 'ladder', name: 'Survival Ladder', desc: 'Beat all 6 fighters, rising difficulty' },
    { id: 'practice', name: 'Practice Arena', desc: 'Warm up, no score' },
  ]
  return (
    <Screen title="SELECT MODE" onBack={onBack}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modes.map(m => (
          <button key={m.id} onClick={() => { sfx.click(); onPick(m.id) }}
            className={`p-6 rounded-xl border text-left transition ${m.highlight ? 'bg-gradient-to-br from-fuchsia-900/70 to-cyan-900/70 border-fuchsia-400 hover:border-fuchsia-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 hover:border-cyan-400'}`}>
            <div className={`text-2xl font-bold ${m.highlight ? 'text-fuchsia-200' : 'text-cyan-300'}`}>{m.name}</div>
            <div className="text-slate-300 mt-1">{m.desc}</div>
          </button>
        ))}
      </div>
    </Screen>
  )
}

export function MatchTypeSelect({ onPick, onBack }) {
  return (
    <Screen title="MATCH TYPE" subtitle="Choose your local multiplayer setup." onBack={onBack}>
      <div className="grid md:grid-cols-2 gap-4">
        <button onClick={() => { sfx.click(); onPick('1v1') }} className="p-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-400 text-left">
          <div className="text-2xl font-bold text-cyan-300">1v1 Mode</div>
          <div className="text-slate-300 mt-1">P1 vs P2 head-to-head.</div>
        </button>
        <button onClick={() => { sfx.click(); onPick('2v2') }} className="p-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-fuchsia-400 text-left">
          <div className="text-2xl font-bold text-fuchsia-300">2v2 Mode</div>
          <div className="text-slate-300 mt-1">P1 + P2 vs two CPU opponents.</div>
        </button>
      </div>
    </Screen>
  )
}

export function DifficultySelect({ onPick, onBack }) {
  const colors = { easy: 'from-emerald-500 to-emerald-700', medium: 'from-amber-500 to-amber-700', hard: 'from-orange-500 to-orange-700', impossible: 'from-red-500 to-red-800' }
  return (
    <Screen title="DIFFICULTY" onBack={onBack}>
      <div className="grid md:grid-cols-4 gap-3">
        {DIFFICULTIES.map(d => (
          <button key={d.id} onClick={() => { sfx.click(); onPick(d.id) }}
            className={`p-6 rounded-xl bg-gradient-to-b ${colors[d.id]} text-white font-black text-2xl border border-white/20 hover:brightness-110 transition`}>
            {d.name}
          </button>
        ))}
      </div>
    </Screen>
  )
}

function Stars({ n }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[1,2,3].map(i => (
        <span key={i} className={i <= n ? 'text-amber-300' : 'text-slate-600'}>★</span>
      ))}
    </span>
  )
}

const SKIN_KEY = 'db_last_skin_v1'
function loadLastSkins() {
  try { return JSON.parse(localStorage.getItem(SKIN_KEY) || '{}') } catch { return {} }
}
function saveLastSkin(charId, idx) {
  try {
    const m = loadLastSkins(); m[charId] = idx
    localStorage.setItem(SKIN_KEY, JSON.stringify(m))
  } catch {}
}

export function CharacterSelect({ label, exclude, onPick, onBack, progression, session, onProgressionRefresh }) {
  const [skins, setSkins] = useState(loadLastSkins())
  const [buyBusy, setBuyBusy] = useState(null)
  const [buyErr, setBuyErr] = useState('')
  const setSkin = (id, idx) => {
    const next = { ...skins, [id]: idx }; setSkins(next); saveLastSkin(id, idx); sfx.click()
  }
  const unlocked = progression?.unlocked
  const level = progression?.progression?.level || 1
  const coins = progression?.progression?.coins || 0
  const requireUnlocks = !!progression // only gate if we know their progression (signed in)

  const doBuy = async (charId) => {
    if (!session?.user?.id) return
    setBuyBusy(charId); setBuyErr('')
    const res = await buyCharacterWithCoins(session.user.id, charId, coins)
    setBuyBusy(null)
    if (!res.ok) { setBuyErr(res.error || 'Purchase failed'); return }
    sfx.match()
    onProgressionRefresh && await onProgressionRefresh()
  }

  return (
    <Screen title={label} subtitle="Choose your fighter. Tap a color dot for a skin." onBack={onBack}>
      {progression?.progression && (
        <div className="text-center text-sm text-slate-300 mb-3">
          <span className="font-bold text-amber-300">Lv {level}</span>
          <span className="mx-3 text-slate-500">·</span>
          <span className="text-amber-200">🪙 {coins.toLocaleString()}</span>
        </div>
      )}
      {buyErr && <div className="text-red-400 text-sm text-center mb-2">{buyErr}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CHARACTERS.map(c => {
          const dis = exclude === c.id
          const info = requireUnlocks ? characterUnlockInfo(unlocked, c.id, level) : { unlocked: true }
          const locked = requireUnlocks && !info.unlocked
          const skinIdx = skins[c.id] || 0
          const skin = (c.skins && c.skins[skinIdx]) || c
          return (
            <div key={c.id}
              className={`p-4 rounded-xl border text-left transition relative ${dis || locked ? 'opacity-60 border-slate-700 bg-slate-800/50' : 'border-slate-600 bg-slate-800 hover:border-cyan-400'}`}>
              {locked && (
                <div className="absolute top-2 right-2 text-xl">🔒</div>
              )}
              <button
                disabled={dis || locked}
                onClick={() => { if (!(dis || locked)) { sfx.click(); onPick(c.id, skinIdx) } }}
                className={`w-full text-left ${dis || locked ? 'cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 rounded-lg border-2 pose-hover flex items-end justify-center overflow-hidden"
                    style={{ background: `radial-gradient(circle at 50% 30%, ${skin.color}55, ${skin.accent}22 60%, transparent)`, borderColor: skin.accent, width: 96, height: 132 }}
                  >
                    <CharacterPose character={{ ...c, color: skin.color, accent: skin.accent }} size={92} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-black leading-none">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-amber-300 mt-0.5">{poseVerb(c.id)}</div>
                    <div className="text-xs text-slate-400 italic mt-1">{c.vibe}</div>
                    <div className="mt-2 text-xs text-slate-200 space-y-0.5">
                      <div className="flex justify-between"><span>Speed</span> <Stars n={STAT_STARS.speed[c.id]} /></div>
                      <div className="flex justify-between"><span>Strength</span> <Stars n={STAT_STARS.strength[c.id]} /></div>
                      <div className="flex justify-between"><span>Jump</span> <Stars n={STAT_STARS.jump[c.id]} /></div>
                    </div>
                  </div>
                </div>
                {c.perk && (
                  <div className="mt-3 rounded-lg px-2 py-1.5 bg-gradient-to-r from-fuchsia-900/60 to-cyan-900/60 border border-fuchsia-500/40">
                    <div className="text-xs font-bold text-fuchsia-300 uppercase tracking-wide">{c.perk.label}</div>
                    <div className="text-xs text-slate-200">{c.perk.desc}</div>
                  </div>
                )}
              </button>
              {!dis && !locked && c.skins && (
                <div className="mt-3 flex gap-2 items-center">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Skin:</span>
                  {c.skins.map((s, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setSkin(c.id, i) }}
                      className={`w-7 h-7 rounded-full border-2 transition ${i === skinIdx ? 'border-white scale-110' : 'border-slate-500 hover:border-slate-300'}`}
                      style={{ background: s.color }}
                      title={s.name}
                    />
                  ))}
                </div>
              )}
              {locked && (
                <div className="mt-3 rounded-lg px-3 py-2 bg-slate-900/70 border border-amber-500/50 text-xs text-slate-200">
                  {info.kind === 'level' && (
                    <>Unlocks at <span className="font-bold text-amber-300">Level {info.at}</span></>
                  )}
                  {info.kind === 'coins' && (
                    <div className="flex items-center justify-between gap-2">
                      <span>🪙 {CHARACTER_COIN_PRICE.toLocaleString()}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); doBuy(c.id) }}
                        disabled={buyBusy === c.id || coins < CHARACTER_COIN_PRICE}
                        className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-xs"
                      >
                        {buyBusy === c.id ? 'Buying…' : coins < CHARACTER_COIN_PRICE ? 'Not enough' : 'Buy'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Screen>
  )
}

export function LadderIntro({ p1Char, opponents, current, onNext, onQuit, victoryOverall, clearMs }) {
  const opp = opponents[current]
  const oppChar = opp ? CHARACTERS.find(c => c.id === opp.char) : null
  const best = bestForCharacter(p1Char)
  return (
    <Screen title={victoryOverall ? 'LADDER CLEARED!' : `FIGHT ${current + 1} / ${opponents.length}`}
            subtitle={victoryOverall ? 'You beat every fighter on the ladder.' : 'Prepare for your next opponent.'}>
      {victoryOverall && clearMs != null && (
        <div className="max-w-lg mx-auto mb-6 p-6 bg-gradient-to-r from-emerald-900/70 to-cyan-900/70 rounded-2xl border border-emerald-500/60 text-center">
          <div className="text-slate-200 text-sm uppercase tracking-wide">Clear Time</div>
          <div className="text-6xl font-black font-mono text-amber-300 mt-1">{formatTime(clearMs)}</div>
          {best && best.timeMs === clearMs && (
            <div className="mt-2 text-emerald-300 font-bold">NEW PERSONAL BEST!</div>
          )}
          {best && best.timeMs !== clearMs && (
            <div className="mt-2 text-slate-300 text-sm">Best with this fighter: {formatTime(best.timeMs)}</div>
          )}
        </div>
      )}
      {!victoryOverall && best && (
        <div className="text-center text-sm text-slate-300 mb-4">
          Personal best with <span className="font-bold text-cyan-300">{CHARACTERS.find(c => c.id === p1Char)?.name}</span>: <span className="font-mono text-amber-300">{formatTime(best.timeMs)}</span>
        </div>
      )}
      {!victoryOverall && oppChar && (
        <div className="max-w-lg mx-auto p-6 bg-slate-800 rounded-2xl border border-slate-600 flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl flex-shrink-0" style={{ background: oppChar.color }} />
          <div>
            <div className="text-3xl font-black">{oppChar.name}</div>
            <div className="text-slate-300 italic">{oppChar.vibe}</div>
            <div className="mt-2 text-sm text-slate-200">
              Difficulty: <span className="font-mono text-amber-300 uppercase">{opp.difficulty}</span>
            </div>
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {opponents.map((o, i) => {
          const state = i < current ? 'won' : i === current ? 'now' : 'todo'
          const c = CHARACTERS.find(ch => ch.id === o.char)
          return (
            <div key={i} className={`px-3 py-1 rounded-lg border text-sm ${state === 'won' ? 'bg-emerald-800/60 border-emerald-500 text-emerald-100' : state === 'now' ? 'bg-cyan-800/60 border-cyan-400 text-cyan-100' : 'bg-slate-800/60 border-slate-600 text-slate-400'}`}>
              {c.name}
              {state === 'won' && ' ✓'}
            </div>
          )
        })}
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={() => { sfx.click(); onNext() }}
                className={btn}>{victoryOverall ? 'Back to Menu' : 'FIGHT!'}</button>
        {!victoryOverall && (
          <button onClick={() => { sfx.click(); onQuit() }} className={btnAlt}>Give Up</button>
        )}
      </div>
    </Screen>
  )
}

export function ModifiersScreen({ onStart, onBack }) {
  const [selected, setSelected] = useState(new Set())
  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
    sfx.click()
  }
  return (
    <Screen title="MODIFIERS" subtitle="Optional twists. Combine any. Skip for a plain match." onBack={onBack}>
      <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
        {MODIFIERS.map(m => {
          const on = selected.has(m.id)
          return (
            <button key={m.id} onClick={() => toggle(m.id)}
              className={`p-4 rounded-xl border-2 text-left transition ${on ? 'border-amber-400 bg-amber-900/30' : 'border-slate-600 bg-slate-800 hover:border-slate-400'}`}>
              <div className="flex items-center justify-between">
                <div className="text-lg font-black text-amber-200">{m.label}</div>
                <div className={`w-5 h-5 rounded border-2 ${on ? 'bg-amber-400 border-amber-300' : 'border-slate-500'}`} />
              </div>
              <div className="text-sm text-slate-300 mt-1">{m.desc}</div>
            </button>
          )
        })}
      </div>
      <div className="text-center mt-8">
        <button onClick={() => { sfx.click(); onStart(Array.from(selected)) }} className={btn}>
          {selected.size > 0 ? `START (${selected.size} ACTIVE)` : 'START'}
        </button>
      </div>
    </Screen>
  )
}

export function MapSelect({ onPick, onBack }) {
  return (
    <Screen title="SELECT MAP" onBack={onBack}>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MAPS.map(m => (
          <button key={m.id} onClick={() => { sfx.click(); onPick(m.id) }}
            className="p-0 rounded-xl overflow-hidden border-2 border-slate-600 hover:border-cyan-400 transition bg-slate-800 text-left">
            <div className="h-40 relative" style={{ background: `linear-gradient(180deg, ${m.bg[0]}, ${m.bg[1]})` }}>
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: m.accent }} />
            </div>
            <div className="p-3">
              <div className="text-xl font-black">{m.name}</div>
            </div>
          </button>
        ))}
      </div>
    </Screen>
  )
}
