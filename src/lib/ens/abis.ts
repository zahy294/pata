// ENSv2 ABIs we call, copied from ensdomains/contracts-v2@07e55a05 contracts/deployments/sepolia/<Contract>.json
// (docs/research/ens-v2.md, Install and setup). Owner: blockchain (P0-8).
// Copy only the functions and events we use, as `parseAbi([...])` fragments or `as const` JSON,
// and name the source file above each one. Fetch with:
//   curl -s https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/UserRegistryImpl.json
//
// Needed for P0:
// - VerifiableFactory: deployProxy, predictProxyAddress, verifyContract, event ProxyDeployed
// - UserRegistry (PermissionedRegistry): initialize, register, unregister, getState, getStatus,
//   getOwner, setSubregistry, events LabelRegistered, LabelUnregistered
// - PermissionedResolver: initialize, setText, multicall, resolve
// - UniversalHelper: findExactOwner
// - ETHRegistrar (owner script, P0-2): isAvailable, getRegisterPrice, makeCommitment, commit, register
// - MockUSDC: mint, approve

import { parseAbi } from "viem";

// https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/VerifiableFactory.json
export const verifiableFactoryAbi = parseAbi([
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)",
  "function predictProxyAddress(address deployer, uint256 salt) view returns (address proxy)",
  "function verifyContract(address proxy) view returns (address implementation)",
]);

// https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/UserRegistryImpl.json
export const userRegistryAbi = parseAbi([
  "event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)",
  "event LabelUnregistered(uint256 indexed tokenId, address indexed sender)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource) state)",
  "function getStatus(uint256 anyId) view returns (uint8)",
  "function initialize((address account, uint256 roleBitmap)[] grants)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)",
  "function setSubregistry(uint256 anyId, address registry)",
  "function unregister(uint256 anyId)",
]);

// https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/PermissionedResolverImpl.json
export const permissionedResolverAbi = parseAbi([
  "function initialize((address account, uint256 roleBitmap)[] grants, bytes[] calls)",
  "function multicall(bytes[] calls) returns (bytes[] results)",
  "function resolve(bytes name, bytes data) view returns (bytes)",
  "function setText(bytes name, string key, string value)",
]);

// https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/UniversalHelper.json
export const universalHelperAbi = parseAbi(["function findExactOwner(bytes name) view returns (address)"]);

// https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/ETHRegistrar.json
export const ethRegistrarAbi = parseAbi([
  "function commit(bytes32 commitment)",
  "function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
  "function isAvailable(string label) view returns (bool)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256 tokenId)",
]);

// https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/MockUSDC.json
export const mockUsdcAbi = parseAbi([
  "function approve(address spender, uint256 value) returns (bool)",
  "function mint(address to, uint256 amount)",
]);
