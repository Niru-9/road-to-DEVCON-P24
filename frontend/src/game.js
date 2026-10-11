// Deterministic game logic. Must match the contract's step() exactly.
//
// Level data is passed in (never hard-coded here) so the contract remains the
// single source of truth. All physics use integer arithmetic only:
// integer velocity constants and x += vx / y += vy. There are no fractional
// constants and no frame-time delta from the browser clock.

/**
 * @typedef {Object} Level
 * @property {number} groundY
 * @property {number} goalX
 * @property {number} width
 * @property {number} height
 * @property {number} startX
 * @property {number} startY
 * @property {number} tickMs
 * @property {Array<{minX:number,maxX:number,minY:number,maxY:number,isHazard:boolean}>} obstacles
 */

export function createPlayer(level) {
  return {
    x: level.startX,
    y: level.startY,
    vx: 0,
    vy: 0,
    onGround: true,
    finished: false,
    dead: false
  };
}

export function stepPlayer(level, state, input) {
  // input bitmask: bit0 left, bit1 right, bit2 jump.
  const next = {
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    onGround: state.onGround,
    finished: state.finished,
    dead: state.dead
  };

  const left = (input & 0x01) !== 0;
  const right = (input & 0x02) !== 0;
  const jump = (input & 0x04) !== 0;

  if (left && !right) {
    next.vx = -2;
  } else if (right && !left) {
    next.vx = 2;
  } else {
    next.vx = 0;
  }

  if (jump && next.onGround) {
    next.vy = 4;
    next.onGround = false;
  }

  next.vy = next.vy - 1;
  next.x = next.x + next.vx;
  next.y = next.y + next.vy;

  resolveCollisions(level, next);

  if (isTouchingHazard(level, next)) {
    next.dead = true;
    next.finished = false;
    return next;
  }

  if (next.x >= level.goalX) {
    next.finished = true;
    return next;
  }

  if (next.x < 0 || next.x > level.width || next.y < -200 || next.y > level.height) {
    next.dead = true;
  }

  return next;
}

function resolveCollisions(level, state) {
  if (state.y <= level.groundY) {
    state.y = level.groundY;
    state.vy = 0;
    state.onGround = true;
  }
  for (let i = 0; i < level.obstacles.length; i++) {
    const obs = level.obstacles[i];
    if (obs.isHazard) continue;
    if (
      state.x >= obs.minX &&
      state.x <= obs.maxX &&
      state.y >= obs.minY &&
      state.y <= obs.maxY
    ) {
      state.y = obs.maxY;
      state.vy = 0;
      state.onGround = true;
    }
  }
}

function isTouchingHazard(level, state) {
  for (let i = 0; i < level.obstacles.length; i++) {
    const obs = level.obstacles[i];
    if (!obs.isHazard) continue;
    if (
      state.x >= obs.minX &&
      state.x <= obs.maxX &&
      state.y >= obs.minY &&
      state.y <= obs.maxY
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Simulate a full run locally (mirrors the contract's _computeFinishTime).
 * @param {Level} level
 * @param {ArrayLike<number>} inputs byte inputs (0-255)
 * @returns {{finished:boolean, time:number, tick:number, finalState:object}}
 */
export function simulateRun(level, inputs) {
  let state = createPlayer(level);
  for (let i = 0; i < inputs.length; i++) {
    if (state.finished || state.dead) break;
    state = stepPlayer(level, state, inputs[i]);
    if (state.finished) {
      return { finished: true, time: i * level.tickMs, tick: i, finalState: state };
    }
  }
  return { finished: state.finished, time: 0, tick: -1, finalState: state };
}

/**
 * Contract finish-time convention: the finishing input is index (steps - 1),
 * so `_computeFinishTime` returns `(steps - 1) * TICK_MS`, not `steps * TICK_MS`.
 * The live and ghost UIs must use this same value so the displayed time equals
 * what the contract records.
 * @param {number} steps number of simulation steps executed (>= 1)
 * @param {number} tickMs milliseconds per tick
 * @returns {number}
 */
export function finishTimeMs(steps, tickMs) {
  if (steps <= 0) return 0;
  return (steps - 1) * tickMs;
}
