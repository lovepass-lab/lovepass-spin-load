// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {MailboxRegistry} from "../src/MailboxRegistry.sol";

/// @notice Deploys MailboxRegistry and prints the address.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        MailboxRegistry reg = new MailboxRegistry();
        vm.stopBroadcast();
        console2.log("MailboxRegistry:", address(reg));
    }
}
