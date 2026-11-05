// ENSv2 ABIs we call, copied from ensdomains/contracts-v2@07e55a05 contracts/deployments/sepolia/<Contract>.json
// (docs/research/ens-v2.md, Install and setup). Owner: blockchain (P0-8).
// Copy only the functions and events we use, as `parseAbi([...])` fragments or `as const` JSON,
// and name the source file above each one. Fetch with:
//   curl -s https://raw.githubusercontent.com/ensdomains/contracts-v2/07e55a056f5b6a9c90119f501bdd05714e67dddd/contracts/deployments/sepolia/UserRegistryImpl.json
//
// Needed for P0:
// - VerifiableFactory: deployProxy, predictProxyAddress, event ProxyDeployed
// - UserRegistry (PermissionedRegistry): initialize, register, unregister, getState, getStatus,
//   getOwner, setSubregistry, events LabelRegistered, LabelUnregistered
// - PermissionedResolver: initialize, setText, multicall, resolve
// - UniversalHelper: findExactOwner
// - ETHRegistrar (owner script, P0-2): isAvailable, getRegisterPrice, makeCommitment, commit, register
// - MockUSDC: mint, approve

export {};
