# Speedrun Ghosts Plan

## Goal
Build MVP: deterministic 1-level browser game + onchain verification + leaderboard + replayable ghost.

## Contract requirements
- [x] Simulate submitted input sequence onchain (compute finish time)
- [x] Reject inputs longer than MAX_INPUT_LENGTH (1000; measured gas-feasible, see audit below)
- [x] Read level obstacles during simulation (solids block, hazards kill)
- [x] Reject/leave unrecorded runs that don't reach goal
- [x] Store submitted inputs (or emit) so ghost retrievable from chain (stored in bestRuns[player].inputs; also emitted)
- [x] Per-player best time; replace only if strictly faster
- [x] Leaderboard membership dedupe is O(1) (private `onLeaderboard` mapping; no O(n) scan)

## Client requirements
- [x] Integer arithmetic for position/velocity updates (explicit ints)
- [x] Single traceable source for level data (client reads level from the contract: `frontend/src/level.js` calls `LEVEL_WIDTH/HEIGHT/GROUND_Y/GOAL_X/PLAYER_START_X/Y/TICK_MS/MAX_INPUT_LENGTH/getObstacles` via viem; no level literals in the client)
- [x] Clearly identifiable deterministic step function matching contract
- [x] Show verified leaderboard times, replay verified run as ghost (viem reads `getLeaderboard()` and `getRunInputs(player)`; `submitRun()` writes the run and refreshes the board)
- [x] Wallet connect + wrong-network handling (MetaMask via viem; per-network chain add/switch; wrong-network submissions blocked)

## Deliverables
- [x] Contract (Solidity) + tests (15/15 Foundry, incl. tick 359 / 5744ms parity)
- [x] Frontend (Vite + viem, HTML/JS Canvas) with on-chain level/leaderboard/ghost
- [x] Frontend unit tests (node:test, 21/21 = 6 game/parity + 8 leaderboard + 7 dual-network config)
- [x] Deployment script
- [x] .env.example (root + frontend)
- [x] README.md
- [x] plan.md, PROGRESS.md
- [x] .gitignore

## Remaining (outside coding scope)
- [ ] Deploy to Sepolia and record the address in README.md + frontend/.env (address TBD; not deployed per instructions).
- [ ] Rubric check 1 (Base Sepolia 84532) remains a documented deviation - target is Ethereum Sepolia 11155111; Base Sepolia is configurable (dual-network) but not deployed/verified.

## Pre-deployment correctness review (2026-10-11)

- Contract simulation, tests, deploy script, and frontend parity re-inspected
  against `p3.md`. On-chain simulation, personal-best rule, input bound, obstacle
  reads, unfinished rejection, and storage/emission of inputs re-confirmed.
- **Fixed (Low, correctness):** live play + ghost replay displayed `frame *
  tickMs`, but the contract records `(steps - 1) * tickMs` (0-based input index).
  Added `finishTimeMs(steps, tickMs)` in `frontend/src/game.js`, used at both call
  sites in `frontend/src/main.js`, and added a regression test so the displayed
  time equals the on-chain value (360 steps → 5744ms).
- **Fixed (housekeeping):** `forge fmt` applied so the repo CI's
  `forge fmt --check` passes; `.env.example` placeholders emptied to match the
  other projects.
- **Reported, NOT changed (needs a decision):**
  - `submitRun` dedupes against the unbounded `leaderboardPlayers` array with an
    O(n) loop on every new personal best; the array/storage grow without limit. An
    O(1) fix needs an auxiliary `mapping` → storage-layout change → ask before
    applying.
  - `MAX_INPUT_LENGTH = 10000` is not gas-feasible (~9.6k gas/tick ⇒ ~96M gas at
    max length, above the block limit), so a legitimate very long run could be
    un-submittable. Lowering it is a game-rule change → ask.
- **RESOLVED 2026-10-11 (operator approval):** both items above were approved and
  applied — see the "Applied pre-deployment changes" section below.
- **RESOLVED 2026-10-11 (session 7):** the previously-known stale README items are
  fixed (README fully rewritten: `MAX_INPUT_LENGTH = 1000`, correct `src/...` /
  `scripts/...` paths, code fences balanced), and the residual unbounded-read
  limitation is addressed by adding paginated getters (see session 7 below).
- Known (unchanged): all four obstacles have `isHazard: false` so the hazard branch
  is unexercised (level-design note, not a contract bug); the deploy script lives in
  `scripts/` (plural) so `forge build`/`forge fmt` ignore it and `forge script`
  needs the explicit path; network stays Ethereum Sepolia 11155111 (check 1
  deviation).

## Applied pre-deployment changes (2026-10-11, operator-approved)

1. **O(1) leaderboard membership.** Added private `mapping(address => bool)
   onLeaderboard`; `submitRun` now appends a player to `leaderboardPlayers` only
   when the flag is unset (then sets it), removing the O(n) scan that previously
   ran on every new personal best. Public interface, events, and observable
   behavior are unchanged (array keeps insertion order, one entry per player).
   Regression test `test_noDuplicateLeaderboardEntryOnImprovement` proves an
   improved best from the same address does not create a duplicate entry.
