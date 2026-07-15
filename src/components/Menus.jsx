import React, { useState } from 'react'
import { CHARACTERS, MAPS, DIFFICULTIES, STAT_STARS, MODIFIERS } from '../game/constants.js'
import { sfx, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from '../game/sfx.js'
import { getRecords, bestForCharacter, formatTime, clearRecords } from '../game/ladderStore.js'

const btn = 'px-6 py-3 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 text-white font-bold shadow-lg text-lg border border-cyan-300/40 transition'
const btnAlt = 'px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold shadow border border-slate-500 transition'

export function Screen({ children, title, subtitle, onBack }) {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white p-4 overflow-y-auto">
      {title && <h1 className="text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 mb-2 text-center">{title}</h1>}
      {subtitle && <p className="text-slate-300 mb-6 text-center">{subtitle}</p>}
      <div className="w-full max-w-6xl">{children}</div>
      {onBack && (
        <button onClick={() => { sfx.click(); onBack() }} className="mt-6 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm">
          ← Back
        </button>
      )}
    </div>
  )
}

export function TitleScreen({ onPlay, onInstructions, onQuickPlay, onSettings, onLeaderboard, onCredits }) {
  return (
    <Screen title="DODGEBALL" subtitle="Platformer showdown — dodge, catch, throw.">
      <div className="flex flex-col items-center gap-3">
        <button className={btn} onClick={() => { sfx.click(); onPlay() }}>PLAY</button>
        <button className={btn + ' bg-gradient-to-b from-emerald-500 to-emerald-700'} onClick={() => { sfx.click(); onQuickPlay() }}>QUICK PLAY</button>
        <button className={btnAlt} onClick={() => { sfx.click(); onLeaderboard() }}>Leaderboard</button>
        <button className={btnAlt} onClick={() => { sfx.click(); onInstructions() }}>Instructions</button>
        <button className={btnAlt} onClick={() => { sfx.click(); onSettings() }}>Settings</button>
        <button className={btnAlt} onClick={() => { sfx.click(); onCredits() }}>Credits</button>
      </div>
      <p className="text-center text-slate-400 text-sm mt-8">Made for vibe coders. Best of 3 sets. Winner stays king.</p>
    </Screen>
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
      <div className="max-w-3xl mx-auto space-y-4">
        <Section title="About">
          <p>A 2D platformer dodgeball game — solo or local 2P — with 6 fighters, 4 maps, four CPU tiers, a Survival Ladder, cosmetic skins, difficulty modifiers, and arena hazards. Built to be picked up in seconds and mastered over hundreds of matches.</p>
        </Section>

        <Section title="Design & Direction">
          <p>Hadi — game design, character roster, match pacing, art direction, vibe QA.</p>
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
                  <div className="font-bold">{c?.name || r.char}</div>
                  <div className="text-xs text-slate-400">{date.toLocaleDateString()}</div>
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
    { id: '1p', name: '1P vs CPU', desc: 'Play against the AI' },
    { id: '2p', name: '2P Local', desc: 'Two players, one keyboard' },
    { id: 'ladder', name: 'Survival Ladder', desc: 'Beat all 6 fighters, rising difficulty' },
    { id: 'practice', name: 'Practice Arena', desc: 'Warm up, no score' },
  ]
  return (
    <Screen title="SELECT MODE" onBack={onBack}>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {modes.map(m => (
          <button key={m.id} onClick={() => { sfx.click(); onPick(m.id) }}
            className="p-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-400 text-left transition">
            <div className="text-2xl font-bold text-cyan-300">{m.name}</div>
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

export function CharacterSelect({ label, exclude, onPick, onBack }) {
  const [skins, setSkins] = useState(loadLastSkins())
  const setSkin = (id, idx) => {
    const next = { ...skins, [id]: idx }; setSkins(next); saveLastSkin(id, idx); sfx.click()
  }
  return (
    <Screen title={label} subtitle="Choose your fighter. Tap a color dot for a skin." onBack={onBack}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CHARACTERS.map(c => {
          const dis = exclude === c.id
          const skinIdx = skins[c.id] || 0
          const skin = (c.skins && c.skins[skinIdx]) || c
          return (
            <div key={c.id}
              className={`p-4 rounded-xl border text-left transition ${dis ? 'opacity-40 border-slate-700 bg-slate-800/50' : 'border-slate-600 bg-slate-800 hover:border-cyan-400'}`}>
              <button
                disabled={dis}
                onClick={() => { if (!dis) { sfx.click(); onPick(c.id, skinIdx) } }}
                className={`w-full text-left ${dis ? 'cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg flex-shrink-0 border-2" style={{ background: skin.color, borderColor: skin.accent }} />
                  <div>
                    <div className="text-xl font-black">{c.name}</div>
                    <div className="text-xs text-slate-400 italic">{c.vibe}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-200 space-y-1">
                  <div>Speed <Stars n={STAT_STARS.speed[c.id]} /></div>
                  <div>Strength <Stars n={STAT_STARS.strength[c.id]} /></div>
                  <div>Jump <Stars n={STAT_STARS.jump[c.id]} /></div>
                </div>
                {c.perk && (
                  <div className="mt-3 rounded-lg px-2 py-1.5 bg-gradient-to-r from-fuchsia-900/60 to-cyan-900/60 border border-fuchsia-500/40">
                    <div className="text-xs font-bold text-fuchsia-300 uppercase tracking-wide">{c.perk.label}</div>
                    <div className="text-xs text-slate-200">{c.perk.desc}</div>
                  </div>
                )}
              </button>
              {!dis && c.skins && (
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
