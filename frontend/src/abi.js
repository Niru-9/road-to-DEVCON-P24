// Minimal ABI for SpeedrunGhosts.
// Declared as a JSON array (not parseAbi) because the contract uses a tuple
// (Obstacle[]) return value, which parseAbi's human-readable form cannot express.
export const GAME_ABI = [
  // ---- level data (single source of truth) ----
  { type: "function", name: "LEVEL_WIDTH", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "LEVEL_HEIGHT", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "GROUND_Y", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "GOAL_X", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "PLAYER_START_X", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "PLAYER_START_Y", stateMutability: "view", inputs: [], outputs: [{ type: "int256" }] },
  { type: "function", name: "TICK_MS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MAX_INPUT_LENGTH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getObstacles",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "minX", type: "int256" },
          { name: "maxX", type: "int256" },
          { name: "minY", type: "int256" },
          { name: "maxY", type: "int256" },
          { name: "isHazard", type: "bool" }
        ]
      }
    ]
  },
  // ---- verification + leaderboard ----
  {
    type: "function",
    name: "submitRun",
    stateMutability: "nonpayable",
    inputs: [{ name: "inputs", type: "bytes" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "getFinishTime",
    stateMutability: "pure",
    inputs: [{ name: "inputs", type: "bytes" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "getLeaderboard",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "players", type: "address[]" },
      { name: "times", type: "uint256[]" }
    ]
  },
  {
    type: "function",
    name: "leaderboardSize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "getLeaderboardPage",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" }
    ],
    outputs: [
      { name: "players", type: "address[]" },
      { name: "times", type: "uint256[]" }
    ]
  },
  {
    type: "function",
    name: "getRunInputs",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ type: "bytes" }]
  },
  {
    type: "function",
    name: "bestRuns",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "finishTime", type: "uint256" },
      { name: "inputs", type: "bytes" }
    ]
  },
  // ---- events ----
  {
    type: "event",
    name: "RunVerified",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "finishTime", type: "uint256", indexed: false },
      { name: "inputs", type: "bytes", indexed: false }
    ]
  },
  {
    type: "event",
    name: "NewBest",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "oldTime", type: "uint256", indexed: false },
      { name: "newTime", type: "uint256", indexed: false }
    ]
  }
];
