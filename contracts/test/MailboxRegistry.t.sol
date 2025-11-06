// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {MailboxRegistry} from "../src/MailboxRegistry.sol";

contract MailboxRegistryTest is Test {
    MailboxRegistry reg;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    // namehash("vaped.eth") precomputed for convenience
    bytes32 constant NODE = 0x1c9f0a0031f6e8eab0a6a10c8aa275eb1cf20282d9986afac1ccfaad1c45b2b1;

    function setUp() public {
        reg = new MailboxRegistry();
    }

    function test_setMailbox_initializes_and_sets_controller() public {
        bytes memory pk = hex"010203"; // dummy pubkey bytes
        string memory head = "bafy...head";
        uint32 v = 1;

        vm.prank(alice);
        reg.setMailbox(NODE, pk, head, v);

        (bytes memory outPk, string memory outHead, uint32 outV, address ctrl) = reg.getMailbox(NODE);
        assertEq(ctrl, alice);
        assertEq(outV, v);
        assertEq(outHead, head);
        assertEq(keccak256(outPk), keccak256(pk));
    }

    function test_updateMailbox_requires_controller() public {
        vm.prank(alice);
        reg.setMailbox(NODE, hex"01", "h1", 1);

        // bob cannot update
        vm.expectRevert(MailboxRegistry.NotController.selector);
        vm.prank(bob);
        reg.updateMailbox(NODE, hex"02", "h2", 2);

        // controller updates
        vm.prank(alice);
        reg.updateMailbox(NODE, hex"02", "h2", 2);

        (, string memory outHead, uint32 outV, address ctrl) = reg.getMailbox(NODE);
        assertEq(ctrl, alice);
        assertEq(outV, 2);
        assertEq(outHead, "h2");
    }

    function test_transferController() public {
        vm.prank(alice);
        reg.setMailbox(NODE, hex"01", "h1", 1);

        vm.prank(alice);
        reg.transferController(NODE, bob);

        (, , , address ctrl) = reg.getMailbox(NODE);
        assertEq(ctrl, bob);
    }
}
