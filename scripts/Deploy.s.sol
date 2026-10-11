// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SpeedrunGhosts} from "../src/SpeedrunGhosts.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        SpeedrunGhosts game = new SpeedrunGhosts();
        vm.stopBroadcast();
        console2.log("SpeedrunGhosts deployed at:", address(game));
    }
}
