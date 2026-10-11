import { createPlayer, stepPlayer, simulateRun, finishTimeMs } from "./game.js";
import { loadLevel } from "./level.js";
import {
  SUPPORTED_CHAINS,
  SELECTED_CHAIN_STORAGE_KEY,
  addressForChain,
  defaultChainId,
  getChainMeta,
  hasContractForChain,
  isSupportedChain
} from "./config.js";
import {
  getPublicClient,
  connectWallet,
  ensureChain,
  hasInjectedWallet,
  submitRun,
  fetchLeaderboard,
  fetchBestTime,
  fetchGhostInputs
} from "./chain.js";
import { mergeEntry, sortByTime } from "./leaderboard.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const submitBtn = document.getElementById("submitBtn");
const replayGhostBtn = document.getElementById("replayGhostBtn");
const statusEl = document.getElementById("status");
const bannerEl = document.getElementById("banner");
const walletEl = document.getElementById("wallet");
const leaderboardContent = document.getElementById("leaderboardContent");
const networkSelect = document.getElementById("networkSelect");
const networkNote = document.getElementById("networkNote");

// The app talks to exactly one network at a time (the selected one). Address and
// read client are always derived from that chain id, so one network never reads
// another network's contract.
let selectedChainId = readStoredChain();
let publicClient = getPublicClient(selectedChainId);
let address = addressForChain(selectedChainId);

let level = null;
let state = null;
let inputs = [];
let running = false;
let frame = 0;
let wallet = null; // { walletClient, account, chainId }
let ghost = null; // { player, inputs }
// Last known verified leaderboard, kept so we can update one player's row
// immediately after a submission without waiting on a full paged re-read.
let leaderboardEntries = [];

const inputState = { left: false, right: false, jump: false };

