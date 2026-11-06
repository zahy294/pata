// node scripts/register-parent-names.mjs [--dry-run]   (P0-2, owner only)
// Deploys pata.eth's own UserRegistry (emancipated), then registers pata.eth (5 years) and digipin.eth
// (2 years) on Sepolia's ENSv2 with free MockUSDC. Idempotent: re-running skips finished steps.
// Reads DEPLOYER_PRIVATE_KEY and RELAY_PRIVATE_KEY from .env.local; prints addresses and tx hashes only.
// Signatures checked against ensdomains/contracts-v2@07e55a05 contracts/deployments/sepolia/*.json.
import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  keccak256,
  labelhash,
  namehash,
  parseAbi,
  toHex,
  zeroAddress,
  zeroHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnv, safeRpcError, toPrivateKey } from "./env-file.mjs";

const DRY = process.argv.includes("--dry-run");

// ---- Addresses (docs/research/ens-v2.md, Values to copy) ----
const ETH_REGISTRY = "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4";
const ETH_REGISTRAR = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";
const MOCK_USDC = "0x240b0316df57887dbbe58b586508b19e633a14aa";
const FACTORY = "0xda70306c98e97ece36f997a21368e53298572991";
const USER_REGISTRY_IMPL = "0x9bd8a88719068d09ecee662f36c0e3856708366a";

// ---- Roles (mirror src/lib/ens/roles.ts) ----
const admin = (r) => r << 128n;
const ROLE_REGISTRAR = 1n << 0n;
const ROLE_RENEW = 1n << 16n;
const OPERATOR_ROLES = ROLE_REGISTRAR | admin(ROLE_REGISTRAR) | ROLE_RENEW | admin(ROLE_RENEW);

const YEAR = 365n * 24n * 60n * 60n;
const NAMES = [
  { label: "pata", years: 5n, usesPataRegistry: true },
  { label: "digipin", years: 2n, usesPataRegistry: false },
];

const registrarAbi = parseAbi([
  "function MIN_COMMITMENT_AGE() view returns (uint64)",
  "function isAvailable(string label) view returns (bool)",
  "function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function commitmentAt(bytes32 commitment) view returns (uint64)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)",
]);
const ethRegistryAbi = parseAbi([
  "function getStatus(uint256 anyId) view returns (uint8)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function getSubregistry(string label) view returns (address)",
]);
const usdcAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const factoryAbi = parseAbi([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
  "function predictProxyAddress(address deployer, uint256 salt) view returns (address)",
  "function verifyContract(address proxy) view returns (address)",
]);
const userRegistryAbi = parseAbi([
  "struct RoleGrant { address account; uint256 roleBitmap; }",
  "function initialize(RoleGrant[] grants)",
  "function isEmancipated() view returns (bool)",
]);

function stop(message) {
  console.error(`\nStopped: ${message}`);
  process.exit(1);
}

function revertReason(err) {
  let e = err;
  while (e) {
    if (e.data?.errorName) return `${e.data.errorName}(${(e.data.args ?? []).map(String).join(", ")})`;
    e = e.cause;
  }
  return safeRpcError(err);
}

// ---- Setup ----
const env = loadEnv();
if (!env.DEPLOYER_PRIVATE_KEY || !env.RELAY_PRIVATE_KEY)
  stop("DEPLOYER_PRIVATE_KEY and RELAY_PRIVATE_KEY must be set.");
let deployer, relay;
try {
  deployer = privateKeyToAccount(toPrivateKey("DEPLOYER_PRIVATE_KEY", env.DEPLOYER_PRIVATE_KEY));
  relay = privateKeyToAccount(toPrivateKey("RELAY_PRIVATE_KEY", env.RELAY_PRIVATE_KEY));
} catch (err) {
  stop(err.message);
}

