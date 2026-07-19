export const ARENA_W = 1280
export const ARENA_H = 720
export const GRAVITY = 0.9
export const FLOOR_Y = 640
export const PLAYER_W = 56
export const PLAYER_H = 96
export const DUCK_H = 48
export const BALL_R = 14
export const MAX_HP = 3
export const CATCH_RANGE = 80
export const CATCH_BUFFER_MS = 180 // input-buffer window on catch press
export const THROW_CHARGE_MS = 1000

export const CHARACTERS = [
  { id: 'blaze',   name: 'BLAZE',   speed: 6, jump: 30, throwMul: 0.8, color: '#ff5c33', vibe: 'Speed demon',        shape: 'slim',    accent: '#ffd400', expression: 'smug',
    perk: { dashCdMul: 0.55, label: 'Quick Dash', desc: 'Dash cooldown cut nearly in half.' },
    skins: [
      { name: 'Default', color: '#ff5c33', accent: '#ffd400' },
      { name: 'Ember',   color: '#7f1d1d', accent: '#fb923c' },
      { name: 'Neon',    color: '#f472b6', accent: '#22d3ee' },
    ] },
  { id: 'tank',    name: 'TANK',    speed: 3, jump: 15, throwMul: 1.4, color: '#7a4a2a', vibe: 'Heavy hitter',       shape: 'bulky',   accent: '#facc15', expression: 'angry',
    perk: { catchWindowMul: 1.5, label: 'Iron Hands', desc: 'Catch window is 50% bigger.' },
    skins: [
      { name: 'Default', color: '#7a4a2a', accent: '#facc15' },
      { name: 'Bronze',  color: '#92400e', accent: '#fde68a' },
      { name: 'Steel',   color: '#475569', accent: '#e2e8f0' },
    ] },
  { id: 'nova',    name: 'NOVA',    speed: 5, jump: 22, throwMul: 1.0, color: '#8a5cf6', vibe: 'All-around',         shape: 'normal',  accent: '#f0abfc', expression: 'focused',
    perk: { chargeSpeedMul: 1.35, label: 'Quick Draw', desc: 'Throws charge 35% faster.' },
    skins: [
      { name: 'Default', color: '#8a5cf6', accent: '#f0abfc' },
      { name: 'Sunset',  color: '#e11d48', accent: '#fde047' },
      { name: 'Frost',   color: '#0369a1', accent: '#a5f3fc' },
    ] },
  { id: 'ghost',   name: 'GHOST',   speed: 5, jump: 28, throwMul: 0.7, color: '#9adfff', vibe: 'Aerial specialist',  shape: 'ghost',   accent: '#ffffff', expression: 'mischievous',
    perk: { doubleJump: true, label: 'Double Jump', desc: 'Can jump a second time in mid-air.' },
    skins: [
      { name: 'Default', color: '#9adfff', accent: '#ffffff' },
      { name: 'Void',    color: '#312e81', accent: '#a78bfa' },
      { name: 'Mint',    color: '#a7f3d0', accent: '#ecfeff' },
    ] },
  { id: 'crusher', name: 'CRUSHER', speed: 3, jump: 32, throwMul: 1.2, color: '#22c55e', vibe: 'Jump powerhouse',    shape: 'tall',    accent: '#166534', expression: 'intense',
    perk: { uncatchableAt: 0.9, label: 'Cannon Shot', desc: 'Max-charge throws cannot be caught.' },
    skins: [
      { name: 'Default', color: '#22c55e', accent: '#166534' },
      { name: 'Jungle',  color: '#065f46', accent: '#facc15' },
      { name: 'Storm',   color: '#334155', accent: '#38bdf8' },
    ] },
  { id: 'striker', name: 'STRIKER', speed: 7, jump: 12, throwMul: 0.9, color: '#facc15', vibe: 'Ground speedster',   shape: 'short',   accent: '#0f172a', expression: 'cocky',
    perk: { dashPowerMul: 1.6, label: 'Blitz Dash', desc: 'Dashes travel 60% farther.' },
    skins: [
      { name: 'Default', color: '#facc15', accent: '#0f172a' },
      { name: 'Coral',   color: '#fb7185', accent: '#831843' },
      { name: 'Lime',    color: '#84cc16', accent: '#1a2e05' },
    ] },
]

