export const ARENA_W = 1280
export const ARENA_H = 720
export const GRAVITY = 0.9
export const FLOOR_Y = 640
export const PLAYER_W = 56
export const PLAYER_H = 96
export const DUCK_H = 48
export const BALL_R = 14
export const MAX_HP = 3
export const CATCH_RANGE = 60
export const THROW_CHARGE_MS = 1000

export const CHARACTERS = [
  { id: 'blaze',   name: 'BLAZE',   speed: 6, jump: 30, throwMul: 0.8, color: '#ff5c33', vibe: 'Speed demon',        shape: 'slim',    accent: '#ffd400',
    perk: { dashCdMul: 0.55, label: 'Quick Dash', desc: 'Dash cooldown cut nearly in half.' } },
  { id: 'tank',    name: 'TANK',    speed: 3, jump: 15, throwMul: 1.4, color: '#7a4a2a', vibe: 'Heavy hitter',       shape: 'bulky',   accent: '#facc15',
    perk: { catchWindowMul: 1.5, label: 'Iron Hands', desc: 'Catch window is 50% bigger.' } },
  { id: 'nova',    name: 'NOVA',    speed: 5, jump: 22, throwMul: 1.0, color: '#8a5cf6', vibe: 'All-around',         shape: 'normal',  accent: '#f0abfc',
    perk: { chargeSpeedMul: 1.35, label: 'Quick Draw', desc: 'Throws charge 35% faster.' } },
  { id: 'ghost',   name: 'GHOST',   speed: 5, jump: 28, throwMul: 0.7, color: '#9adfff', vibe: 'Aerial specialist',  shape: 'ghost',   accent: '#ffffff',
    perk: { doubleJump: true, label: 'Double Jump', desc: 'Can jump a second time in mid-air.' } },
  { id: 'crusher', name: 'CRUSHER', speed: 3, jump: 32, throwMul: 1.2, color: '#22c55e', vibe: 'Jump powerhouse',    shape: 'tall',    accent: '#166534',
    perk: { uncatchableAt: 0.9, label: 'Cannon Shot', desc: 'Max-charge throws cannot be caught.' } },
  { id: 'striker', name: 'STRIKER', speed: 7, jump: 12, throwMul: 0.9, color: '#facc15', vibe: 'Ground speedster',   shape: 'short',   accent: '#0f172a',
    perk: { dashPowerMul: 1.6, label: 'Blitz Dash', desc: 'Dashes travel 60% farther.' } },
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
]
