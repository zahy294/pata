// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ENSIP-10 wildcard resolution. Vendored instead of installing ensdomains/contracts-v2
/// (one function; the full repo and its nested submodules failed to clone at kick-off).
/// Interface ID 0x9061b923. Source: https://docs.ens.domains/ensip/10
interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
