// Level data loader.
//
// There are NO level literals in the client. Every value below is fetched from
// the deployed contract at runtime, so the contract is the single source of
// truth for the level (width/height/ground/goal/start/tick/obstacles).
import { GAME_ABI } from "./abi.js";

function toNumber(value) {
  return Number(value);
}

function normalizeObstacle(obstacle) {
  // viem decodes named tuples to objects; fall back to positional arrays.
  if (Array.isArray(obstacle)) {
    return {
      minX: toNumber(obstacle[0]),
      maxX: toNumber(obstacle[1]),
      minY: toNumber(obstacle[2]),
      maxY: toNumber(obstacle[3]),
      isHazard: Boolean(obstacle[4])
    };
  }
  return {
    minX: toNumber(obstacle.minX),
    maxX: toNumber(obstacle.maxX),
    minY: toNumber(obstacle.minY),
    maxY: toNumber(obstacle.maxY),
    isHazard: Boolean(obstacle.isHazard)
  };
}

async function readConstant(client, address, functionName) {
  return client.readContract({ address, abi: GAME_ABI, functionName });
}

/**
 * Read the full level definition from the contract.
 * @param {import('viem').PublicClient} client
 * @param {`0x${string}`} address
 * @returns {Promise<{width:number,height:number,groundY:number,goalX:number,startX:number,startY:number,tickMs:number,maxInputLength:number,obstacles:Array}>}
 */
export async function loadLevel(client, address) {
  const [
    width,
    height,
    groundY,
    goalX,
    startX,
    startY,
    tickMs,
    maxInputLength,
    rawObstacles
  ] = await Promise.all([
    readConstant(client, address, "LEVEL_WIDTH"),
    readConstant(client, address, "LEVEL_HEIGHT"),
    readConstant(client, address, "GROUND_Y"),
    readConstant(client, address, "GOAL_X"),
    readConstant(client, address, "PLAYER_START_X"),
    readConstant(client, address, "PLAYER_START_Y"),
    readConstant(client, address, "TICK_MS"),
    readConstant(client, address, "MAX_INPUT_LENGTH"),
    readConstant(client, address, "getObstacles")
  ]);

  return {
    width: toNumber(width),
    height: toNumber(height),
    groundY: toNumber(groundY),
    goalX: toNumber(goalX),
    startX: toNumber(startX),
    startY: toNumber(startY),
    tickMs: toNumber(tickMs),
    maxInputLength: toNumber(maxInputLength),
    obstacles: rawObstacles.map(normalizeObstacle)
  };
}
