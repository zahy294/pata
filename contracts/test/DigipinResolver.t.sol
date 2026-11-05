// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DigipinResolver} from "../src/DigipinResolver.sol";

/// Tests for P1-1. Add: Dak Bhawan vector (39j49ll8t4), the shared vectors in
/// src/lib/digipin/vectors.json, fuzz round-trips inside the bounds, and rejection of bad labels.
/// Name fork tests *Fork* so `npm run check` skips them.
contract DigipinResolverTest is Test {
    DigipinResolver resolver;

    function setUp() public {
        resolver = new DigipinResolver();
    }

    function test_supportsEnsip10AndErc165() public view {
        assertTrue(resolver.supportsInterface(0x9061b923));
        assertTrue(resolver.supportsInterface(0x01ffc9a7));
        assertFalse(resolver.supportsInterface(0xffffffff));
    }
}