export const STAT_STARS = {
  speed:    { blaze: 2, tank: 1, nova: 2, ghost: 2, crusher: 1, striker: 3 },
  strength: { blaze: 1, tank: 3, nova: 2, ghost: 1, crusher: 2, striker: 1 },
  jump:     { blaze: 2, tank: 1, nova: 1, ghost: 2, crusher: 2, striker: 1 },
}

export const MAPS = [
  {
    id: 'arena', name: 'ARENA',
    bg: ['#0b1024', '#1a1044'],
    accent: '#22d3ee',
    platforms: [
      { x: 300, y: 480, w: 220, h: 18 },
      { x: 760, y: 480, w: 220, h: 18 },
      { x: 540, y: 340, w: 200, h: 18 },
    ],
  },
  {
    id: 'gym', name: 'GYM',
    bg: ['#2a1a0a', '#5a3820'],
    accent: '#f59e0b',
    platforms: [
      { x: 480, y: 500, w: 320, h: 22 },
      { x: 180, y: 560, w: 180, h: 18 },
      { x: 920, y: 560, w: 180, h: 18 },
    ],
  },
  {
    id: 'beach', name: 'BEACH',
    bg: ['#0ea5e9', '#fde68a'],
    accent: '#f97316',
    platforms: [
      { x: 200, y: 520, w: 260, h: 22 },
      { x: 820, y: 500, w: 260, h: 22 },
      { x: 540, y: 400, w: 200, h: 18 },
    ],
  },
  {
    id: 'rooftop', name: 'ROOFTOP',
    bg: ['#0f172a', '#4c1d95'],
    accent: '#e879f9',
    platforms: [
      { x: 120, y: 460, w: 220, h: 22 },
      { x: 940, y: 460, w: 220, h: 22 },
      { x: 560, y: 300, w: 160, h: 18 },
    ],
  },
]

export const DIFFICULTIES = [
  { id: 'easy', name: 'EASY' },
  { id: 'medium', name: 'MEDIUM' },
  { id: 'hard', name: 'HARD' },
  { id: 'impossible', name: 'IMPOSSIBLE' },
]

export const P1_KEYS = { left: 'KeyA', right: 'KeyD', jump: 'KeyW', duck: 'KeyS', throw: 'KeyF', catch: 'KeyG' }
export const P2_KEYS = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', duck: 'ArrowDown', throw: 'Comma', catch: 'Period' }

export const MODIFIERS = [
  { id: 'chaos',    label: 'Chaos',        desc: 'Double the balls in play.' },
  { id: 'glass',    label: 'Glass Cannon', desc: 'Everyone starts with just 1 HP.' },
  { id: 'slowmo',   label: 'Slow-Mo',      desc: 'World runs at 60% speed. More time to react.' },
  { id: 'bighead',  label: 'Big Head',     desc: 'Larger head hitboxes — harder to hide behind.' },
  { id: 'noperks',  label: 'Vanilla',      desc: 'Character perks disabled.' },
  { id: 'hazards',  label: 'Hazards',      desc: 'Map-themed projectiles fall from the sky every few seconds.' },
]

export const HAZARD_STYLE = {
  arena:   { color: '#22d3ee', ring: '#67e8f9', shape: 'bolt', dmg: 1 },
  gym:     { color: '#f97316', ring: '#fdba74', shape: 'ball', dmg: 1 },
  beach:   { color: '#78350f', ring: '#a3e635', shape: 'coconut', dmg: 1 },
  rooftop: { color: '#64748b', ring: '#e879f9', shape: 'aircon', dmg: 1 },
}
