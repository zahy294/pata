// node scripts/fund-relay.mjs [amount in ETH, default 0.03] [--dry-run]   (owner only)
// Sends Sepolia ETH from the deployer to the relay. The relay pays for household-name registrations
// and household top-ups (P0-6), so it needs Sepolia ETH as well as tGLM. Prints addresses and the tx hash only.
import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnv, safeRpcError, toPrivateKey } from "./env-file.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const amountArg = args.find((a) => !a.startsWith("--")) ?? "0.03";
const stop = (m) => {
  console.error(`Stopped: ${m}\nNothing was sent.`);
  process.exit(1);
};

let value;
try {
  value = parseEther(amountArg);
} catch {
  stop(`"${amountArg}" isn't an ETH amount. Example: node scripts/fund-relay.mjs 0.03`);
}
if (value <= 0n) stop("The amount must be more than 0.");

const env = loadEnv();
let deployer, relay;
try {
  deployer = privateKeyToAccount(toPrivateKey("DEPLOYER_PRIVATE_KEY", env.DEPLOYER_PRIVATE_KEY ?? ""));
  relay = privateKeyToAccount(toPrivateKey("RELAY_PRIVATE_KEY", env.RELAY_PRIVATE_KEY ?? ""));
} catch (err) {
  stop(err.message);
}

const pub = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const wallet = createWalletClient({
  account: deployer,
  chain: sepolia,
  transport: http(env.SEPOLIA_RPC_URL),
});
const balances = async () =>
  Promise.all([pub.getBalance({ address: deployer.address }), pub.getBalance({ address: relay.address })]);

let [d, r] = [0n, 0n];
try {
  [d, r] = await balances();
} catch (err) {
  stop(`couldn't read balances (${safeRpcError(err)}).`);
}
console.log(`deployer ${deployer.address}  ${formatEther(d)} ETH`);
console.log(`relay    ${relay.address}  ${formatEther(r)} ETH`);

const feeMargin = parseEther("0.0005");
if (d < value + feeMargin) {
  stop(
    `the deployer has ${formatEther(d)} ETH; sending ${formatEther(value)} needs a little more for the fee.`,
  );
}
if (dry) {
  console.log(`\n[dry-run] would send ${formatEther(value)} ETH from the deployer to the relay.`);
  process.exit(0);
}

try {
  const hash = await wallet.sendTransaction({ to: relay.address, value });
  console.log(`\nsent ${formatEther(value)} ETH: ${hash}`);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") stop(`the transfer reverted (tx ${hash}).`);
} catch (err) {
  stop(`the transfer failed (${safeRpcError(err)}).`);
}

// Public RPC nodes can lag a block behind; give the balance read a moment.
await new Promise((resolve) => setTimeout(resolve, 3000));
[d, r] = await balances();
console.log(`deployer now ${formatEther(d)} ETH, relay now ${formatEther(r)} ETH`);
