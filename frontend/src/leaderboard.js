// Pure leaderboard helpers (no DOM, no chain), so they can be unit-tested with
// `node --test` (see test/leaderboard.test.mjs).
//
// After a run is submitted we update the rendered board from ONE authoritative
// contract read (the caller's stored best) instead of waiting on a full paged
// re-read of every player. These helpers do that merge/sort deterministically.

/**
 * Insert or replace one player's entry, returning a new array.
 *
 * The stored `time` must be the contract's current best for that player (read
 * from `bestRuns`), so merging a submission that was not a personal best keeps
 * the existing, faster time. Matching is case-insensitive on the address.
 */
export function mergeEntry(entries, player, time) {
  const key = String(player).toLowerCase();
  const next = entries.filter((e) => String(e.player).toLowerCase() !== key);
  next.push({ player, time });
  return next;
}

/**
 * Sort a copy of the entries by ascending finish time (fastest first), breaking
 * ties by address so the order is stable. Time is the contract-verified ms value.
 */
export function sortByTime(entries) {
  return entries
    .slice()
    .sort(
      (a, b) =>
        a.time - b.time ||
        String(a.player).toLowerCase().localeCompare(String(b.player).toLowerCase())
    );
}
