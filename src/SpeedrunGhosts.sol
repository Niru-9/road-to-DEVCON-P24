// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SpeedrunGhosts {
    struct Run {
        uint256 finishTime;
        bytes inputs;
    }

    uint256 public constant MAX_INPUT_LENGTH = 1000;
    uint256 public constant TICK_MS = 16;

    int256 public constant LEVEL_WIDTH = 800;
    int256 public constant LEVEL_HEIGHT = 400;
    int256 public constant GROUND_Y = 0;
    int256 public constant GOAL_X = 760;
    int256 public constant PLAYER_START_X = 40;
    int256 public constant PLAYER_START_Y = 0;

    struct Obstacle {
        int256 minX;
        int256 maxX;
        int256 minY;
        int256 maxY;
        bool isHazard;
    }

    function getObstacles() public pure returns (Obstacle[] memory) {
        Obstacle[] memory obstacles = new Obstacle[](4);
        obstacles[0] = Obstacle({minX: 200, maxX: 220, minY: 0, maxY: 40, isHazard: false});
        obstacles[1] = Obstacle({minX: 400, maxX: 420, minY: 0, maxY: 80, isHazard: false});
        obstacles[2] = Obstacle({minX: 600, maxX: 620, minY: 0, maxY: 40, isHazard: false});
        obstacles[3] = Obstacle({minX: 500, maxX: 520, minY: -10, maxY: 0, isHazard: false});
        return obstacles;
    }

    mapping(address => Run) public bestRuns;
    address[] public leaderboardPlayers;
    /// @dev Membership flag so a player is appended to `leaderboardPlayers` only
    ///      once; avoids an O(n) scan of the (unbounded) array on every best.
    mapping(address => bool) private onLeaderboard;

    event RunVerified(address indexed player, uint256 finishTime, bytes inputs);
    event NewBest(address indexed player, uint256 oldTime, uint256 newTime);

    struct PlayerState {
        int256 x;
        int256 y;
        int256 vx;
        int256 vy;
        bool onGround;
        bool finished;
        bool dead;
    }

    function submitRun(bytes calldata inputs) external returns (uint256) {
        require(inputs.length <= MAX_INPUT_LENGTH, "Input too long");
        require(inputs.length > 0, "Empty inputs");

        uint256 finishTime = _computeFinishTime(inputs);
        require(finishTime > 0, "Invalid finish");

        Run memory existing = bestRuns[msg.sender];
        if (existing.finishTime == 0 || finishTime < existing.finishTime) {
            uint256 oldTime = existing.finishTime;
            bestRuns[msg.sender] = Run({finishTime: finishTime, inputs: inputs});
            if (!onLeaderboard[msg.sender]) {
                onLeaderboard[msg.sender] = true;
                leaderboardPlayers.push(msg.sender);
            }
            emit NewBest(msg.sender, oldTime, finishTime);
        }
        emit RunVerified(msg.sender, finishTime, inputs);
        return finishTime;
    }

    function _computeFinishTime(bytes calldata inputs) internal pure returns (uint256) {
        PlayerState memory state = PlayerState({
            x: PLAYER_START_X,
            y: PLAYER_START_Y,
            vx: 0,
            vy: 0,
            onGround: true,
            finished: false,
            dead: false
        });
        Obstacle[] memory obstacles = getObstacles();
        for (uint256 i = 0; i < inputs.length; i++) {
            if (state.finished || state.dead) break;
            uint8 inp = uint8(inputs[i]);
            state = step(state, inp, obstacles);
            if (state.finished) {
                return i * TICK_MS;
            }
        }
        revert("Did not finish");
    }

    function getFinishTime(bytes calldata inputs) external pure returns (uint256) {
        return _computeFinishTime(inputs);
    }

    function step(PlayerState memory state, uint8 input, Obstacle[] memory obstacles)
        internal
        pure
        returns (PlayerState memory)
    {
        PlayerState memory newState = state;
        bool left = (input & 0x01) != 0;
        bool right = (input & 0x02) != 0;
        bool jump = (input & 0x04) != 0;

        if (left && !right) {
            newState.vx = -2;
        } else if (right && !left) {
            newState.vx = 2;
        } else {
            newState.vx = 0;
        }

        if (jump && newState.onGround) {
            newState.vy = 4;
            newState.onGround = false;
        }

        newState.vy = newState.vy - 1;
        newState.x = newState.x + newState.vx;
        newState.y = newState.y + newState.vy;

        newState = resolveCollisions(newState, obstacles);

        if (isTouchingHazard(newState, obstacles)) {
            newState.dead = true;
            newState.finished = false;
            return newState;
        }

        if (newState.x >= GOAL_X) {
            newState.finished = true;
            return newState;
        }

        if (
            newState.x < 0 || newState.x > LEVEL_WIDTH || newState.y < -200
                || newState.y > LEVEL_HEIGHT
        ) {
            newState.dead = true;
            return newState;
        }

        return newState;
    }

    function resolveCollisions(PlayerState memory state, Obstacle[] memory obstacles)
        internal
        pure
        returns (PlayerState memory)
    {
        PlayerState memory newState = state;
        if (newState.y <= GROUND_Y) {
            newState.y = GROUND_Y;
            newState.vy = 0;
            newState.onGround = true;
        }

        for (uint256 i = 0; i < obstacles.length; i++) {
            if (obstacles[i].isHazard) continue;
            if (
                newState.x >= obstacles[i].minX && newState.x <= obstacles[i].maxX
                    && newState.y >= obstacles[i].minY && newState.y <= obstacles[i].maxY
            ) {
                newState.y = obstacles[i].maxY;
                newState.vy = 0;
                newState.onGround = true;
            }
        }
        return newState;
    }

    function isTouchingHazard(PlayerState memory state, Obstacle[] memory obstacles)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < obstacles.length; i++) {
            if (!obstacles[i].isHazard) continue;
            if (
                state.x >= obstacles[i].minX && state.x <= obstacles[i].maxX
                    && state.y >= obstacles[i].minY && state.y <= obstacles[i].maxY
            ) {
                return true;
            }
        }
        return false;
    }

    function getLeaderboard() external view returns (address[] memory, uint256[] memory) {
        uint256[] memory times = new uint256[](leaderboardPlayers.length);
        for (uint256 i = 0; i < leaderboardPlayers.length; i++) {
            times[i] = bestRuns[leaderboardPlayers[i]].finishTime;
        }
        return (leaderboardPlayers, times);
    }

    /// @notice Number of distinct players that have ever recorded a best time.
    /// @dev Cheap O(1) read so a client can drive pagination without pulling the
    ///      whole (unbounded) array.
    function leaderboardSize() external view returns (uint256) {
        return leaderboardPlayers.length;
    }

    /// @notice Bounded slice of the leaderboard, so a reader never has to pull an
    ///         unbounded array in a single call. `getLeaderboard()` is kept for
    ///         backward compatibility; prefer this for large boards.
    /// @dev Cost is O(limit), independent of the total player count.
    /// @param offset index of the first entry (0-based); `>= leaderboardSize()`
    ///        returns two empty arrays.
    /// @param limit  maximum number of entries to return; `0` returns empty.
    function getLeaderboardPage(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory players, uint256[] memory times)
    {
        uint256 total = leaderboardPlayers.length;
        if (offset >= total || limit == 0) {
            return (new address[](0), new uint256[](0));
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 n = end - offset;
        players = new address[](n);
        times = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            address player = leaderboardPlayers[offset + i];
            players[i] = player;
            times[i] = bestRuns[player].finishTime;
        }
    }

    function getRunInputs(address player) external view returns (bytes memory) {
        return bestRuns[player].inputs;
    }
}
