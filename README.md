# Speedrun Ghosts

A minimal deterministic speedrun game where **the chain is the referee**: the
contract replays your recorded button presses through the level itself and
decides your finish time. The leaderboard shows only chain-verified times, and a
ghost is replayed from a run the chain has already verified — so an edited client
can put nothing on the board.

- Level data, simulation and timing all live in the contract (single source of truth).
- The browser reads the level, the leaderboard and ghost inputs straight from chain.
- A player who finishes nothing, dies, or submits an over-long input gets no entry.

> **Networks:** The contract is plain EVM Solidity and the client is
> **dual-network**: it can talk to **Ethereum Sepolia (`11155111`)** and **Base
> Sepolia (`84532`)**, each with its own contract address and RPC that are never
> shared. **Ethereum Sepolia is our deployment and manual-verification target.**
> (The original rubric names Base Sepolia; using Ethereum Sepolia is a documented
> deviation — rubric check 1 — not a code defect.) Base Sepolia is
> supported/configurable for a separate deployment by someone who has Base
> Sepolia test ETH — **we have not deployed to or verified it.**

---

## Contract

`src/SpeedrunGhosts.sol` — contract name **`SpeedrunGhosts`**, pragma
`solidity ^0.8.20`, compiler pinned to **0.8.24** in `foundry.toml`.

- Simulates the submitted input sequence step-by-step (deterministic, integer physics).
- Enforces `MAX_INPUT_LENGTH` (**1000**) and rejects empty input on-chain.
- Reads the level's obstacles during simulation (solids block, hazards kill).
- Rejects unfinished runs (`"Did not finish"`) — nothing is recorded.
- Stores inputs + best time per player; replaces the best **only if strictly faster**.
- O(1) leaderboard membership via a private `onLeaderboard` mapping (no duplicate rows).
- Bounded leaderboard reads: `getLeaderboardPage(offset, limit)` (+ `leaderboardSize()`
  and the legacy `getLeaderboard()` for compatibility).
- Events: `RunVerified` (carries the inputs), `NewBest`.
- Never reads `block.chainid`, so the identical bytecode behaves the same on
  Ethereum Sepolia and Base Sepolia.

## Deployed Address

TBD — deployment is not performed in this coding phase. After you deploy (below),
put the address here:

```
SpeedrunGhosts (Ethereum Sepolia): <not deployed yet>
SpeedrunGhosts (Base Sepolia):     <not deployed — optional, not verified by us>
```

---

## Repository layout

```
.
├── src/SpeedrunGhosts.sol         The contract (Solidity 0.8.24)
├── test/SpeedrunGhosts.t.sol      Foundry tests (15)
├── scripts/Deploy.s.sol           Foundry deploy script (network-agnostic; Sepolia default)
├── foundry.toml                   Foundry config (solc 0.8.24, script dir = scripts)
├── .env.example                   Root env placeholders (RPC + key)
├── frontend/
│   ├── index.html                 Canvas + controls + network picker
│   ├── src/networks.js            Pure dual-network registry (per-chain address/RPC)
│   ├── src/config.js              Env-driven per-chain config + default selection
│   ├── src/level.js               Reads the level FROM the contract (no literals)
│   ├── src/game.js                Deterministic integer step function (matches contract)
│   ├── src/chain.js               viem reads/writes for the selected chain
│   ├── src/abi.js                 Contract ABI
│   ├── src/main.js                Play / submit / leaderboard / ghost-replay UI
│   ├── src/leaderboard.js         Pure merge/sort helpers for the board
│   ├── test/game.test.mjs         node:test parity + physics tests (6)
│   ├── test/leaderboard.test.mjs  node:test leaderboard merge/sort tests (8)
│   ├── test/networks.test.mjs     node:test dual-network config tests (7)
│   └── .env.example               Frontend env placeholders
├── plan.md                        MVP plan
└── PROGRESS.md                    Build/session log
```

---

## Prerequisites

- **Node.js 20.12+** (22 LTS recommended) — `node -v`
- **Foundry** (for the contract) — https://book.getfoundry.sh/getting-started/installation
- **MetaMask** browser extension (desktop) — https://metamask.io/download/
- Sepolia test ETH (free, see below)

---

## 1. Contract: build & test

```bash
# from the project root (N:\dev7\sg)
forge build
forge test -vv        # runs the full suite (see "Test coverage" below)
forge fmt --check     # formatting (also enforced by CI)
```

`forge install` already vendored `forge-std` into `lib/`. If you cloned without
submodules, run `forge install foundry-rs/forge-std`.

---

## 2. Contract: deploy

The same `SpeedrunGhosts` source deploys unchanged to any EVM network. **Our
target is Ethereum Sepolia**; Base Sepolia is optional (see §4).

