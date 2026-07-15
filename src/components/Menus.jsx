import React, { useState } from 'react'
import { CHARACTERS, MAPS, DIFFICULTIES, STAT_STARS } from '../game/constants.js'
import { sfx, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted } from '../game/sfx.js'

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

export function TitleScreen({ onPlay, onInstructions, onQuickPlay, onSettings }) {
  return (
    <Screen title="DODGEBALL" subtitle="Platformer showdown — dodge, catch, throw.">
      <div className="flex flex-col items-center gap-3">
        <button className={btn} onClick={() => { sfx.click(); onPlay() }}>PLAY</button>
        <button className={btn + ' bg-gradient-to-b from-emerald-500 to-emerald-700'} onClick={() => { sfx.click(); onQuickPlay() }}>QUICK PLAY</button>
        <button className={btnAlt} onClick={() => { sfx.click(); onInstructions() }}>Instructions</button>
        <button className={btnAlt} onClick={() => { sfx.click(); onSettings() }}>Settings</button>
      </div>
      <p className="text-center text-slate-400 text-sm mt-8">Made for vibe coders. Best of 3 sets. Winner stays king.</p>
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

export function CharacterSelect({ label, exclude, onPick, onBack }) {
  return (
    <Screen title={label} subtitle="Choose your fighter." onBack={onBack}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CHARACTERS.map(c => {
          const dis = exclude === c.id
          return (
            <button
              key={c.id}
              disabled={dis}
              onClick={() => { if (!dis) { sfx.click(); onPick(c.id) } }}
              className={`p-4 rounded-xl border text-left transition ${dis ? 'opacity-40 border-slate-700 bg-slate-800/50 cursor-not-allowed' : 'border-slate-600 bg-slate-800 hover:border-cyan-400 hover:bg-slate-700'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg flex-shrink-0" style={{ background: c.color }} />
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
          )
        })}
      </div>
    </Screen>
  )
}

export function LadderIntro({ p1Char, opponents, current, onNext, onQuit, victoryOverall }) {
  const opp = opponents[current]
  const oppChar = opp ? CHARACTERS.find(c => c.id === opp.char) : null
  return (
    <Screen title={victoryOverall ? 'LADDER CLEARED!' : `FIGHT ${current + 1} / ${opponents.length}`}
            subtitle={victoryOverall ? 'You beat every fighter on the ladder.' : 'Prepare for your next opponent.'}>
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

export function MapSelect({ onPick, onBack }) {
  return (
    <Screen title="SELECT MAP" onBack={onBack}>
      <div className="grid md:grid-cols-3 gap-4">
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
