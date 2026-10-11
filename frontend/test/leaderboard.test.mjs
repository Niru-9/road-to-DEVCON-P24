// Offline unit tests for the pure leaderboard merge/sort helpers used to update
// the board immediately after a submission (src/leaderboard.js).
import test from "node:test";
import assert from "node:assert/strict";
import { mergeEntry, sortByTime } from "../src/leaderboard.js";

const A = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

test("mergeEntry inserts a new player", () => {
  const next = mergeEntry([{ player: A, time: 100 }], B, 50);
  assert.deepEqual(next, [
    { player: A, time: 100 },
    { player: B, time: 50 }
  ]);
});

test("mergeEntry replaces an existing player's time (case-insensitive)", () => {
  const next = mergeEntry([{ player: A, time: 100 }], A.toLowerCase(), 30);
  assert.equal(next.length, 1);
  assert.equal(next[0].time, 30);
});

test("mergeEntry records the contract's best, even if slower than the local guess", () => {
  // The caller passes the contract's authoritative best; the helper must not
  // invent a faster time of its own.
  const next = mergeEntry([{ player: A, time: 100 }], A, 250);
  assert.equal(next.length, 1);
  assert.equal(next[0].time, 250);
});

test("mergeEntry does not mutate the input array", () => {
  const original = [{ player: A, time: 100 }];
  const next = mergeEntry(original, B, 10);
  assert.equal(original.length, 1);
  assert.notEqual(next, original);
});

test("sortByTime orders fastest first", () => {
  const sorted = sortByTime([
    { player: A, time: 300 },
    { player: B, time: 100 },
    { player: C, time: 200 }
  ]);
  assert.deepEqual(
    sorted.map((e) => e.player),
    [B, C, A]
  );
});

test("sortByTime is a stable, deterministic tie-break by address", () => {
  const sorted = sortByTime([
    { player: C, time: 100 },
    { player: A, time: 100 },
    { player: B, time: 100 }
  ]);
  assert.deepEqual(
    sorted.map((e) => e.player),
    [A, B, C]
  );
});

test("sortByTime does not mutate the input array", () => {
  const original = [
    { player: A, time: 300 },
    { player: B, time: 100 }
  ];
  const sorted = sortByTime(original);
  assert.equal(original[0].player, A);
  assert.equal(sorted[0].player, B);
});

test("merge + sort reflects a new personal best immediately", () => {
  const entries = [
    { player: A, time: 200 },
    { player: B, time: 150 }
  ];
  const merged = mergeEntry(entries, A, 90);
  const sorted = sortByTime(merged);
  assert.deepEqual(
    sorted.map((e) => e.time),
    [90, 150]
  );
});
