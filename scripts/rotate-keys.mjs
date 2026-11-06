// node scripts/rotate-keys.mjs — makes new deployer and relay keys in .env.local and prints only addresses.
// Safety: refuses if either old wallet holds funds on Sepolia or Rabdi (move them first), and copies the
// old values to a dated .env.rotated-<date>.local file (git ignores *.local) so nothing is lost.
// Flag: --skip-arkiv-check  skip the Rabdi balance check if Arkiv's RPC is down (Sepolia is still checked).
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, formatEther, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ENV_LOCAL, loadEnv, readEnvFile, safeRpcError, toPrivateKey, writeEnvValues } from "./env-file.mjs";

const NAMES = ["DEPLOYER_PRIVATE_KEY", "RELAY_PRIVATE_KEY"];
const skipArkiv = process.argv.includes("--skip-arkiv-check");

function fail(message) {
  console.error(`\nStopped: ${message}\nNothing was changed.`);
  process.exit(1);
}

if (!fs.existsSync(ENV_LOCAL)) fail(".env.local doesn't exist. Copy .env.example to .env.local first.");

const env = loadEnv();
const raw = readEnvFile();
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const arkivClients = [
  env.ARKIV_ACCESS_KEY
    ? createPublicClient({ transport: http(`${env.ARKIV_RPC_URL}/${env.ARKIV_ACCESS_KEY}`) })
    : null,
  createPublicClient({ transport: http(env.ARKIV_RPC_URL) }), // keyless public endpoint as a fallback
].filter(Boolean);

async function arkivBalance(address) {
  let last;
  for (const client of arkivClients) {
    try {
      return await client.getBalance({ address });
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

// 1. Check the old wallets.
const old = {};
for (const name of NAMES) {
  if (!raw[name]) {
    console.log(`${name}: not set yet, a new one will be created.`);
    continue;
  }
  let address;
  try {
    address = privateKeyToAccount(toPrivateKey(name, raw[name])).address;
  } catch (err) {
    // A value that isn't a key can't control a wallet. Back it up as-is and replace it.
    console.log(`Warning: ${err.message} It will be backed up as-is and replaced.`);
    old[name] = { address: "(unreadable)", value: raw[name] };
    continue;
  }

  let eth;
  try {
    eth = await sepoliaClient.getBalance({ address });
  } catch (err) {
    fail(
      `couldn't read the Sepolia balance of ${address} (${safeRpcError(err)}). Check your internet, then retry.`,
    );
  }
  if (eth > 0n)
    fail(`the old ${name} wallet ${address} holds ${formatEther(eth)} Sepolia ETH. Move it out first.`);

  if (!skipArkiv) {
    let glm;
    try {
      glm = await arkivBalance(address);
    } catch (err) {
      fail(
        `couldn't read the Rabdi balance of ${address} (${safeRpcError(err)}). If you're sure it holds no tGLM, run again with --skip-arkiv-check.`,
      );
    }
    if (glm > 0n)
      fail(`the old ${name} wallet ${address} holds ${formatEther(glm)} tGLM on Rabdi. Move it out first.`);
  }
  old[name] = { address, value: raw[name] };
}

// 2. Back up the old values.
if (Object.keys(old).length) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(path.dirname(ENV_LOCAL), `.env.rotated-${stamp}.local`);
  fs.writeFileSync(
    backup,
    Object.entries(old)
      .map(([k, v]) => `${k}=${v.value}`)
      .join("\n") + "\n",
  );
  console.log(`Old keys copied to ${path.basename(backup)} (git ignores it). Delete it once you're sure.`);
}

// 3. Write the new keys and print addresses only.
const fresh = {};
for (const name of NAMES) fresh[name] = generatePrivateKey();
try {
  writeEnvValues(fresh);
} catch (err) {
  fail(
    `couldn't write .env.local (${err.code ?? err.name}). Is it open read-only or locked by another program?`,
  );
}

console.log("");
for (const name of NAMES) {
  const label = name.replace("_PRIVATE_KEY", "").toLowerCase();
  const before = old[name] ? old[name].address : "(none)";
  console.log(`${label.padEnd(8)} old ${before}  new ${privateKeyToAccount(fresh[name]).address}`);
}
console.log("\nDone. Fund the NEW addresses, then check with: node scripts/balances.mjs");
