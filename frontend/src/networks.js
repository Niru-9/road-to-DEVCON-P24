// Dual-network registry for Speedrun Ghosts.
//
// Pure data + pure helpers only (no viem, no DOM), so it can be unit-tested with
// `node --test` (see test/networks.test.mjs).
//
// The same SpeedrunGhosts bytecode works on either network when deployed there.
// Contract addresses are configured PER CHAIN and are never shared:
// resolveAddress() returns "" for a chain with no configured address and never
// falls back to another chain's address.

export const CHAIN_IDS = {
  ethereumSepolia: 11155111,
  baseSepolia: 84532
};

// Ethereum Sepolia is our only deployment + manual-verification target and the
// default. Base Sepolia is supported/configurable for a separate deployment by
// someone who has Base Sepolia test ETH; we have NOT deployed to or verified it.
export const SUPPORTED_CHAINS = [
  {
    id: CHAIN_IDS.ethereumSepolia,
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    rpcEnv: "VITE_SEPOLIA_RPC_URL",
    addressEnv: "VITE_SEPOLIA_CONTRACT_ADDRESS",
    explorer: "https://sepolia.etherscan.io",
    defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com"
  },
  {
    id: CHAIN_IDS.baseSepolia,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    rpcEnv: "VITE_BASE_SEPOLIA_RPC_URL",
    addressEnv: "VITE_BASE_SEPOLIA_CONTRACT_ADDRESS",
    explorer: "https://sepolia.basescan.org",
    defaultRpc: "https://sepolia.base.org"
  }
];

export const DEFAULT_CHAIN_ID = CHAIN_IDS.ethereumSepolia;

export function getChainMeta(id) {
  return SUPPORTED_CHAINS.find((c) => c.id === id);
}

export function isSupportedChain(id) {
  return id !== undefined && id !== null && getChainMeta(id) !== undefined;
}

export function isContractAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value === undefined || value === null ? "" : value).trim());
}

function envValue(env, name) {
  const raw = env ? env[name] : undefined;
  return raw === undefined || raw === null ? "" : String(raw).trim();
}

/**
 * Resolve the deployed contract address for one specific chain. Returns "" when
 * that chain has no configured address; it never falls back to another chain's
 * address.
 */
export function resolveAddress(id, env) {
  const meta = getChainMeta(id);
  if (!meta) return "";
  const value = envValue(env, meta.addressEnv);
  return isContractAddress(value) ? value : "";
}

export function hasAddress(id, env) {
  return resolveAddress(id, env) !== "";
}

/**
 * Resolve the RPC URL for one chain, falling back to that chain's own public
 * default. Never returns another chain's endpoint.
 */
export function resolveRpcUrl(id, env) {
  const meta = getChainMeta(id);
  if (!meta) return "";
  const value = envValue(env, meta.rpcEnv);
  return value !== "" ? value : meta.defaultRpc;
}

/** A write is only safe when the wallet's chain equals the app's selected chain. */
export function walletMatchesSelected(walletChainId, selectedChainId) {
  return walletChainId === selectedChainId;
}

/**
 * True only when a transaction can safely be sent: a wallet is connected, that
 * wallet is on the selected chain, and the selected chain has a configured
 * contract address.
 */
export function canTransact({ isConnected, walletChainId, selectedChainId, env }) {
  return (
    Boolean(isConnected) &&
    walletMatchesSelected(walletChainId, selectedChainId) &&
    hasAddress(selectedChainId, env)
  );
}
