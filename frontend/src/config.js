// Chain configuration for the Speedrun Ghosts client.
//
// Both Ethereum Sepolia (11155111) and Base Sepolia (84532) are configured, each
// with its OWN contract address and RPC. Ethereum Sepolia is the default.
//
// We deploy and manually verify ONLY on Ethereum Sepolia. Base Sepolia is
// supported/configurable for a separate deployment by someone who has Base
// Sepolia test ETH; we have NOT deployed to or verified it. Addresses are never
// shared between networks.

import {
  CHAIN_IDS,
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAINS,
  getChainMeta,
  hasAddress,
  isContractAddress,
  isSupportedChain,
  resolveAddress,
  resolveRpcUrl
} from "./networks.js";

export {
  CHAIN_IDS,
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAINS,
  getChainMeta,
  isContractAddress,
  isSupportedChain
};

function env(name, fallback = "") {
  const source = typeof import.meta !== "undefined" && import.meta ? import.meta.env : undefined;
  const value = source ? source[name] : undefined;
  return (value === undefined || value === null ? fallback : String(value)).trim();
}

// The raw env bag, used by the pure resolvers.
export const ENV = (() => {
  try {
    return import.meta && import.meta.env ? import.meta.env : {};
  } catch {
    return {};
  }
})();

export const SELECTED_CHAIN_STORAGE_KEY = "sg.selectedChainId";

/** Contract address for one chain ("" if that chain has none). */
export function addressForChain(chainId) {
  return resolveAddress(chainId, ENV);
}

/** RPC URL for one chain (falls back to that chain's own public default). */
export function rpcForChain(chainId) {
  return resolveRpcUrl(chainId, ENV);
}

/** True when one specific chain has a configured contract address. */
export function hasContractForChain(chainId) {
  return hasAddress(chainId, ENV);
}

/** Default selected chain: VITE_CHAIN_ID if supported, else Ethereum Sepolia. */
export function defaultChainId() {
  const raw = env("VITE_CHAIN_ID");
  const parsed = raw ? Number(raw) : NaN;
  return isSupportedChain(parsed) ? parsed : DEFAULT_CHAIN_ID;
}
