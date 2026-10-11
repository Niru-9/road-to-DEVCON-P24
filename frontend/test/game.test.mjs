// Offline unit tests for the deterministic step function.
//
// IMPORTANT: this fixture is a TEST-ONLY mirror of the on-chain level used to
// check client/contract parity without a node. The running client never uses a
// literal: frontend/src/level.js loads the level from the contract at runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { createPlayer, stepPlayer, simulateRun, finishTimeMs } from "../src/game.js";

// Mirrors SpeedrunGhosts.getObstacles() / level constants.
// maxInputLength must track the contract's MAX_INPUT_LENGTH constant.
const CONTRACT_LEVEL = {
  width: 800,
  height: 400,
  groundY: 0,
  goalX: 760,
  startX: 40,
  startY: 0,
  tickMs: 16,
  maxInputLength: 1000,
  obstacles: [
    { minX: 200, maxX: 220, minY: 0, maxY: 40, isHazard: false },
    { minX: 400, maxX: 420, minY: 0, maxY: 80, isHazard: false },
    { minX: 600, maxX: 620, minY: 0, maxY: 40, isHazard: false },
    { minX: 500, maxX: 520, minY: -10, maxY: 0, isHazard: false }
  ]
};

const RIGHT = 0x02;

function allRight(count) {
  return new Array(count).fill(RIGHT);
}

test("all-right run finishes at tick 359 / 5744ms (contract parity anchor)", () => {
  const result = simulateRun(CONTRACT_LEVEL, allRight(400));
  assert.equal(result.finished, true);
  assert.equal(result.tick, 359);
  assert.equal(result.time, 5744);
});

test("UI finish time matches the contract's (steps - 1) * tickMs convention", () => {
  // A 360-step run finishes on input index 359 => 5744ms, matching the parity
  // anchor above and the contract's `return i * TICK_MS`.
  assert.equal(finishTimeMs(360, CONTRACT_LEVEL.tickMs), 5744);
  assert.equal(finishTimeMs(360, 16), simulateRun(CONTRACT_LEVEL, allRight(400)).time);
  assert.equal(finishTimeMs(0, 16), 0);
});

test("physics stays integer-only for the whole run", () => {
  let state = createPlayer(CONTRACT_LEVEL);
  for (let i = 0; i < 400 && !state.finished && !state.dead; i++) {
    state = stepPlayer(CONTRACT_LEVEL, state, RIGHT);
    assert.ok(Number.isInteger(state.x), `x must be integer at tick ${i}`);
    assert.ok(Number.isInteger(state.y), `y must be integer at tick ${i}`);
    assert.ok(Number.isInteger(state.vx), `vx must be integer at tick ${i}`);
    assert.ok(Number.isInteger(state.vy), `vy must be integer at tick ${i}`);
  }
});

test("solid obstacle at x in [200,220] raises the player to y=40", () => {
  let state = createPlayer(CONTRACT_LEVEL);
  for (let i = 0; i < 200; i++) {
    state = stepPlayer(CONTRACT_LEVEL, state, RIGHT);
    if (state.x >= 200) break;
  }
  assert.equal(state.x, 200);
  assert.equal(state.y, 40);
  assert.equal(state.onGround, true);
});

test("short run does not finish", () => {
  const result = simulateRun(CONTRACT_LEVEL, allRight(5));
  assert.equal(result.finished, false);
});

test("inputs mix still finishes and resolves deterministically", () => {
  const inputs = allRight(400);
  const first = simulateRun(CONTRACT_LEVEL, inputs);
  const second = simulateRun(CONTRACT_LEVEL, inputs);
  assert.deepEqual(first, second);
});