function readStoredChain() {
  const fallback = defaultChainId();
  try {
    const raw = localStorage.getItem(SELECTED_CHAIN_STORAGE_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return isSupportedChain(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function persistChain(id) {
  try {
    localStorage.setItem(SELECTED_CHAIN_STORAGE_KEY, String(id));
  } catch {
    /* ignore unavailable storage */
  }
}

function chainMeta() {
  return getChainMeta(selectedChainId);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#f66" : "#fff";
}

function setBanner(message, isError = false) {
  if (!message) {
    bannerEl.style.display = "none";
    return;
  }
  bannerEl.style.display = "block";
  bannerEl.style.background = isError ? "#3a1010" : "#102a10";
  bannerEl.style.color = isError ? "#ffb0b0" : "#b0ffb0";
  bannerEl.textContent = message;
}

function updateNetworkUi() {
  const meta = chainMeta();
  if (networkSelect) networkSelect.value = String(selectedChainId);
  if (networkNote) {
    networkNote.textContent = address
      ? `Configured on ${meta.name}: ${address}`
      : `Not configured on ${meta.name} — set ${meta.addressEnv}`;
  }
}

function resetRun() {
  level = null;
  state = null;
  inputs = [];
  frame = 0;
  running = false;
  ghost = null;
  startBtn.disabled = true;
  submitBtn.disabled = true;
  leaderboardEntries = [];
  leaderboardContent.textContent = "";
}

function getInputMask() {
  let mask = 0;
  if (inputState.left) mask |= 0x01;
  if (inputState.right) mask |= 0x02;
  if (inputState.jump) mask |= 0x04;
  return mask;
}

const GROUND_H = 50;

function draw() {
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!level) return;

  ctx.fillStyle = "#444";
  ctx.fillRect(0, canvas.height - GROUND_H, canvas.width, GROUND_H);

  ctx.fillStyle = "#0f0";
  ctx.fillRect(level.goalX - 5, canvas.height - GROUND_H - 30, 10, 30);

  for (const obs of level.obstacles) {
    ctx.fillStyle = obs.isHazard ? "#f00" : "#666";
    const h = obs.maxY - obs.minY;
    ctx.fillRect(obs.minX, canvas.height - GROUND_H - obs.maxY, obs.maxX - obs.minX, h);
  }

  if (state) {
    ctx.fillStyle = state.dead ? "#f00" : state.finished ? "#0ff" : "#fff";
    ctx.fillRect(state.x - 8, canvas.height - GROUND_H - (state.y + 16), 16, 16);
  }
}

function ghostColor() {
  return "rgba(255, 100, 100, 0.6)";
}

function update() {
  if (!running || !level) return;
  const mask = getInputMask();
  inputs.push(mask);
  state = stepPlayer(level, state, mask);
  frame++;

  if (state.finished) {
    const time = finishTimeMs(frame, level.tickMs);
    setStatus(`Finished! Contract-simulated time: ${time}ms. Submit to record it on-chain.`);
    running = false;
    submitBtn.disabled = false;
    startBtn.disabled = false;
    resetBtn.disabled = false;
  } else if (state.dead) {
    setStatus("Crashed! Press Reset and try again.", true);
    running = false;
    startBtn.disabled = false;
    resetBtn.disabled = false;
  }
  draw();
}

function gameLoop() {
  update();
  requestAnimationFrame(gameLoop);
}

async function ensureLevel() {
  const meta = chainMeta();
  if (!address) {
    setBanner(
      `Not deployed/configured on ${meta.name}. Set ${meta.addressEnv} in frontend/.env to the deployed SpeedrunGhosts address on ${meta.name} (chain ${meta.id}). Addresses are per network and are never shared.`,
      true
    );
    return false;
  }
  if (level) return true;
  try {
    setStatus("Loading level from contract...");
    level = await loadLevel(publicClient, address);
    canvas.width = level.width;
    canvas.height = level.height;
    state = createPlayer(level);
    setBanner(`Level loaded from contract ${address} on ${meta.name}.`);
    startBtn.disabled = false;
    draw();
    return true;
  } catch (error) {
    setBanner(`Failed to read level from contract: ${error.message}`, true);
    return false;
  }
}

async function applyChainSelection(id) {
  if (!isSupportedChain(id)) return;
  if (id !== selectedChainId) {
    selectedChainId = id;
    persistChain(id);
    publicClient = getPublicClient(selectedChainId);
    address = addressForChain(selectedChainId);
    resetRun();
  }
  updateNetworkUi();

  if (wallet && wallet.walletClient) {
    try {
      await ensureChain(wallet.walletClient, selectedChainId);
      wallet.chainId = selectedChainId;
      walletEl.textContent = `Connected: ${wallet.account}`;
    } catch (error) {
      setStatus(
        `Wallet did not switch to ${chainMeta().name}: ${error.shortMessage || error.message}`,
        true
      );
    }
  }

  await ensureLevel();
  await refreshLeaderboard();
}

connectBtn.addEventListener("click", async () => {
  if (!hasInjectedWallet()) {
    setStatus("No wallet found. Install MetaMask to submit runs.", true);
    return;
  }
  try {
    wallet = await connectWallet(selectedChainId);
    wallet.chainId = await wallet.walletClient.getChainId();
    walletEl.textContent = `Connected: ${wallet.account}`;
    setStatus("Wallet connected. Loading level...");
    await ensureLevel();
    await refreshLeaderboard();
  } catch (error) {
    setStatus(`Wallet connection failed: ${error.shortMessage || error.message}`, true);
  }
});

startBtn.addEventListener("click", async () => {
  if (!(await ensureLevel())) return;
  state = createPlayer(level);
  inputs = [];
  frame = 0;
  running = true;
  startBtn.disabled = true;
  resetBtn.disabled = true;
  submitBtn.disabled = true;
  setStatus("Running...");
  draw();
});

resetBtn.addEventListener("click", () => {
  if (!level) return;
  state = createPlayer(level);
  inputs = [];
  frame = 0;
  running = false;
  startBtn.disabled = false;
  submitBtn.disabled = true;
  setStatus("Reset. Click Start to play.");
  draw();
});

submitBtn.addEventListener("click", async () => {
  if (!(await ensureLevel())) return;
  if (!wallet) {
    setStatus("Connect your wallet to submit the run on-chain.", true);
    return;
  }

  // The wallet must be on the same chain as the contract we read and write.
  try {
    const current = await wallet.walletClient.getChainId();
    if (current !== selectedChainId) {
      await ensureChain(wallet.walletClient, selectedChainId);
      wallet.chainId = selectedChainId;
      walletEl.textContent = `Connected: ${wallet.account}`;
    }
  } catch {
    setStatus(
      `Switch your wallet to ${chainMeta().name} (chain ${selectedChainId}) to submit.`,
      true
    );
    return;
  }

  const local = simulateRun(level, inputs);
  if (!local.finished) {
    setStatus("Run did not finish; nothing to submit.", true);
    return;
  }

  submitBtn.disabled = true;
  setStatus("Submitting run to the contract...");
  try {
    const { hash, finishTime } = await submitRun(
      publicClient,
      wallet.walletClient,
      address,
      selectedChainId,
      wallet.account,
      inputs
    );
    setStatus(
      `Verified on-chain on ${chainMeta().name}: ${finishTime}ms. tx ${hash.slice(0, 10)}...`
    );
    ghost = { player: wallet.account, inputs: inputs.slice() };

    // Reflect the run immediately from ONE authoritative read of this player's
    // stored best, instead of blocking the UI on a full paged re-read of every
    // player. Then reconcile the whole board in the background.
    try {
      const best = await fetchBestTime(publicClient, address, wallet.account);
      leaderboardEntries = sortByTime(mergeEntry(leaderboardEntries, wallet.account, best));
      renderLeaderboard(leaderboardEntries, wallet.account);
    } catch {
      // Non-fatal: the background refresh below still reconciles the board.
    }
    void refreshLeaderboard();
  } catch (error) {
    if (error && error.code === 4001) {
      setStatus("Transaction rejected in wallet.", true);
    } else {
      setStatus(`Submission failed: ${error.shortMessage || error.message}`, true);
    }
    submitBtn.disabled = false;
  }
});

replayGhostBtn.addEventListener("click", async () => {
  if (!(await ensureLevel())) return;
  if (!ghost) {
    setStatus("No ghost yet. Submit a run or click a verified entry below.", true);
    return;
  }
  running = false;
  let gState = createPlayer(level);
  let gFrame = 0;
  setStatus(`Replaying ghost of ${ghost.player}...`);
  const interval = setInterval(() => {
    if (gFrame >= ghost.inputs.length || gState.finished || gState.dead) {
      clearInterval(interval);
      const time = gState.finished ? finishTimeMs(gFrame, level.tickMs) : 0;
      setStatus(gState.finished ? `Ghost finished in ${time}ms.` : "Ghost did not finish.");
      return;
    }
    gState = stepPlayer(level, gState, ghost.inputs[gFrame]);
    gFrame++;
    draw();
    ctx.fillStyle = ghostColor();
    ctx.fillRect(gState.x - 6, canvas.height - GROUND_H - (gState.y + 12), 12, 12);
  }, level.tickMs);
});

async function refreshLeaderboard() {
  if (!address) return;
  try {
    const entries = await fetchLeaderboard(publicClient, address);
    leaderboardEntries = entries;
    renderLeaderboard(entries);
  } catch (error) {
    leaderboardContent.textContent = `Could not load leaderboard: ${error.message}`;
  }
}

function renderLeaderboard(entries, highlightPlayer = null) {
  if (entries.length === 0) {
    leaderboardContent.innerHTML = "<div class='row'><span>No verified runs yet.</span></div>";
    return;
  }
  const highlightKey = highlightPlayer ? String(highlightPlayer).toLowerCase() : null;
  const sorted = sortByTime(entries);
  leaderboardContent.innerHTML = "";
  sorted.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className =
      highlightKey && String(entry.player).toLowerCase() === highlightKey
        ? "row row-highlight"
        : "row";
    row.style.cursor = "pointer";
    row.title = "Click to load this verified run as the ghost";
    row.innerHTML = `<span>#${index + 1} ${entry.player.slice(0, 8)}...</span><span>${entry.time}ms</span>`;
    row.addEventListener("click", async () => {
      try {
        const runInputs = await fetchGhostInputs(publicClient, address, entry.player);
        ghost = { player: entry.player, inputs: runInputs };
        setStatus(`Loaded verified ghost from ${entry.player.slice(0, 8)}... (${entry.time}ms). Press Replay Ghost.`);
      } catch (error) {
        setStatus(`Failed to load ghost: ${error.message}`, true);
      }
    });
    leaderboardContent.appendChild(row);
  });
}

document.addEventListener("keydown", (e) => {
  if (!running) return;
  if (e.key === "ArrowLeft" || e.key === "a") inputState.left = true;
  if (e.key === "ArrowRight" || e.key === "d") inputState.right = true;
  if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
    e.preventDefault();
    inputState.jump = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a") inputState.left = false;
  if (e.key === "ArrowRight" || e.key === "d") inputState.right = false;
  if (e.key === " " || e.key === "ArrowUp" || e.key === "w") inputState.jump = false;
});

// Populate the network picker with both supported chains.
if (networkSelect) {
  for (const c of SUPPORTED_CHAINS) {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = hasContractForChain(c.id) ? c.name : `${c.name} — not configured`;
    networkSelect.appendChild(opt);
  }
  networkSelect.value = String(selectedChainId);
  networkSelect.addEventListener("change", () => {
    void applyChainSelection(Number(networkSelect.value));
  });
}

updateNetworkUi();
setBanner(
  address
    ? `Contract ${address} on ${chainMeta().name}. Click Connect Wallet to load the level.`
    : `Not configured on ${chainMeta().name}. Set ${chainMeta().addressEnv} in frontend/.env to the deployed contract on ${chainMeta().name} (chain ${selectedChainId}). Addresses are per network and are never shared.`,
  !address
);
draw();
gameLoop();
