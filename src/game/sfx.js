let ctx = null
let musicOsc = null
let musicGain = null
let muted = false
let sfxMuted = false
let currentMode = null

try {
  muted = localStorage.getItem('db_music_muted') === '1'
  sfxMuted = localStorage.getItem('db_sfx_muted') === '1'
} catch {}

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { ctx = null }
  }
  return ctx
}

export function resumeAudio() {
  const a = ac(); if (a && a.state === 'suspended') a.resume()
}

export function setMusicMuted(m) {
  muted = m
  try { localStorage.setItem('db_music_muted', m ? '1' : '0') } catch {}
  if (m) stopMusic()
  else if (currentMode) playMusic(currentMode)
}
export function setSfxMuted(m) {
  sfxMuted = m
  try { localStorage.setItem('db_sfx_muted', m ? '1' : '0') } catch {}
}
export function isMusicMuted() { return muted }
export function isSfxMuted() { return sfxMuted }

function beep({ freq = 440, dur = 0.1, type = 'square', vol = 0.15, slide = 0 }) {
  const a = ac(); if (!a || sfxMuted) return
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), a.currentTime + dur)
  g.gain.setValueAtTime(vol, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g).connect(a.destination)
  o.start(); o.stop(a.currentTime + dur)
}

export const sfx = {
  throw:  () => beep({ freq: 220, dur: 0.08, type: 'square', slide: 120 }),
  catch:  () => beep({ freq: 880, dur: 0.12, type: 'sine', slide: 300 }),
  hit:    () => beep({ freq: 140, dur: 0.18, type: 'sawtooth', slide: -80, vol: 0.22 }),
  round:  () => { beep({ freq: 660, dur: 0.1, type: 'triangle' }); setTimeout(()=>beep({ freq: 990, dur: 0.15, type: 'triangle' }), 100) },
  match:  () => { [523, 659, 784, 1046].forEach((f,i)=>setTimeout(()=>beep({ freq: f, dur: 0.18, type: 'triangle' }), i*120)) },
  jump:   () => beep({ freq: 500, dur: 0.06, type: 'sine', slide: 200, vol: 0.08 }),
  click:  () => beep({ freq: 400, dur: 0.04, type: 'square', vol: 0.1 }),
}

// Simple procedural looping music using scheduled notes
let musicTimer = null
export function playMusic(mode = 'menu') {
  currentMode = mode
  stopMusic()
  if (muted) return
  const a = ac(); if (!a) return
  const scales = {
    menu:   [261, 329, 392, 523, 392, 329],
    battle: [220, 262, 330, 392, 330, 262, 196, 262],
    win:    [523, 659, 784, 1046, 784, 1046],
    loss:   [220, 196, 174, 164, 174, 196],
  }
  const notes = scales[mode] || scales.menu
  const step = mode === 'battle' ? 180 : 260
  musicGain = a.createGain(); musicGain.gain.value = 0.12; musicGain.connect(a.destination)
  let i = 0
  const tick = () => {
    if (!musicGain) return
    const o = a.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(notes[i % notes.length], a.currentTime)
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + step / 1000)
    o.connect(g).connect(musicGain)
    o.start(); o.stop(a.currentTime + step / 1000 + 0.02)
    i++
    musicTimer = setTimeout(tick, step)
  }
  tick()
}

export function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null }
  if (musicGain) { try { musicGain.disconnect() } catch {} musicGain = null }
}