2. **Gas-feasible `MAX_INPUT_LENGTH`.** Lowered from 10000 to **1000**.
   Measured with Foundry (test `test_maxLengthSubmissionGasBelowCap`) using a
   valid run of exactly MAX_INPUT_LENGTH bytes that finishes on its final step:
   **5,060,109 gas** for `submitRun` (whole test 5,239,503). Well below the
   required 12,000,000 cap and the Sepolia per-tx cap of 16,777,216, so 1000 is
   kept (no further lowering needed). New tests: max-length accepted + finish time
   (specifically `(len-1)*TICK_MS`), over-limit revert at `MAX + 1`, gas at max.
   The frontend keeps reading the limit from the contract
   (`frontend/src/level.js` reads `MAX_INPUT_LENGTH` at runtime); only the
   test-only fixture mirror was updated to 1000.

### Remaining leaderboard read limitation (RESOLVED 2026-10-11, session 7)
- `getLeaderboard()` still iterates the entire `leaderboardPlayers` array on every
  call (O(n) read, no pagination), and the array/bestRuns storage grows by one
  player per unique address. Writing is O(1); the residual cost is an eth_call
  gas/response-size ceiling for very large player counts, not an on-chain DoS.
  **Session 7 addressed the client ceiling** by adding `getLeaderboardPage(offset,
  limit)` + `leaderboardSize()` (below); `getLeaderboard()` is retained unchanged
  for compatibility. The frontend now reads paged.
- Accepted max submission cost 5.06M gas is also a floor for any caller wanting to
  submit a maximum-length run; typical runs finish far earlier (fastest path: 360
  steps, 5744ms) and cost a small fraction of that.

### Verification (2026-10-11, live re-run)
- `forge test` → **10 passed; 0 failed; 0 skipped** (exit 0), solc 0.8.36 (7
  baseline + 3 new: max-length accept, gas cap, no-duplicate; overlong revert
  rewritten to `MAX+1`).
- `forge build` → exit 0; `forge fmt --check` → exit 0.
- `node --test` (frontend) → **6 passed; 0 failed**; `npm run build` (vite) → exit
  0. ABI unchanged (private mapping adds no getter; `MAX_INPUT_LENGTH` getter
  still present and returns 1000 at runtime; `level.js` reads it).

## Session 7 — paginated leaderboard read, solc pin, README rewrite (2026-10-11)

### Contract
- Added `getLeaderboardPage(uint256 offset, uint256 limit)` and
  `leaderboardSize()` to `src/SpeedrunGhosts.sol`. Both are pure reads over the
  existing `leaderboardPlayers` array; `getLeaderboard()` is unchanged, so the
  public surface is additive and no storage layout changed.
- `foundry.toml` pinned to `solc_version = "0.8.24"` (+ optimizer 200,
  `evm_version = "cancun"`, `script = "scripts"`, `[fmt]`, `[rpc_endpoints]`) so all
  three projects build on the same compiler.

### Tests (`test/SpeedrunGhosts.t.sol`) — now 15
- Added `test_equalFinishTimeDoesNotReplaceBest`, `test_getObstaclesMatchesDocumentedLevel`,
  `test_leaderboardPagingReconstructsFullBoard`, `test_leaderboardPageBoundaries`,
  `test_fullLeaderboardReadGasMeasured`.

### Frontend
- `frontend/src/abi.js` gained the two new functions; `frontend/src/chain.js`
  `fetchLeaderboard` now pages (`PAGE_SIZE = 200`, `MAX_PAGES = 50` ⇒ ≤10,000
  entries) instead of one `getLeaderboard()` call.

### README
- Fully rewritten: `MAX_INPUT_LENGTH = 1000`, corrected `src/...` / `scripts/...`
  paths, balanced code fences, Remix+MetaMask (2a) and Foundry (2b) deploy
  sections, 15-test table, measured read costs, security notes, chain-deviation
  note. The previously-known stale README items are now resolved.

### Hygiene
- `.gitignore` hardened to match tbyt/pt (`.env.*` + `!.env.example`, `*.key`,
  `*.pem`, `keystore/`, `frontend/.env`, `frontend/dist`). The repo's own CI
  (`sg/.github/workflows/test.yml`) runs `forge fmt --check` → `forge build
  --sizes` → `forge test -vvv`; all pass locally under solc 0.8.24.

### Measured results (this session)
- `getLeaderboard()` @30 players = **168,526 gas** (~5.6k/player).
- `getLeaderboardPage(0,10)` = **61,692 gas**.
- max-length `submitRun` = **4,397,841 gas** (with optimizer; down from 5,060,109
  unoptimized).
- Practical full-read limit ≈ RPC `eth_call` gas cap (default 50,000,000) ≈ a few
  thousand players; pagination removes the client ceiling.

