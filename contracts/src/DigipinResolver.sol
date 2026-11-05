// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExtendedResolver} from "./interfaces/IExtendedResolver.sol";

/// @title DigipinResolver
/// @notice Wildcard resolver for `*.digipin.eth` (ticket P1-1, blockchain).
/// `39j49ll8t4.digipin.eth` resolves to its cell's centre with nothing registered per cell.
/// Read docs/research/digipin.md (algorithm, Solidity decoding) and docs/research/ens-v2.md §7 first.
/// - `resolve(name, data)`: decode the first label of the DNS-encoded `name` as a lowercase DIGIPIN
///   (`^[23456789cjklmpft]{10}$`), then answer `text(bytes32,string)` for `eth.pata.latlon` ("lat,lon")
///   and `location`; revert for any other profile or an invalid label.
/// - Pure and stateless: no owner, no storage.
contract DigipinResolver is IExtendedResolver {
    bytes4 private constant ERC165_ID = 0x01ffc9a7;
    bytes4 private constant EXTENDED_RESOLVER_ID = 0x9061b923;

    error NotImplemented();

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == ERC165_ID || interfaceId == EXTENDED_RESOLVER_ID;
    }

    function resolve(bytes calldata, bytes calldata) external pure returns (bytes memory) {
        revert NotImplemented();
    }
}
