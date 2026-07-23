import React, { useEffect, useState } from 'react'
import { TitleScreen, InstructionsScreen, SettingsScreen, LeaderboardScreen, CreditsScreen, ModeSelect, MatchTypeSelect, DifficultySelect, CharacterSelect, MapSelect, LadderIntro, ModifiersScreen } from './components/Menus.jsx'
import { SignInScreen, RegisterScreen, LegalScreen, AccountMenu } from './components/Auth.jsx'
import EditProfile from './components/EditProfile.jsx'
import OnlineMatch from './components/OnlineMatch.jsx'
import OnlineLadder from './components/OnlineLadder.jsx'
import GlobalLeaderboard from './components/GlobalLeaderboard.jsx'
import GameCanvas from './components/GameCanvas.jsx'
import LevelUpScreen from './components/LevelUpScreen.jsx'
import DailyChallengesScreen from './components/DailyChallengesScreen.jsx'
import StreakReward from './components/StreakReward.jsx'
import FriendsScreen from './components/FriendsScreen.jsx'
import InviteToast from './components/InviteToast.jsx'
import { acceptInvite as libAcceptInvite } from './lib/party.js'
import { playMusic, stopMusic, resumeAudio } from './game/sfx.js'
import { CHARACTERS, MAPS, DIFFICULTIES } from './game/constants.js'
import { addRecord, bestForCharacter, getRecords, formatTime } from './game/ladderStore.js'
import { xpToLevel, xpForNextLevel } from './game/progressionConstants.js'
import { awardMatchRewards, awardLadderRewards } from './lib/progression.js'
import { useAuth } from './lib/useAuth.js'

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
    p1Skin: 0,
    p2Skin: 0,
    map: null,
    hideEndButtons: false,
  })
  const [ladder, setLadder] = useState(null) // { p1, opponents, current, victoryOverall, startedAt, clearMs }
  const auth = useAuth()
  const [legalKind, setLegalKind] = useState(null) // 'tos' | 'privacy' | null
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [levelUpResult, setLevelUpResult] = useState(null) // { result, characterId }
  const [pendingJoin, setPendingJoin] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('join')
      return code ? code.toUpperCase().slice(0, 6) : null
    } catch { return null }
  })

  // Once we have a session + profile, honor a pending ?join= link
  useEffect(() => {
    if (pendingJoin && auth.session && auth.profile && screen !== 'online') {
      setScreen('online')
    }
  }, [pendingJoin, auth.session, auth.profile])

  // If a fresh visitor lands on ?join=CODE without an account,
  // push them to sign in first
  useEffect(() => {
    if (pendingJoin && !auth.session && !auth.loading && screen === 'title') {
      setScreen('signin')
    }
  }, [pendingJoin, auth.session, auth.loading])

  // As soon as a valid session appears, leave the sign-in screen automatically.
  // If they came from an invite link, the pendingJoin effect above sends them
  // to the online lobby; otherwise land them on the title with the account chip.
  useEffect(() => {
    if (auth.session && screen === 'signin' && !pendingJoin) {
      setScreen('title')
    }
  }, [auth.session, screen, pendingJoin])

  // Clear the join code from the URL once consumed, so refresh doesn't loop
  useEffect(() => {
    if (screen === 'online' && pendingJoin) {
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('join')
        window.history.replaceState({}, '', url.toString())
      } catch {}
    }
  }, [screen, pendingJoin])

  useEffect(() => {
    if (screen === 'game') { stopMusic() } else { playMusic('menu') }
    return () => {}
  }, [screen])

  // Unlock Web Audio on first user gesture (browsers require it before playback)
  useEffect(() => {
    const unlock = () => {
      resumeAudio()
      if (screen !== 'game') playMusic('menu')
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: false })
    window.addEventListener('keydown', unlock, { once: false })
    window.addEventListener('touchstart', unlock, { once: false })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [])

  const start = () => {
    resumeAudio()
    setScreen('game')
  }

  const backToTitle = () => setScreen('title')

  // Legal pages take priority — reachable from anywhere
  if (legalKind) {
    return <LegalScreen kind={legalKind} onBack={() => setLegalKind(null)} />
  }

  // If signed in but has no profile, force registration
  if (auth.session && !auth.loading && !auth.profile) {
    return (
      <RegisterScreen
        session={auth.session}
        onSave={auth.saveProfile}
        onOpenLegal={(k) => setLegalKind(k)}
        onSignOut={auth.signOut}
      />
    )
  }

  // If the sign-in screen is open, show only that
  if (screen === 'signin') {
    return (
      <SignInScreen
        onBack={backToTitle}
        onSignIn={auth.signInWithEmail}
        onVerifyCode={auth.verifyEmailCode}
        onOpenLegal={(k) => setLegalKind(k)}
      />
    )
  }

  const accountChip = (
    <div className="fixed top-2 right-2 z-30">
      {auth.session && auth.profile ? (
        <button
          onClick={() => setShowAccountMenu(v => !v)}
          className="pl-1 pr-3 py-1 rounded-full bg-slate-800/80 border border-cyan-400/40 hover:bg-slate-700 text-white text-sm font-semibold shadow flex items-center gap-2"
        >
          <span className="w-7 h-7 rounded-full overflow-hidden bg-slate-700 border border-cyan-300 flex items-center justify-center relative">
            {auth.profile.avatar_url ? (
              <img src={auth.profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">👤</span>
            )}
            {auth.progression?.progression && (
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-slate-900">
                {auth.progression.progression.level}
              </span>
            )}
          </span>
          {auth.profile.display_name}
        </button>
      ) : !auth.loading ? (
        <button
          onClick={() => { setScreen('signin') }}
          className="px-3 py-1.5 rounded-full bg-cyan-700 hover:bg-cyan-600 border border-cyan-300/50 text-white text-sm font-semibold shadow"
        >
          Sign in
        </button>
      ) : null}
      {showAccountMenu && (
        <AccountMenu
          profile={auth.profile}
          session={auth.session}
          progression={auth.progression}
          onEditProfile={() => { setShowAccountMenu(false); setScreen('editProfile') }}
          onSignOut={() => { setShowAccountMenu(false); auth.signOut() }}
          onClose={() => setShowAccountMenu(false)}
        />
      )}
    </div>
  )

  return (
    <>
      {screen !== 'game' && accountChip}
      {screen === 'title' && (
        <TitleScreen
          onPlay={() => setScreen('mode')}
          onInstructions={() => setScreen('instructions')}
          onSettings={() => setScreen('settings')}
          onLeaderboard={() => setScreen('leaderboard')}
          onGlobalLeaderboard={() => setScreen('globalLeaderboard')}
          onCredits={() => setScreen('credits')}
          onDaily={auth.session ? () => setScreen('dailyChallenges') : null}
          onFriends={auth.session ? () => setScreen('friends') : null}
          friendRequests={auth.pendingFriendCount || 0}
          dailyUnclaimed={0}
          streak={auth.progression?.progression?.current_streak || 0}
          onQuickPlay={() => {
            const p1c = pick(CHARACTERS); const p1 = p1c.id
            const p2Pool = CHARACTERS.filter(c => c.id !== p1)
            const p2c = pick(p2Pool); const p2 = p2c.id
            setCfg({
              mode: '1p', matchType: '1v1', difficulty: 'medium',
              p1Char: p1, p2Char: p2,
              p1Skin: Math.floor(Math.random() * (p1c.skins?.length || 1)),
              p2Skin: Math.floor(Math.random() * (p2c.skins?.length || 1)),
              map: pick(MAPS).id,
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
      {screen === 'leaderboard' && (
        <LeaderboardScreen onBack={backToTitle} />
      )}
      {screen === 'credits' && (
        <CreditsScreen onBack={backToTitle} />
      )}
      {screen === 'editProfile' && auth.session && auth.profile && (
        <EditProfile
          session={auth.session}
          profile={auth.profile}
          onSave={auth.saveProfile}
          onDone={backToTitle}
        />
      )}
      {screen === 'online' && auth.session && auth.profile && (
        <OnlineMatch
          profile={auth.profile}
          progression={auth.progression}
          session={auth.session}
          onExit={() => { setPendingJoin(null); backToTitle() }}
          autoJoinCode={pendingJoin}
          onMatchOver={async ({ won, character }) => {
            if (!auth.session?.user?.id) return
            const result = await awardMatchRewards(auth.session.user.id, auth.progression?.progression, {
              won, hits: 0, catches: 0, kos: 0, roundWins: 0, character,
            })
            auth.refreshProgression()
            if (won && result) setLevelUpResult({ result, characterId: character })
          }}
        />
      )}
      {screen === 'onlineLadder' && auth.session && auth.profile && (
        <OnlineLadder
          profile={auth.profile}
          session={auth.session}
          progression={auth.progression}
          onExit={backToTitle}
          onLadderOver={async ({ cleared, fightsWon, character }) => {
            if (!auth.session?.user?.id) return
            const result = await awardLadderRewards(auth.session.user.id, auth.progression?.progression, {
              cleared, fightsWon, character,
            })
            auth.refreshProgression()
            if (cleared && result) setLevelUpResult({ result, characterId: character })
          }}
        />
      )}
      {screen === 'globalLeaderboard' && (
        <GlobalLeaderboard onBack={backToTitle} />
      )}
      {screen === 'mode' && (
        <ModeSelect
          onBack={backToTitle}
          onPick={(m) => {
            if (m === 'online') {
              if (!auth.session || !auth.profile) { setScreen('signin'); return }
              setScreen('online')
              return
            }
            if (m === 'onlineLadder') {
              if (!auth.session || !auth.profile) { setScreen('signin'); return }
              setScreen('onlineLadder')
              return
            }
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
          progression={auth.progression}
          session={auth.session}
          onProgressionRefresh={auth.refreshProgression}
          onPick={(id, skinIdx) => {
            const opponents = buildLadder(id)
            setLadder({ p1: id, p1Skin: skinIdx || 0, opponents, current: 0, victoryOverall: false, startedAt: Date.now(), clearMs: null })
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
          clearMs={ladder.clearMs}
          onQuit={backToTitle}
          onNext={() => {
            if (ladder.victoryOverall) { backToTitle(); return }
            const opp = ladder.opponents[ladder.current]
            setCfg({
              mode: '1p', matchType: '1v1',
              difficulty: opp.difficulty,
              p1Char: ladder.p1, p2Char: opp.char,
              p1Skin: ladder.p1Skin || 0, p2Skin: 0,
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
          progression={auth.progression}
          session={auth.session}
          onProgressionRefresh={auth.refreshProgression}
          onPick={(id, skinIdx) => {
            setCfg(c => ({ ...c, p1Char: id, p1Skin: skinIdx || 0 }))
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
          progression={auth.progression}
          session={auth.session}
          onProgressionRefresh={auth.refreshProgression}
          onPick={(id, skinIdx) => { setCfg(c => ({ ...c, p2Char: id, p2Skin: skinIdx || 0 })); setScreen('map') }}
        />
      )}
      {screen === 'p2cpu' && (
        <CharacterSelect
          label={cfg.mode === 'practice' ? 'PICK CPU CHARACTER' : 'PICK OPPONENT CHARACTER'}
          onBack={() => setScreen(cfg.mode === '1p' ? 'difficulty1p' : 'p1')}
          onPick={(id, skinIdx) => { setCfg(c => ({ ...c, p2Char: id, p2Skin: skinIdx || 0 })); setScreen('map') }}
        />
      )}
      {screen === 'map' && (
        <MapSelect
          onBack={() => setScreen(cfg.mode === '2p' ? 'p2' : 'p2cpu')}
          onPick={(m) => {
            setCfg(c => ({ ...c, map: m }))
            // Practice skips modifiers; everything else offers them
            if (cfg.mode === 'practice') start()
            else setScreen('modifiers')
          }}
        />
      )}
      {screen === 'modifiers' && (
        <ModifiersScreen
          onBack={() => setScreen('map')}
          onStart={(mods) => { setCfg(c => ({ ...c, modifiers: mods })); start() }}
        />
      )}
      {screen === 'game' && cfg.mode && cfg.p1Char && cfg.p2Char && cfg.map && (
        <GameCanvas
          config={cfg}
          profile={auth.profile}
          session={auth.session}
          onRewardsEarned={async (summary) => {
            if (!auth.session?.user?.id) return
            const result = await awardMatchRewards(auth.session.user.id, auth.progression?.progression, summary)
            auth.refreshProgression()
            if (summary.won && result) setLevelUpResult({ result, characterId: summary.character })
          }}
          onExit={backToTitle}
          onMatchEnd={(winnerSide) => {
            if (ladder && cfg.hideEndButtons) {
              if (winnerSide === 'left') {
                const next = ladder.current + 1
                const done = next >= ladder.opponents.length
                let clearMs = ladder.clearMs
                if (done) {
                  clearMs = Date.now() - ladder.startedAt
                  addRecord({ char: ladder.p1, timeMs: clearMs, name: auth.profile?.username })
                }
                setLadder({ ...ladder, current: done ? ladder.current : next, victoryOverall: done, clearMs })
                setTimeout(() => setScreen('ladderIntro'), 1600)
              } else {
                setTimeout(() => {
                  setLadder(null)
                  setScreen('title')
                }, 1800)
              }
            }
          }}
        />
      )}
      {screen === 'dailyChallenges' && (
        <DailyChallengesScreen
          session={auth.session}
          progression={auth.progression}
          onProgressionRefresh={auth.refreshProgression}
          onBack={backToTitle}
        />
      )}
      {screen === 'friends' && (
        <FriendsScreen
          session={auth.session}
          onBack={() => { auth.refreshFriends?.(); backToTitle() }}
        />
      )}
      {levelUpResult && (
        <LevelUpScreen
          result={levelUpResult.result}
          characterId={levelUpResult.characterId}
          onDone={() => setLevelUpResult(null)}
        />
      )}
      {auth.streakReward && (
        <StreakReward
          streak={auth.streakReward.streak}
          reward={auth.streakReward.reward}
          longest={auth.streakReward.longest}
          onClose={auth.dismissStreak}
        />
      )}
      {screen !== 'game' && (
        <InviteToast
          invites={auth.partyInvites || []}
          onAccept={async (inv) => {
            await libAcceptInvite(inv.id)
            setPendingJoin(inv.join_code)
            setScreen('online')
            auth.refreshInvites?.()
          }}
          onDecline={(inv) => auth.dismissInvite?.(inv.id)}
        />
      )}
    </>
  )
}
