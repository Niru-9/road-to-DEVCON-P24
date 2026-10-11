// All chain interaction lives here (viem). Reads and writes are bound to the
// app's selected chain; a chain is never used with another chain's address.
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  bytesToHex,
  hexToBytes,
  parseEventLogs
} from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { GAME_ABI } from "./abi.js";
import { rpcForChain } from "./config.js";

const VIEM_CHAINS = {
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia
};

/** The viem chain object for a supported chain id, or undefined. */
export function viemChainFor(chainId) {
  return VIEM_CHAINS[chainId];
}

/** A read client for one chain, or undefined for an unsupported chain. */
export function getPublicClient(chainId) {
  const chain = viemChainFor(chainId);
  if (!chain) return undefined;
  return createPublicClient({ chain, transport: http(rpcForChain(chainId)) });
}

export function hasInjectedWallet() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/** Connect an injected wallet and return a wallet client bound to `chainId`. */
export async function connectWallet(chainId) {
  if (!hasInjectedWallet()) {
    throw new Error("No Ethereum wallet detected. Install MetaMask to submit runs.");
  }
  const chain = viemChainFor(chainId);
  if (!chain) {
    throw new Error(`Unsupported network (chain ${chainId}).`);
  }
  const walletClient = createWalletClient({
    chain,
    transport: custom(window.ethereum)
  });
  const [account] = await walletClient.requestAddresses();
  await ensureChain(walletClient, chainId);
  return { walletClient, account };
}

/** Ensure the wallet is on `chainId`, adding the chain if the wallet does not know it. */
export async function ensureChain(walletClient, chainId) {
  const chain = viemChainFor(chainId);
  if (!chain) {
    throw new Error(`Unsupported network (chain ${chainId}).`);
  }
  const current = await walletClient.getChainId();
  if (current === chainId) return;

  try {
    await walletClient.switchChain({ id: chainId });
    return;
  } catch (error) {
    // 4902: chain not added to the wallet yet - add it, then switch.
    if (error && (error.code === 4902 || error.code === -32603)) {
      await walletClient.addChain({ chain });
      await walletClient.switchChain({ id: chainId });
      return;
    }
    throw error;
  }
}

export const inputsToHex = (inputs) => bytesToHex(Uint8Array.from(inputs));
export const hexToInputs = (hex) => Array.from(hexToBytes(hex));

/**
 * Submit a recorded run for one chain's contract. The contract simulates it and
 * computes the time.
 * @returns {Promise<{hash:string, finishTime:number}>}
 */
export async function submitRun(publicClient, walletClient, address, chainId, account, inputs) {
  const chain = viemChainFor(chainId);
  if (!chain) {
    throw new Error(`Unsupported network (chain ${chainId}).`);
  }
  const hash = await walletClient.writeContract({
    address,
    abi: GAME_ABI,
    functionName: "submitRun",
    args: [inputsToHex(inputs)],
    account,
    chain
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }

  let finishTime;
  const logs = parseEventLogs({ abi: GAME_ABI, eventName: "RunVerified", logs: receipt.logs });
  if (logs.length > 0) {
    finishTime = Number(logs[0].args.finishTime);
  } else {
    finishTime = Number(
      await publicClient.readContract({
        address,
        abi: GAME_ABI,
        functionName: "getFinishTime",
        args: [inputsToHex(inputs)]
      })
    );
  }
  return { hash, finishTime };
}

/** Read verified leaderboard entries (contract-simulated times).
 *
 * The on-chain board is unbounded, so it is read in bounded pages via
 * `getLeaderboardPage(offset, limit)` rather than one unbounded
 * `getLeaderboard()` call. `MAX_PAGES * PAGE_SIZE` caps the worst-case reads.
 */
const LEADERBOARD_PAGE_SIZE = 200;
const LEADERBOARD_MAX_PAGES = 50; // hard cap: at most 10,000 entries per refresh

export async function fetchLeaderboard(publicClient, address) {
  const entries = [];
  for (let page = 0; page < LEADERBOARD_MAX_PAGES; page++) {
    const offset = page * LEADERBOARD_PAGE_SIZE;
    const [players, times] = await publicClient.readContract({
      address,
      abi: GAME_ABI,
      functionName: "getLeaderboardPage",
      args: [BigInt(offset), BigInt(LEADERBOARD_PAGE_SIZE)]
    });
    for (let i = 0; i < players.length; i++) {
      entries.push({ player: players[i], time: Number(times[i]) });
    }
    if (players.length < LEADERBOARD_PAGE_SIZE) break;
  }
  return entries;
}

/** Read the verified input log for a player, so the client can replay the ghost. */
export async function fetchGhostInputs(publicClient, address, player) {
  const hex = await publicClient.readContract({
    address,
    abi: GAME_ABI,
    functionName: "getRunInputs",
    args: [player]
  });
  return hexToInputs(hex);
}

/**
 * Read one player's current contract-verified best time. This is a single
 * targeted `eth_call` (O(1) storage reads), used to update the leaderboard
 * immediately after a submission without a full paged re-read.
 */
export async function fetchBestTime(publicClient, address, player) {
  const [finishTime] = await publicClient.readContract({
    address,
    abi: GAME_ABI,
    functionName: "bestRuns",
    args: [player]
  });
  return Number(finishTime);
}