const pub = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const wallet = createWalletClient({
  account: deployer,
  chain: sepolia,
  transport: http(env.SEPOLIA_RPC_URL),
});
const read = (address, abi, functionName, args = []) =>
  pub.readContract({ address, abi, functionName, args });

async function send(what, address, abi, functionName, args) {
  try {
    const { request } = await pub.simulateContract({ account: deployer, address, abi, functionName, args });
    if (DRY) {
      console.log(`  [dry-run] ${what}: simulation ok, not sent`);
      return null;
    }
    const hash = await wallet.writeContract(request);
    console.log(`  ${what}: ${hash}`);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") stop(`${what} reverted (tx ${hash}).`);
    return receipt;
  } catch (err) {
    stop(`${what} failed: ${revertReason(err)}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retries a read that a lagging RPC node may not answer yet (e.g. a block it hasn't seen). */
async function retry(fn, tries = 10, delayMs = 3000) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries) throw err;
      await sleep(delayMs);
    }
  }
}

console.log(DRY ? "DRY RUN: nothing will be sent.\n" : "");
console.log(
  `deployer ${deployer.address}  ${formatEther(await pub.getBalance({ address: deployer.address }))} ETH`,
);
console.log(`relay    ${relay.address}`);

// ---- 1. pata.eth's own registry ----
console.log("\n1. pata.eth's registry");
const salt = BigInt(
  keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
      [keccak256(toHex("UserRegistry")), namehash("pata.eth"), 0n],
    ),
  ),
);
const pataRegistry = await read(FACTORY, factoryAbi, "predictProxyAddress", [deployer.address, salt]);
const existing = await pub.getCode({ address: pataRegistry });
if (existing && existing !== "0x") {
  console.log(`  already deployed at ${pataRegistry}`);
} else {
  const initData = encodeFunctionData({
    abi: userRegistryAbi,
    functionName: "initialize",
    args: [
      [
        { account: relay.address, roleBitmap: OPERATOR_ROLES },
        { account: deployer.address, roleBitmap: OPERATOR_ROLES },
      ],
    ],
  });
  await send("deployProxy", FACTORY, factoryAbi, "deployProxy", [USER_REGISTRY_IMPL, salt, initData]);
}
console.log(`  address ${pataRegistry}`);

// ---- 2 and 3. Names ----
const minAge = await read(ETH_REGISTRAR, registrarAbi, "MIN_COMMITMENT_AGE");

for (const { label, years, usesPataRegistry } of NAMES) {
  console.log(`\n2. ${label}.eth`);
  const id = BigInt(labelhash(label));
  const status = await read(ETH_REGISTRY, ethRegistryAbi, "getStatus", [id]);
  if (status === 2) {
    const owner = await read(ETH_REGISTRY, ethRegistryAbi, "getOwner", [id]);
    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("  already registered to the deployer, skipping");
      continue;
    }
    stop(`${label}.eth is registered to someone else (${owner}). Use the fallbacks in shared/constants.ts.`);
  }
  if (!(await read(ETH_REGISTRAR, registrarAbi, "isAvailable", [label])))
    stop(`${label}.eth isn't available.`);

  const duration = years * YEAR;
  const subregistry = usesPataRegistry ? pataRegistry : zeroAddress;
  const [base, premium] = await read(ETH_REGISTRAR, registrarAbi, "getRegisterPrice", [
    label,
    duration,
    MOCK_USDC,
  ]);
  const price = base + premium;
  console.log(`  ${years} years for ${formatUnits(price, 6)} MockUSDC`);

  const balance = await read(MOCK_USDC, usdcAbi, "balanceOf", [deployer.address]);
  if (balance < price)
    await send("mint MockUSDC", MOCK_USDC, usdcAbi, "mint", [deployer.address, price - balance + 1_000_000n]);
  const allowance = await read(MOCK_USDC, usdcAbi, "allowance", [deployer.address, ETH_REGISTRAR]);
  if (allowance < price)
    await send("approve MockUSDC", MOCK_USDC, usdcAbi, "approve", [ETH_REGISTRAR, price]);

  const secret = toHex(randomBytes(32));
  const commitment = await read(ETH_REGISTRAR, registrarAbi, "makeCommitment", [
    label,
    deployer.address,
    secret,
    subregistry,
    zeroAddress,
    duration,
    zeroHash,
  ]);
  const commitReceipt = await send("commit", ETH_REGISTRAR, registrarAbi, "commit", [commitment]);
  if (DRY) {
    console.log("  [dry-run] would wait for the commitment to age, then register");
    continue;
  }

  // Public RPCs are load-balanced: a node that hasn't seen the commit's block yet returns 0 for
  // commitmentAt, and the registrar reports a missing commitment as CommitmentTooOld. So take the commit
  // time from the receipt's own block, and wait until the node we're talking to has seen it AND it's aged.
  const { timestamp: committedAt } = await retry(() =>
    pub.getBlock({ blockNumber: commitReceipt.blockNumber }),
  );
  const readyAt = committedAt + minAge;
  process.stdout.write(`  waiting ${minAge} s for the commitment to age`);
  for (;;) {
    const [{ timestamp }, seen] = await Promise.all([
      pub.getBlock(),
      read(ETH_REGISTRAR, registrarAbi, "commitmentAt", [commitment]),
    ]);
    if (timestamp > readyAt && seen === committedAt) break;
    process.stdout.write(".");
    await sleep(6000);
  }
  console.log("");

  // A later call can still land on a lagging node, so retry the commitment errors a few times.
  const registerArgs = [
    label,
    deployer.address,
    secret,
    subregistry,
    zeroAddress,
    duration,
    MOCK_USDC,
    zeroHash,
  ];
  for (let attempt = 1; ; attempt++) {
    try {
      const { request } = await pub.simulateContract({
        account: deployer,
        address: ETH_REGISTRAR,
        abi: registrarAbi,
        functionName: "register",
        args: registerArgs,
      });
      const hash = await wallet.writeContract(request);
      console.log(`  register: ${hash}`);
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") stop(`register reverted (tx ${hash}).`);
      break;
    } catch (err) {
      const reason = revertReason(err);
      if (attempt < 6 && /^Commitment(TooNew|TooOld)/.test(reason)) {
        console.log(`  register not ready yet (${reason.split("(")[0]}), retrying in 12 s`);
        await sleep(12000);
        continue;
      }
      stop(`register failed: ${reason}`);
    }
  }
}

// ---- 4. Checks ----
if (!DRY) {
  console.log("\n4. Checks");
  const impl = await read(FACTORY, factoryAbi, "verifyContract", [pataRegistry]);
  const emancipated = await read(pataRegistry, userRegistryAbi, "isEmancipated");
  const pointer = await read(ETH_REGISTRY, ethRegistryAbi, "getSubregistry", ["pata"]);
  console.log(
    `  verifyContract(pata registry) = ${impl} ${impl.toLowerCase() === USER_REGISTRY_IMPL ? "(UserRegistryImpl, ok)" : "(UNEXPECTED)"}`,
  );
  console.log(`  isEmancipated() = ${emancipated}`);
  console.log(
    `  ETHRegistry subregistry of pata = ${pointer} ${pointer.toLowerCase() === pataRegistry.toLowerCase() ? "(ok)" : "(MISMATCH)"}`,
  );
  for (const { label } of NAMES) {
    console.log(
      `  ${label}.eth status ${await read(ETH_REGISTRY, ethRegistryAbi, "getStatus", [BigInt(labelhash(label))])} (2 = registered)`,
    );
  }
  console.log(`\nPost in the team chat:\n  NEXT_PUBLIC_PATA_REGISTRY=${pataRegistry}`);
  console.log(`And set PATA_REGISTRY_ADDRESS to the same value in server/wrangler.jsonc.`);
}
