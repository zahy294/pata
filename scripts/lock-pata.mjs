// node scripts/lock-pata.mjs --household <label> [--confirm-irreversible]   (P0-2, owner only)
// Revokes ROLE_SET_SUBREGISTRY (+ admin) on `pata` in the ETHRegistry from the deployer, so the provider can
// never swap out pata.eth's registry and take household names back (ADR 0003, ens-v2.md Gotcha 7).
// IRREVERSIBLE. Run only after a household has registered through /register and works end to end.
// Without --confirm-irreversible it only checks and simulates.
import { createPublicClient, createWalletClient, http, labelhash, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnv, safeRpcError, toPrivateKey } from "./env-file.mjs";

const ETH_REGISTRY = "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4";
const ROLE_SET_SUBREGISTRY = 1n << 20n;
const LOCK = ROLE_SET_SUBREGISTRY | (ROLE_SET_SUBREGISTRY << 128n);

const args = process.argv.slice(2);
const confirm = args.includes("--confirm-irreversible");
const household = args[args.indexOf("--household") + 1];
if (!args.includes("--household") || !household) {
  console.error(
    "Usage: node scripts/lock-pata.mjs --household <label of a working household> [--confirm-irreversible]",
  );
  process.exit(1);
}

const ethRegistryAbi = parseAbi([
  "function getOwner(uint256 anyId) view returns (address)",
  "function getSubregistry(string label) view returns (address)",
  "function roles(uint256 anyId, address account) view returns (uint256)",
  "function revokeRoles(uint256 anyId, uint256 roleBitmap, address account) returns (bool)",
]);
const userRegistryAbi = parseAbi([
  "function isEmancipated() view returns (bool)",
  "function getStatus(uint256 anyId) view returns (uint8)",
]);

const env = loadEnv();
const deployer = privateKeyToAccount(toPrivateKey("DEPLOYER_PRIVATE_KEY", env.DEPLOYER_PRIVATE_KEY ?? ""));
const pub = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const wallet = createWalletClient({
  account: deployer,
  chain: sepolia,
  transport: http(env.SEPOLIA_RPC_URL),
});
const id = BigInt(labelhash("pata"));

const fail = (m) => {
  console.error(`Stopped: ${m}`);
  process.exit(1);
};

const owner = await pub.readContract({
  address: ETH_REGISTRY,
  abi: ethRegistryAbi,
  functionName: "getOwner",
  args: [id],
});
if (owner.toLowerCase() !== deployer.address.toLowerCase())
  fail(`pata.eth is owned by ${owner}, not the deployer.`);
const registry = await pub.readContract({
  address: ETH_REGISTRY,
  abi: ethRegistryAbi,
  functionName: "getSubregistry",
  args: ["pata"],
});
const emancipated = await pub.readContract({
  address: registry,
  abi: userRegistryAbi,
  functionName: "isEmancipated",
});
if (!emancipated) fail(`pata.eth's registry ${registry} is not emancipated. Fix that first; don't lock.`);
const hStatus = await pub.readContract({
  address: registry,
  abi: userRegistryAbi,
  functionName: "getStatus",
  args: [BigInt(labelhash(household))],
});
if (hStatus !== 2) fail(`${household}.pata.eth isn't registered yet (status ${hStatus}).`);
const held = await pub.readContract({
  address: ETH_REGISTRY,
  abi: ethRegistryAbi,
  functionName: "roles",
  args: [id, deployer.address],
});
if ((held & LOCK) === 0n) {
  console.log("Already locked: the deployer holds no subregistry role on pata.");
  process.exit(0);
}

console.log(`pata.eth registry ${registry} (emancipated), ${household}.pata.eth registered.`);
try {
  const { request } = await pub.simulateContract({
    account: deployer,
    address: ETH_REGISTRY,
    abi: ethRegistryAbi,
    functionName: "revokeRoles",
    args: [id, LOCK, deployer.address],
  });
  if (!confirm) {
    console.log("Simulation ok. Nothing sent. Re-run with --confirm-irreversible to lock pata.eth for good.");
    process.exit(0);
  }
  const hash = await wallet.writeContract(request);
  console.log(`revokeRoles: ${hash}`);
  await pub.waitForTransactionReceipt({ hash });
} catch (err) {
  fail(`revokeRoles failed: ${safeRpcError(err)}`);
}
const after = await pub.readContract({
  address: ETH_REGISTRY,
  abi: ethRegistryAbi,
  functionName: "roles",
  args: [id, deployer.address],
});
console.log(
  (after & LOCK) === 0n
    ? "Locked: nobody can replace pata.eth's registry now."
    : "UNEXPECTED: the role is still held.",
);
