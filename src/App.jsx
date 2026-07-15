import React, { useEffect, useState } from 'react'
import { TitleScreen, InstructionsScreen, SettingsScreen, ModeSelect, MatchTypeSelect, DifficultySelect, CharacterSelect, MapSelect, LadderIntro } from './components/Menus.jsx'
import GameCanvas from './components/GameCanvas.jsx'
import { playMusic, stopMusic, resumeAudio } from './game/sfx.js'
import { CHARACTERS, MAPS, DIFFICULTIES } from './game/constants.js'

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

const LADDER_DIFF = ['easy', 'easy', 'medium', 'medium', 'hard', 'impossible']

function buildLadder(p1) {
  const pool = CHARACTERS.filter(c => c.id !== p1).sort(() => Math.random() - 0.5)
  return pool.map((c, i) => ({ char: c.id, difficulty: LADDER_DIFF[i] || 'hard', map: pick(MAPS).id }))
}

export default function App() {
  const [screen, setScreen] = useState('title')
  const [cfg, setCfg] = useState({
    mode: null,
    matchType: '1v1',
    difficulty: 'medium',
    p1Char: null,
    p2Char: null,
    map: null,
    hideEndButtons: false,
  })
  const [ladder, setLadder] = useState(null) // { p1, opponents:[{char,difficulty,map}], current:0, victoryOverall:false }

  useEffect(() => {
    if (screen === 'game') { stopMusic() } else { playMusic('menu') }
    return () => {}
  }, [screen])

  const start = () => {
    resumeAudio()
    setScreen('game')
  }

  const backToTitle = () => setScreen('title')

  return (
    <>
      {screen === 'title' && (
        <TitleScreen
          onPlay={() => setScreen('mode')}
          onInstructions={() => setScreen('instructions')}
          onSettings={() => setScreen('settings')}
          onQuickPlay={() => {
            const p1 = pick(CHARACTERS).id
            const p2Pool = CHARACTERS.filter(c => c.id !== p1)
            const p2 = pick(p2Pool).id
            setCfg({
              mode: '1p', matchType: '1v1', difficulty: 'medium',
              p1Char: p1, p2Char: p2, map: pick(MAPS).id,
            })
            start()
          }}
        />
      )}
      {screen === 'instructions' && (
        <InstructionsScreen onBack={backToTitle} />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={backToTitle} />
      )}
      {screen === 'mode' && (
        <ModeSelect
          onBack={backToTitle}
          onPick={(m) => {
            setCfg(c => ({ ...c, mode: m }))
            if (m === '2p') setScreen('matchType')
            else if (m === 'ladder') setScreen('ladderP1')
            else setScreen('p1')
          }}
        />
      )}
      {screen === 'ladderP1' && (
        <CharacterSelect
          label="LADDER — PICK YOUR FIGHTER"
          onBack={() => setScreen('mode')}
          onPick={(id) => {
            const opponents = buildLadder(id)
            setLadder({ p1: id, opponents, current: 0, victoryOverall: false })
            setScreen('ladderIntro')
          }}
        />
      )}
      {screen === 'ladderIntro' && ladder && (
        <LadderIntro
          p1Char={ladder.p1}
          opponents={ladder.opponents}
          current={ladder.current}
          victoryOverall={ladder.victoryOverall}
          onQuit={backToTitle}
          onNext={() => {
            if (ladder.victoryOverall) { backToTitle(); return }
            const opp = ladder.opponents[ladder.current]
            setCfg({
              mode: '1p', matchType: '1v1',
              difficulty: opp.difficulty,
              p1Char: ladder.p1, p2Char: opp.char,
              map: opp.map,
              hideEndButtons: true,
            })
            start()
          }}
        />
      )}
      {screen === 'matchType' && (
        <MatchTypeSelect
          onBack={() => setScreen('mode')}
          onPick={(mt) => {
            setCfg(c => ({ ...c, matchType: mt }))
            if (mt === '2v2') setScreen('difficulty')
            else setScreen('p1')
          }}
        />
      )}
      {screen === 'difficulty' && (
        <DifficultySelect
          onBack={() => cfg.mode === '2p' ? setScreen('matchType') : setScreen('mode')}
          onPick={(d) => { setCfg(c => ({ ...c, difficulty: d })); setScreen('p1') }}
        />
      )}
      {screen === 'p1' && (
        <CharacterSelect
          label={cfg.mode === '2p' ? 'PLAYER 1 — PICK CHARACTER' : 'PICK YOUR CHARACTER'}
          onBack={() => setScreen('mode')}
          onPick={(id) => {
            setCfg(c => ({ ...c, p1Char: id }))
            if (cfg.mode === '2p') setScreen('p2')
            else if (cfg.mode === '1p') setScreen('difficulty1p')
            else setScreen('p2cpu')
          }}
        />
      )}
      {screen === 'difficulty1p' && (
        <DifficultySelect
          onBack={() => setScreen('p1')}
          onPick={(d) => { setCfg(c => ({ ...c, difficulty: d })); setScreen('p2cpu') }}
        />
      )}
      {screen === 'p2' && (
        <CharacterSelect
          label="PLAYER 2 — PICK CHARACTER"
          onBack={() => setScreen('p1')}
          onPick={(id) => { setCfg(c => ({ ...c, p2Char: id })); setScreen('map') }}
        />
      )}
      {screen === 'p2cpu' && (
        <CharacterSelect
          label={cfg.mode === 'practice' ? 'PICK CPU CHARACTER' : 'PICK OPPONENT CHARACTER'}
          onBack={() => setScreen(cfg.mode === '1p' ? 'difficulty1p' : 'p1')}
          onPick={(id) => { setCfg(c => ({ ...c, p2Char: id })); setScreen('map') }}
        />
      )}
      {screen === 'map' && (
        <MapSelect
          onBack={() => setScreen(cfg.mode === '2p' ? 'p2' : 'p2cpu')}
          onPick={(m) => { setCfg(c => ({ ...c, map: m })); start() }}
        />
      )}
      {screen === 'game' && cfg.mode && cfg.p1Char && cfg.p2Char && cfg.map && (
        <GameCanvas
          config={cfg}
          onExit={backToTitle}
          onMatchEnd={(winnerSide) => {
            if (ladder && cfg.hideEndButtons) {
              if (winnerSide === 'left') {
                // Won: advance ladder
                const next = ladder.current + 1
                const done = next >= ladder.opponents.length
                setLadder({ ...ladder, current: done ? ladder.current : next, victoryOverall: done })
                setTimeout(() => setScreen('ladderIntro'), 1600)
              } else {
                // Lost: end run
                setTimeout(() => {
                  setLadder(null)
                  setScreen('title')
                }, 1800)
              }
            }
          }}
        />
      )}
    </>
  )
}
