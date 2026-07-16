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

// Procedural looping music — each mode has its own instrument, tempo, and bass layer
let musicTimer = null
let musicTimer2 = null

const MUSIC_PRESETS = {
  menu: {
    lead:  { notes: [523, 659, 784, 988, 784, 659, 523, 392], type: 'triangle', step: 260, vol: 0.30, attack: 0.03, release: 0.9 },
    bass:  { notes: [131, 131, 165, 175], type: 'sine',     step: 520, vol: 0.22, attack: 0.02, release: 0.55 },
  },
  battle: {
    lead:  { notes: [220, 262, 330, 262, 349, 330, 262, 220, 262, 330, 392, 330], type: 'sawtooth', step: 140, vol: 0.18, attack: 0.005, release: 0.85 },
    bass:  { notes: [55, 55, 55, 87, 82, 82, 82, 110], type: 'square', step: 280, vol: 0.16, attack: 0.005, release: 0.6 },
  },
  win: {
    lead:  { notes: [523, 659, 784, 1046, 1318, 1046, 1318, 1568], type: 'triangle', step: 180, vol: 0.32, attack: 0.02, release: 0.7 },
    bass:  { notes: [131, 165, 196, 262], type: 'sine', step: 360, vol: 0.24, attack: 0.02, release: 0.5 },
  },
  loss: {
    lead:  { notes: [220, 196, 175, 165, 175, 196, 175, 165], type: 'sine', step: 420, vol: 0.28, attack: 0.06, release: 0.95 },
    bass:  { notes: [55, 55, 49, 44], type: 'triangle', step: 840, vol: 0.20, attack: 0.05, release: 0.75 },
  },
}

function scheduleTrack(a, preset, dest, timerHolder) {
  let i = 0
  const tick = () => {
    if (!dest.node) return
    const o = a.createOscillator()
    o.type = preset.type
    o.frequency.setValueAtTime(preset.notes[i % preset.notes.length], a.currentTime)
    const g = a.createGain()
    const dur = (preset.step / 1000) * preset.release
    g.gain.setValueAtTime(0.0001, a.currentTime)
    g.gain.exponentialRampToValueAtTime(preset.vol, a.currentTime + preset.attack)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
    o.connect(g).connect(dest.node)
    o.start(); o.stop(a.currentTime + dur + 0.02)
    i++
    timerHolder.h = setTimeout(tick, preset.step)
  }
  tick()
}

export function playMusic(mode = 'menu') {
  currentMode = mode
  stopMusic()
  if (muted) return
  const a = ac(); if (!a) return
  const preset = MUSIC_PRESETS[mode] || MUSIC_PRESETS.menu
  musicGain = a.createGain(); musicGain.gain.value = 1.0; musicGain.connect(a.destination)
  const dest = { node: musicGain }
  const leadT = { h: null }, bassT = { h: null }
  scheduleTrack(a, preset.lead, dest, leadT)
  scheduleTrack(a, preset.bass, dest, bassT)
  musicTimer  = leadT
  musicTimer2 = bassT
}

export function stopMusic() {
  if (musicTimer && musicTimer.h)  { clearTimeout(musicTimer.h)  }
  if (musicTimer2 && musicTimer2.h) { clearTimeout(musicTimer2.h) }
  musicTimer = null; musicTimer2 = null
  if (musicGain) { try { musicGain.disconnect() } catch {} musicGain = null }
}