### Verification (2026-10-11, session 7, live re-run)
- `forge test` → **15 passed; 0 failed; 0 skipped** (exit 0), solc 0.8.24.
- `forge build` → exit 0; `forge fmt --check` → exit 0 (fmt applied project-wide).
- `node --test` (frontend) → **6 passed; 0 failed**; `npm run build` (vite) → exit 0.
- Credential scan → clean (no secrets tracked; only `.env.example` placeholders).

### Still not done
- No deployment (no address supplied); Ethereum Sepolia target unchanged; nothing
  pushed to GitHub; rubric check 1 (Base Sepolia 84532) remains the documented
  deviation.

## Session 8 — dual-network client (2026-10-11)

Work in `N:\dev7\sg` only. No deployment, no wallet keys, no GitHub push.

- The client now talks to **either Ethereum Sepolia (`11155111`, our target)**
  **or Base Sepolia (`84532`, configurable, not deployed/verified)**, each with
  its own contract address and RPC that are never shared. The contract source is
  unchanged (it never reads `block.chainid`), so identical bytecode can be
  deployed to either chain.
- **New `frontend/src/networks.js`** — pure, dependency-free registry: both chain
  ids, per-chain `rpcEnv`/`addressEnv`, `DEFAULT_CHAIN_ID = 11155111`, resolvers
  `resolveAddress`/`hasAddress`/`resolveRpcUrl` (no cross-chain fallback), and the
  guards `walletMatchesSelected`/`canTransact`.
- **Rewritten `frontend/src/config.js`** — per-chain resolvers driven by
  `networks.js` + `SELECTED_CHAIN_STORAGE_KEY` and `defaultChainId`.
- **`frontend/src/chain.js`** — `viemChainFor`, `getPublicClient(chainId)`,
  `connectWallet(chainId)`, `ensureChain`, and `submitRun(..., chainId, ...)` so
  every read/write targets the selected chain.
- **`frontend/src/main.js` + `index.html`** — a **Network** `<select>`, persisted
  selection, a wrong-network guard that blocks submission, and per-chain
  level/leaderboard reads. A selected chain with no configured address shows a
  **"Not configured on <network>"** state and disables actions.
- **Env vars (renamed per chain):** `VITE_SEPOLIA_CONTRACT_ADDRESS` /
  `VITE_BASE_SEPOLIA_CONTRACT_ADDRESS`, `VITE_SEPOLIA_RPC_URL` /
  `VITE_BASE_SEPOLIA_RPC_URL`; optional `VITE_CHAIN_ID` chooses the default
  network. Root `.env.example` adds an optional `BASE_SEPOLIA_RPC_URL`.
- **Tests:** new `frontend/test/networks.test.mjs` (7 tests) → frontend suite now
  **13/13** (6 game/parity + 7 networks). All 15 Foundry tests unchanged.

### Verification (session 8)
- `forge test` → 15/15 pass (exit 0); `forge fmt --check` → exit 0.
- `node --test` (frontend) → 13/13 pass; `npm run build` (vite) → exit 0.
- Base Sepolia is configured/compatible only — not deployed, not verified.

## Session 9 — fast leaderboard update after submit (2026-10-11)

Final hardening pass. Work in `N:\dev7\sg` only. No deployment, no wallet keys,
no GitHub push; target remains Ethereum Sepolia 11155111.

### Manual-test finding addressed
- **Finding:** "leaderboard refresh slow after submission." After **Submit Run**,
  the client blocked the UI on a full paged re-read of every player
  (`fetchLeaderboard` walks all pages) before showing the new row.

### Change
- **New `frontend/src/leaderboard.js`** — pure `mergeEntry(entries, player, time)`
  and `sortByTime(entries)` helpers (no DOM, no chain).
- **`frontend/src/chain.js`** — added `fetchBestTime(publicClient, address, player)`,
  a single O(1) `bestRuns(player)` read returning the contract's stored best.
- **`frontend/src/main.js`** — a module-level `leaderboardEntries` cache. After a
  successful `submitRun`, the client does **one** targeted `fetchBestTime` read,
  merges that player's row, sorts, and re-renders with the entry **highlighted**,
  then reconciles the whole board in the background (`void refreshLeaderboard()`),
  so the UI is never blocked. `renderLeaderboard` gained an optional
  `highlightPlayer` argument and uses `sortByTime`. `resetRun` clears the cache on
  network change.
- **`frontend/index.html`** — `.row-highlight` style for the freshly-submitted row.

### Tests
- New `frontend/test/leaderboard.test.mjs` (8 `node:test` tests): insert, replace
  (case-insensitive), contract-best-is-authoritative, no input mutation for both
  helpers, fastest-first ordering, deterministic address tie-break, and a
  merge+sort personal-best scenario. Frontend suite: **13 → 21**.

### Verification (session 9, live re-run)
- `forge test` → 15/15 pass (exit 0); `forge fmt --check` → exit 0.
- `node --test` (frontend) → **21/21 pass**; `npm run build` (vite) → exit 0.
- Not manually verified in a browser against a live contract (no deployment).

### Still not done
- No deployment (no address supplied); nothing pushed; no in-browser run against a
  live contract. The new row appears immediately from stored state, but the
  perceived speed on a real public RPC still needs a manual retest after deploy.
