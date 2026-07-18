// Server-side game constants. Kept in sync with the client's constants.
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
  { id: 'blaze',   speed: 6, jump: 30, throwMul: 0.8, perk: { dashCdMul: 0.55 } },
  { id: 'tank',    speed: 3, jump: 15, throwMul: 1.4, perk: { catchWindowMul: 1.5 } },
  { id: 'nova',    speed: 5, jump: 22, throwMul: 1.0, perk: { chargeSpeedMul: 1.35 } },
  { id: 'ghost',   speed: 5, jump: 28, throwMul: 0.7, perk: { doubleJump: true } },
  { id: 'crusher', speed: 3, jump: 32, throwMul: 1.2, perk: { uncatchableAt: 0.9 } },
  { id: 'striker', speed: 7, jump: 12, throwMul: 0.9, perk: { dashPowerMul: 1.6 } },
]

export const MAPS = [
  { id: 'arena',   platforms: [ { x: 300, y: 480, w: 220, h: 18 }, { x: 760, y: 480, w: 220, h: 18 }, { x: 540, y: 340, w: 200, h: 18 } ] },
  { id: 'gym',     platforms: [ { x: 480, y: 500, w: 320, h: 22 }, { x: 180, y: 560, w: 180, h: 18 }, { x: 920, y: 560, w: 180, h: 18 } ] },
  { id: 'beach',   platforms: [ { x: 200, y: 520, w: 260, h: 22 }, { x: 820, y: 500, w: 260, h: 22 }, { x: 540, y: 400, w: 200, h: 18 } ] },
  { id: 'rooftop', platforms: [ { x: 120, y: 460, w: 220, h: 22 }, { x: 940, y: 460, w: 220, h: 22 }, { x: 560, y: 300, w: 160, h: 18 } ] },
]
