// Offline unit tests for the pure dual-network registry.
// These use the same code the browser imports (src/networks.js).
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAIN_IDS,
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAINS,
  canTransact,
  getChainMeta,
  hasAddress,
  isContractAddress,
  isSupportedChain,
  resolveAddress,
  resolveRpcUrl,
  walletMatchesSelected
} from "../src/networks.js";

const SEPOLIA_ADDR = "0x1111111111111111111111111111111111111111";
const BASE_ADDR = "0x2222222222222222222222222222222222222222";

const bothChains = {
  VITE_SEPOLIA_CONTRACT_ADDRESS: SEPOLIA_ADDR,
  VITE_BASE_SEPOLIA_CONTRACT_ADDRESS: BASE_ADDR
};

test("both networks are configured and Ethereum Sepolia is the default", () => {
  assert.equal(SUPPORTED_CHAINS.length, 2);
  assert.equal(DEFAULT_CHAIN_ID, CHAIN_IDS.ethereumSepolia);
  assert.equal(isSupportedChain(11155111), true);
  assert.equal(isSupportedChain(84532), true);
  assert.equal(isSupportedChain(1), false);
  assert.equal(isSupportedChain(undefined), false);
  assert.equal(getChainMeta(84532).name, "Base Sepolia");
  assert.equal(getChainMeta(999), undefined);
});

test("each chain resolves only its own contract address", () => {
  assert.equal(resolveAddress(CHAIN_IDS.ethereumSepolia, bothChains), SEPOLIA_ADDR);
  assert.equal(resolveAddress(CHAIN_IDS.baseSepolia, bothChains), BASE_ADDR);
  assert.equal(hasAddress(CHAIN_IDS.ethereumSepolia, bothChains), true);
  assert.equal(hasAddress(CHAIN_IDS.baseSepolia, bothChains), true);
});

test("a missing address never falls back to another chain's address", () => {
  const baseOnly = { VITE_BASE_SEPOLIA_CONTRACT_ADDRESS: BASE_ADDR };
  assert.equal(resolveAddress(CHAIN_IDS.ethereumSepolia, baseOnly), "");
  assert.equal(hasAddress(CHAIN_IDS.ethereumSepolia, baseOnly), false);
  assert.equal(resolveAddress(CHAIN_IDS.baseSepolia, baseOnly), BASE_ADDR);
});

test("blank and malformed addresses are treated as not configured", () => {
  assert.equal(isContractAddress(""), false);
  assert.equal(isContractAddress("   "), false);
  assert.equal(isContractAddress("0x123"), false);
  assert.equal(isContractAddress(SEPOLIA_ADDR), true);
  assert.equal(resolveAddress(CHAIN_IDS.ethereumSepolia, { VITE_SEPOLIA_CONTRACT_ADDRESS: "x" }), "");
});

test("RPC resolution uses the chain's own env var or its own default", () => {
  const env = { VITE_SEPOLIA_RPC_URL: "https://my-sepolia" };
  assert.equal(resolveRpcUrl(CHAIN_IDS.ethereumSepolia, env), "https://my-sepolia");
  const baseDefault = resolveRpcUrl(CHAIN_IDS.baseSepolia, env);
  assert.equal(baseDefault, getChainMeta(CHAIN_IDS.baseSepolia).defaultRpc);
  assert.notEqual(baseDefault, "https://my-sepolia");
});

test("wrong-network protection: wallet chain must match the selected chain", () => {
  assert.equal(walletMatchesSelected(11155111, 11155111), true);
  assert.equal(walletMatchesSelected(84532, 11155111), false);
  assert.equal(walletMatchesSelected(undefined, 11155111), false);
});

test("canTransact requires connected + matching chain + configured address", () => {
  assert.equal(
    canTransact({ isConnected: true, walletChainId: 11155111, selectedChainId: 11155111, env: bothChains }),
    true
  );
  assert.equal(
    canTransact({ isConnected: true, walletChainId: 84532, selectedChainId: 11155111, env: bothChains }),
    false
  );
  assert.equal(
    canTransact({ isConnected: false, walletChainId: 11155111, selectedChainId: 11155111, env: bothChains }),
    false
  );
  assert.equal(
    canTransact({
      isConnected: true,
      walletChainId: 11155111,
      selectedChainId: 11155111,
      env: { VITE_BASE_SEPOLIA_CONTRACT_ADDRESS: BASE_ADDR }
    }),
    false
  );
});
