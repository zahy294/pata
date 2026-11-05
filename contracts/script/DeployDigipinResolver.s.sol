// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {DigipinResolver} from "../src/DigipinResolver.sol";

/// Deploy (owner, P1-1). Foundry reads `.env`, not `.env.local`, so load it first in Git Bash:
///   set -a; source ../.env.local; set +a
///   forge script script/DeployDigipinResolver.s.sol --rpc-url sepolia --broadcast --verify
/// Then set it as digipin.eth's resolver on the ETHRegistry (docs/research/ens-v2.md §7).
contract DeployDigipinResolver is Script {
    function run() external returns (DigipinResolver resolver) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        resolver = new DigipinResolver();
        vm.stopBroadcast();
    }
}
