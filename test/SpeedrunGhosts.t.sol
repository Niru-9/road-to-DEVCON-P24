// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {console2} from "forge-std/console2.sol";
import {SpeedrunGhosts} from "../src/SpeedrunGhosts.sol";

contract SpeedrunGhostsTest is Test {
    SpeedrunGhosts public game;

    function setUp() public {
        game = new SpeedrunGhosts();
    }

    function test_allRightFinishesAtTick359Parity() public {
        bytes memory inputs = new bytes(400);
        for (uint256 i = 0; i < inputs.length; i++) {
            inputs[i] = 0x02;
        }
        assertEq(game.getFinishTime(inputs), 5744);
        assertEq(game.submitRun(inputs), 5744);
        (, bytes memory stored) = game.bestRuns(address(this));
        assertEq(stored.length, 400);
    }

    function test_basicRunCompletes() public {
        uint256 ticksNeeded = (760 - 40) / 2 + 30;
        bytes memory inputs = new bytes(ticksNeeded);
        for (uint256 i = 0; i < ticksNeeded; i++) {
            inputs[i] = 0x02;
        }
        uint256 time = game.submitRun(inputs);
        assertGt(time, 0);
    }

    function test_revertOnOverlongInput() public {
        // Exactly one byte over the limit must revert; read the limit from the
        // contract so this tracks any future constant change.
        uint256 over = game.MAX_INPUT_LENGTH() + 1;
        bytes memory longInputs = new bytes(over);
        for (uint256 i = 0; i < longInputs.length; i++) {
            longInputs[i] = 0x02;
        }
        vm.expectRevert("Input too long");
        game.submitRun(longInputs);
    }

    function test_doesNotRecordUnfinished() public {
        bytes memory shortInputs = new bytes(5);
        for (uint256 i = 0; i < shortInputs.length; i++) {
            shortInputs[i] = 0x02;
        }
        vm.expectRevert("Did not finish");
        game.submitRun(shortInputs);
    }

    function test_inputsRetrievable() public {
        uint256 ticksNeeded = (760 - 40) / 2 + 30;
        bytes memory inputs = new bytes(ticksNeeded);
        for (uint256 i = 0; i < ticksNeeded; i++) {
            inputs[i] = 0x02;
        }
        game.submitRun(inputs);
        bytes memory retrieved = game.getRunInputs(address(this));
        assertEq(retrieved.length, inputs.length);
    }

    function test_personalBestOnlyFaster() public {
        uint256 ticksNeeded = (760 - 40) / 2 + 30;
        bytes memory inputs1 = new bytes(ticksNeeded);
        for (uint256 i = 0; i < ticksNeeded; i++) {
            inputs1[i] = 0x02;
        }
        uint256 time1 = game.submitRun(inputs1);

        bytes memory inputs2 = new bytes(ticksNeeded + 50);
        for (uint256 i = 0; i < 20; i++) {
            inputs2[i] = 0x00;
        }
        for (uint256 i = 20; i < inputs2.length; i++) {
            inputs2[i] = 0x02;
        }
        uint256 time2 = game.submitRun(inputs2);
        assertGt(time2, time1);
        (, uint256[] memory times) = game.getLeaderboard();
        assertEq(times[0], time1);
    }

    function test_personalBestReplacedByFaster() public {
        uint256 ticksNeeded = (760 - 40) / 2 + 40;
        bytes memory inputsSlow = new bytes(ticksNeeded + 60);
        for (uint256 i = 0; i < 25; i++) {
            inputsSlow[i] = 0x00;
        }
        for (uint256 i = 25; i < inputsSlow.length; i++) {
            inputsSlow[i] = 0x02;
        }
        uint256 timeSlow = game.submitRun(inputsSlow);

        bytes memory inputsFast = new bytes(ticksNeeded);
        for (uint256 i = 0; i < inputsFast.length; i++) {
            inputsFast[i] = 0x02;
        }
        uint256 timeFast = game.submitRun(inputsFast);
        assertLt(timeFast, timeSlow);
        (, uint256[] memory times) = game.getLeaderboard();
        assertEq(times[0], timeFast);
    }

    /// @dev A run of exactly `len` inputs that finishes on its very last step:
    ///      360 right ticks take the player from x=40 to x=760; the final right
    ///      is placed on input `len - 1`, so no earlier step can reach the goal.
    function _finishingRunOfLength(uint256 len) internal pure returns (bytes memory inputs) {
        inputs = new bytes(len);
        for (uint256 i = 0; i < len - 1 && i < 359; i++) {
            inputs[i] = 0x02;
        }
        inputs[len - 1] = 0x02;
    }

    // Regression / boundary: the maximum allowed valid input is accepted, its
    // on-chain finish time matches the simulation, and the full input is stored.
    function test_maxLengthInputAcceptedAndFinishTime() public {
        uint256 maxLen = game.MAX_INPUT_LENGTH();
        assertGe(maxLen, 360); // geometry: 360 right ticks reach the goal
        bytes memory inputs = _finishingRunOfLength(maxLen);
        assertEq(inputs.length, maxLen);

        uint256 expected = (maxLen - 1) * game.TICK_MS();
        uint256 time = game.submitRun(inputs);
        assertEq(time, expected);

        (uint256 storedTime, bytes memory storedInputs) = game.bestRuns(address(this));
        assertEq(storedTime, expected);
        assertEq(storedInputs.length, maxLen);
    }

    // Gas budget: a valid maximum-length submission (full simulation + storage +
    // events) must stay well below the 12,000,000 gas cap (Sepolia per-tx cap is
    // 16,777,216). Guard against regressions that inflate per-tick cost.
    function test_maxLengthSubmissionGasBelowCap() public {
        uint256 maxLen = game.MAX_INPUT_LENGTH();
        bytes memory inputs = _finishingRunOfLength(maxLen);
        uint256 gasBefore = gasleft();
        game.submitRun(inputs);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("max-length submitRun gasUsed:", gasUsed);
        assertLt(gasUsed, 12_000_000);
    }

    // Regression: improving an existing best must not append the same player to
    // the leaderboard a second time (previously the dedupe was an O(n) scan of
    // the unbounded `leaderboardPlayers` array; now an O(1) membership mapping).
    function test_noDuplicateLeaderboardEntryOnImprovement() public {
        uint256 ticksNeeded = (760 - 40) / 2 + 30;

        // Player A: slower best, then a faster best from the same address.
        bytes memory slow = new bytes(ticksNeeded + 60);
        for (uint256 i = 0; i < 25; i++) {
            slow[i] = 0x00;
        }
        for (uint256 i = 25; i < slow.length; i++) {
            slow[i] = 0x02;
        }
        game.submitRun(slow);

        bytes memory fast = new bytes(ticksNeeded);
        for (uint256 i = 0; i < fast.length; i++) {
            fast[i] = 0x02;
        }
        uint256 timeFast = game.submitRun(fast);

        // Player B submits the same fast run: a distinct entry, appended once.
        vm.prank(address(0xB0B));
        game.submitRun(fast);
        (address[] memory players, uint256[] memory times) = game.getLeaderboard();
        assertEq(players.length, 2);
        assertEq(players[0], address(this));
        assertEq(players[1], address(0xB0B));
        assertEq(times[0], timeFast);

        // A third run from A (an even faster best) must still not duplicate A.
        bytes memory faster = new bytes(ticksNeeded);
        for (uint256 i = 0; i < faster.length; i++) {
            faster[i] = 0x02;
        }
        game.submitRun(faster);
        (address[] memory players2,) = game.getLeaderboard();
        assertEq(players2.length, 2);
        assertEq(players2[0], address(this));
    }

    // A run that reaches the goal in the same number of ticks must NOT replace an
    // existing best (the rule is strictly faster). Trailing inputs past the goal
    // are never simulated, so a longer run can share the same finish time.
    function test_equalFinishTimeDoesNotReplaceBest() public {
        bytes memory shortRun = _finishingRunOfLength(360);
        uint256 t1 = game.submitRun(shortRun);
        assertEq(t1, 5744);

        bytes memory longer = new bytes(400);
        for (uint256 i = 0; i < longer.length; i++) {
            longer[i] = 0x02;
        }

        vm.recordLogs();
        uint256 t2 = game.submitRun(longer);
        assertEq(t2, 5744); // same finish time

        // No NewBest was emitted for the equal-time submission.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 newBestSig = keccak256("NewBest(address,uint256,uint256)");
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != newBestSig, "equal time must not emit NewBest");
        }
        // The stored best is still the FIRST submission's inputs (360 bytes).
        (uint256 storedTime, bytes memory stored) = game.bestRuns(address(this));
        assertEq(storedTime, 5744);
        assertEq(stored.length, 360);
    }

    // Level data is read from the contract during simulation (check 5 support):
    // the documented four obstacles are present with their expected geometry.
    function test_getObstaclesMatchesDocumentedLevel() public view {
        SpeedrunGhosts.Obstacle[] memory obs = game.getObstacles();
        assertEq(obs.length, 4);
        assertEq(obs[0].minX, 200);
        assertEq(obs[0].maxX, 220);
        assertEq(obs[0].maxY, 40);
        assertEq(obs[1].minX, 400);
        assertEq(obs[1].maxX, 420);
        assertEq(obs[1].maxY, 80);
        assertEq(obs[2].minX, 600);
        assertEq(obs[3].minX, 500);
        // Every obstacle in this level is a solid (no hazards), so the hazard
        // branch of the simulation is intentionally not exercised at runtime.
        for (uint256 i = 0; i < obs.length; i++) {
            assertFalse(obs[i].isHazard);
        }
    }

    /// @dev A finishing run with `idle` no-input ticks first, then 360 right ticks
    ///      (x: 40 -> 760). Its finish time is `(idle + 359) * TICK_MS`.
    function _runWithIdle(uint256 idle) internal pure returns (bytes memory inputs) {
        inputs = new bytes(idle + 360);
        for (uint256 i = idle; i < inputs.length; i++) {
            inputs[i] = 0x02;
        }
    }

    function _submitFor(address who, uint256 idle) internal returns (uint256 time) {
        vm.prank(who);
        time = game.submitRun(_runWithIdle(idle));
    }

    // Bounded pagination reconstructs exactly the same board as the full read,
    // in insertion order.
    function test_leaderboardPagingReconstructsFullBoard() public {
        uint256 n = 12;
        address[] memory expected = new address[](n);
        uint256[] memory expectedTimes = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            address who = address(uint160(0x1000 + i));
            expected[i] = who;
            expectedTimes[i] = _submitFor(who, i);
        }
        assertEq(game.leaderboardSize(), n);

        (address[] memory fullPlayers, uint256[] memory fullTimes) = game.getLeaderboard();
        for (uint256 off = 0; off < n; off += 5) {
            (address[] memory pp, uint256[] memory tt) = game.getLeaderboardPage(off, 5);
            for (uint256 i = 0; i < pp.length; i++) {
                assertEq(pp[i], fullPlayers[off + i]);
                assertEq(tt[i], fullTimes[off + i]);
            }
        }
        for (uint256 i = 0; i < n; i++) {
            assertEq(fullPlayers[i], expected[i]);
            assertEq(fullTimes[i], expectedTimes[i]);
        }
    }

    // Page boundary behaviour: limit 0, offset >= size and a clamped last page.
    function test_leaderboardPageBoundaries() public {
        uint256 n = 3;
        for (uint256 i = 0; i < n; i++) {
            _submitFor(address(uint160(0x2000 + i)), i);
        }

        (address[] memory p0, uint256[] memory t0) = game.getLeaderboardPage(0, 0);
        assertEq(p0.length, 0);
        assertEq(t0.length, 0);

        (address[] memory p1,) = game.getLeaderboardPage(n, 10);
        assertEq(p1.length, 0);

        (address[] memory p2,) = game.getLeaderboardPage(n + 5, 10);
        assertEq(p2.length, 0);

        (address[] memory p3, uint256[] memory t3) = game.getLeaderboardPage(n - 1, 10);
        assertEq(p3.length, 1);
        assertEq(t3.length, 1);
        assertEq(p3[0], address(uint160(0x2000 + n - 1)));

        // A page fully inside the array returns exactly `limit` entries.
        (address[] memory p4,) = game.getLeaderboardPage(0, 2);
        assertEq(p4.length, 2);
    }

    // Stress the read path and record its cost as the board grows. The full read
    // is O(n); a bounded page is O(limit) and independent of the total count.
    function test_fullLeaderboardReadGasMeasured() public {
        uint256 n = 30;
        for (uint256 i = 0; i < n; i++) {
            _submitFor(address(uint160(0x5000 + i)), i);
        }
        assertEq(game.leaderboardSize(), n);

        uint256 gasBefore = gasleft();
        game.getLeaderboard();
        uint256 fullGas = gasBefore - gasleft();

        uint256 gasBeforePage = gasleft();
        game.getLeaderboardPage(0, 10);
        uint256 pageGas = gasBeforePage - gasleft();

        console2.log("getLeaderboard gas @30 players:", fullGas);
        console2.log("getLeaderboardPage(0,10) gas @30 players:", pageGas);

        // Bounded by the default eth_call gas cap on public Sepolia RPCs (50M).
        assertLt(fullGas, 5_000_000);
        // A bounded page stays cheap regardless of the total player count.
        assertLt(pageGas, 200_000);
    }
}
