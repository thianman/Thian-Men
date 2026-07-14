import React, { useEffect, useState } from 'react'
import { TitleScreen, InstructionsScreen, ModeSelect, MatchTypeSelect, DifficultySelect, CharacterSelect, MapSelect } from './components/Menus.jsx'
import GameCanvas from './components/GameCanvas.jsx'
import { playMusic, stopMusic, resumeAudio } from './game/sfx.js'

export default function App() {
  const [screen, setScreen] = useState('title')
  const [cfg, setCfg] = useState({
    mode: null,           // '1p' | '2p' | 'practice'
    matchType: '1v1',     // '1v1' | '2v2'
    difficulty: 'medium',
    p1Char: null,
    p2Char: null,
    map: null,
  })

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
        <TitleScreen onPlay={() => setScreen('mode')} onInstructions={() => setScreen('instructions')} />
      )}
      {screen === 'instructions' && (
        <InstructionsScreen onBack={backToTitle} />
      )}
      {screen === 'mode' && (
        <ModeSelect
          onBack={backToTitle}
          onPick={(m) => {
            setCfg(c => ({ ...c, mode: m }))
            if (m === '2p') setScreen('matchType')
            else setScreen('p1')
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
        <GameCanvas config={cfg} onExit={backToTitle} />
      )}
    </>
  )
}