You can deploy either through **Remix + MetaMask** (no key handling in this repo,
matches the MetaMask-based manual test requirement) or the Foundry script.

### 2a. Remix + injected MetaMask (recommended)

> This manual procedure has **not** been executed in this coding phase — treat it
> as the documented plan, not a tested result.

1. Install MetaMask and switch it to **Sepolia**. Enable *Settings → Advanced →
   Show test networks*, then pick **Sepolia** (chain ID `11155111`). Get free
   Sepolia ETH from a faucet (e.g. https://www.alchemy.com/faucets/ethereum-sepolia).
2. Open https://remix.ethereum.org and create a new file, then paste the contents
   of `src/SpeedrunGhosts.sol` (source path `src/SpeedrunGhosts.sol`, contract
   name `SpeedrunGhosts`).
3. In the **Solidity Compiler** tab select compiler **0.8.24** (any `>= 0.8.20`
   satisfies the pragma) and click **Compile**.
4. In the **Deploy & Run Transactions** tab set **Environment** to
   **Injected Provider - MetaMask**, confirm the network shown is Sepolia
   (`11155111`), then click **Deploy**. `SpeedrunGhosts` takes **no constructor
   arguments**.
5. Copy the deployed address. Record the **deploy block** too (Remix shows the tx;
   the block number is on the Sepolia explorer) for your own reference.
6. Paste the address into `frontend/.env` as `VITE_SEPOLIA_CONTRACT_ADDRESS=0x…`
   (see §3). Record it here and in `plan.md` as well.

### 2b. Foundry script

```bash
cp .env.example .env         # then edit .env with your own values
# .env:
#   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<your-key>   (or any Sepolia RPC)
#   PRIVATE_KEY=0x<throwaway-test-key>

forge script scripts/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast --private-key "$PRIVATE_KEY"
```

The script prints `SpeedrunGhosts deployed at: 0x…`. Copy that address into
`frontend/.env` as `VITE_SEPOLIA_CONTRACT_ADDRESS`.

> `.env` is git-ignored. Only `.env.example` (placeholders) is tracked. Never
> commit a private key, mnemonic, API key, or a key-bearing RPC URL.

---

## 3. Frontend: install & run

```bash
cd frontend
npm install
cp .env.example .env
# .env:
#   VITE_SEPOLIA_CONTRACT_ADDRESS=0x<your deployed contract on Ethereum Sepolia>
#   VITE_SEPOLIA_RPC_URL=                                  (optional; public default if empty)
#   VITE_BASE_SEPOLIA_CONTRACT_ADDRESS=                    (optional; only if separately deployed)
#   VITE_BASE_SEPOLIA_RPC_URL=                             (optional; public default if empty)
#   VITE_CHAIN_ID=                                         (optional; default selected network)

npm run dev        # http://localhost:5173
npm test           # node:test (game/parity + dual-network config)
npm run build      # production build
```

The client reads everything it needs from the contract at the selected address.
There is no deploy-block variable — the client reads current contract state and
the leaderboard directly (paged), so only the address per network is needed.

---

## 4. Network configuration (dual-network)

Both networks are configured, each with its **own** contract address and RPC.
Addresses are per network and are **never** shared or guessed.

| Network | Chain ID | Contract address env | RPC env |
|---|---|---|---|
| **Ethereum Sepolia** (our target) | `11155111` | `VITE_SEPOLIA_CONTRACT_ADDRESS` | `VITE_SEPOLIA_RPC_URL` |
| Base Sepolia (optional) | `84532` | `VITE_BASE_SEPOLIA_CONTRACT_ADDRESS` | `VITE_BASE_SEPOLIA_RPC_URL` |

- The in-app **Network** picker switches which chain the client reads from, and
  the choice is remembered across reloads. Ethereum Sepolia is the default
  (override the initial selection with `VITE_CHAIN_ID`).
- Reads (level, leaderboard, ghost inputs) always target the **selected** chain.
  A submission is only allowed when the connected wallet is on that same chain —
  otherwise the client prompts to switch and blocks the write.
- If the selected chain has no configured address, the client shows a clear
  **"Not configured on <network>"** state and disables every action. It never
  falls back to the other network's address.

### Deploying the client against Base Sepolia (optional)

Only if you have Base Sepolia test ETH: deploy the same `SpeedrunGhosts` there
(Remix with MetaMask set to Base Sepolia `84532`, or
`forge script scripts/Deploy.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --private-key "$PRIVATE_KEY"`),
then fill `VITE_BASE_SEPOLIA_CONTRACT_ADDRESS`. **Never reuse the Ethereum Sepolia address
on Base Sepolia** (or vice-versa). This path is documented only — we have not
deployed to or verified Base Sepolia.

---

## How to play

1. Open the app, choose a network in the **Network** picker (Ethereum Sepolia by
   default), click **Connect Wallet**, and approve MetaMask on that network.
2. Click **Start** and play with `←`/`A` (left), `→`/`D` (right), `Space`/`↑`/`W`
   (jump). The status line shows the contract-simulated time when you reach the goal.
3. Click **Submit Run** to send your recorded inputs on-chain; the contract replays
   them and stores your verified time if it is a new personal best.
4. The **leaderboard** shows verified times read from the contract. Click any entry
   to load that verified run as a ghost, then **Replay Ghost** to race it.
5. An edited client cannot fake a time: the contract only records what its own
   simulation of the submitted inputs produces.

### Fast leaderboard update after submitting

Right after **Submit Run** succeeds, the client reads **one** value — your own
contract-stored best (`bestRuns(msg.sender)`) — and merges that single row into
the rendered board (highlighted) instead of blocking on a full paged re-read of
every player. It then reconciles the whole board in the background. So your new
entry appears immediately, and the full refresh no longer makes the UI feel
stuck. The pure merge/sort helpers live in `frontend/src/leaderboard.js` and are
unit-tested by `frontend/test/leaderboard.test.mjs`.

---

## Contract design (how the rules are enforced)

- **On-chain simulation.** `_computeFinishTime` steps the inputs through `step()`
  using `getObstacles()` and returns `i * TICK_MS` at the step that reaches the
  goal, or reverts `"Did not finish"`.
- **Bounded work.** `submitRun` requires `inputs.length <= MAX_INPUT_LENGTH (1000)`
  and `> 0`, so a submission's cost is bounded.
- **Personal best.** Stored per `msg.sender`; replaced only when the new time is
  strictly lower.
- **Membership.** A private `onLeaderboard` mapping keeps the `leaderboardPlayers`
  array duplicate-free in O(1).
- **Reads.** `getLeaderboardPage(offset, limit)` bounds a read to `limit` entries;
  `getLeaderboard()` returns the whole board for compatibility.
- **Replay.** `getRunInputs(player)` (and the `RunVerified` event) expose a
  verified run's inputs so the ghost is real chain data.

---

## Test coverage (Foundry — `forge test`)

| Scored check | Test(s) |
|---|---|
| 3 — Time computed by the contract's own simulation | `test_allRightFinishesAtTick359Parity`, `test_basicRunCompletes` |
| 4 — Submitted input log has a maximum length | `test_revertOnOverlongInput`, `test_maxLengthInputAcceptedAndFinishTime` (gas: `test_maxLengthSubmissionGasBelowCap`) |
| 5 — Simulation reads the level's obstacles | `test_getObstaclesMatchesDocumentedLevel` (+ simulation tests) |
| 6 — A run that never reaches the goal is not recorded | `test_doesNotRecordUnfinished` |
| 9 — A verified run's inputs are retrievable from chain | `test_inputsRetrievable` |
| 10 — Personal best replaced only by a faster run | `test_personalBestOnlyFaster`, `test_personalBestReplacedByFaster`, `test_equalFinishTimeDoesNotReplaceBest`, `test_noDuplicateLeaderboardEntryOnImprovement` |
| leaderboard reads / pagination | `test_leaderboardPagingReconstructsFullBoard`, `test_leaderboardPageBoundaries`, `test_fullLeaderboardReadGasMeasured` |

Result: **15 contract tests passing** (`forge test`). The frontend logic has a
separate `node:test` suite (**21 tests**) covering integer-only physics,
determinism and the contract time-parity anchor (all-right 400 inputs → tick 359 /
5744 ms), the **8-test** leaderboard merge/sort suite
(`leaderboard.test.mjs`), plus the **7-test** dual-network suite
(`networks.test.mjs`) for chain config, per-chain address selection,
missing-address behaviour and wrong-network guards.

### Measured read costs (`test_fullLeaderboardReadGasMeasured`)

At 30 players: `getLeaderboard()` ≈ **168,526 gas** (~5.6k gas/player);
`getLeaderboardPage(0, 10)` ≈ **61,692 gas**. A full read is therefore bounded by
the RPC `eth_call` gas cap (default 50,000,000 on most public Sepolia endpoints)
rather than an on-chain limit — roughly a few thousand players per unbounded call.
Clients avoid that ceiling by paging (see `frontend/src/chain.js`).

---

## Security & credentials

- No private keys, mnemonics, API keys or key-bearing RPC URLs are committed.
  Only `.env.example` placeholders are tracked; real values live in git-ignored
  `.env` files.
- The contract has no owner/admin and no upgrade path. The only write path is the
  permissionless, length-bounded `submitRun`.
