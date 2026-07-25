// Tutorial step definitions. Each step describes what the player should do
// and a check(state, p1) predicate that returns true once the objective is met.
// Steps are advanced sequentially by the TutorialCanvas.

export const TUTORIAL_STEPS = [
  {
    id: 'move',
    title: 'MOVE',
    text: 'Press A / D (or ← →) to walk left and right.',
    check: (state, p1, ctx) => {
      if (Math.abs(p1.vx) > 0.5) ctx.moved = (ctx.moved || 0) + 1
      return (ctx.moved || 0) > 20
    },
  },
  {
    id: 'jump',
    title: 'JUMP',
    text: 'Press W (or ↑) to jump.',
    check: (state, p1) => !p1.onGround && p1.vy < 0,
  },
  {
    id: 'pickup',
    title: 'PICK UP A BALL',
    text: 'Walk next to a ball and press F to grab it.',
    setup: (state) => {
      // Spawn an idle ball near the player
      for (const b of state.balls) {
        b.held = false; b.ownerSide = null; b.live = false; b.vx = 0; b.vy = 0
      }
      state.balls[0].x = 260
      state.balls[0].y = 640 - 14
    },
    check: (state, p1) => !!p1.holdingBall,
  },
  {
    id: 'throw',
    title: 'CHARGE & THROW',
    text: 'Hold F to charge, release to throw. Try to hit the dummy!',
    check: (state) => state.stats.left.throws > 0 || state.stats.left.hits > 0,
  },
  {
    id: 'catch',
    title: 'CATCH',
    text: 'Press G right as a ball reaches you.',
    // Setup: server-side we throw a ball at the player from the dummy.
    setup: (state) => {
      for (const b of state.balls) {
        b.held = false; b.ownerSide = null; b.vx = 0; b.vy = 0; b.live = false
      }
      // Fire one slow ball toward the player from the right
      const b = state.balls[0]
      b.x = 1050; b.y = 520
      b.vx = -6; b.vy = -3
      b.live = true; b.thrownBy = 'right'; b.chargeAtThrow = 0.4; b.aliveMs = 0
      b.uncatchable = false
    },
    check: (state) => state.stats.left.catches > 0,
  },
  {
    id: 'dash',
    title: 'DASH',
    text: 'Double-tap A or D to dash in that direction. Great for dodging.',
    check: (state, p1) => (p1.dashActive || 0) > 0,
  },
]

// Fired every tick to detect step completion. Passes a per-step scratchpad
// object stored on the tutorial state so counters like "moved for 20 frames"
// don't have to live on the engine.
export function checkStep(step, state, p1, ctx) {
  try { return !!step.check(state, p1, ctx) } catch { return false }
}

export function runStepSetup(step, state) {
  try { step.setup && step.setup(state) } catch {}
}
