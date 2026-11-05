// node scripts/rotate-keys.mjs — makes new deployer and relay keys in .env.local and prints only addresses.
// Safety: refuses if either old wallet holds funds on Sepolia or Rabdi (move them first), and copies the
// old values to a dated .env.rotated-<date>.local file (git ignores *.local) so nothing is lost.
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ENV_LOCAL, loadEnv, writeEnvValues } from "./env-file.mjs";

const NAMES = ["DEPLOYER_PRIVATE_KEY", "RELAY_PRIVATE_KEY"];
const env = loadEnv();
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const arkivUrl = env.ARKIV_ACCESS_KEY ? `${env.ARKIV_RPC_URL}/${env.ARKIV_ACCESS_KEY}` : env.ARKIV_RPC_URL;
const arkivClient = createPublicClient({ transport: http(arkivUrl) });

const old = {};
for (const name of NAMES) {
  if (!env[name]) continue;
  const { address } = privateKeyToAccount(env[name].startsWith("0x") ? env[name] : `0x${env[name]}`);
  const [eth, glm] = await Promise.all([
    sepoliaClient.getBalance({ address }),
    arkivClient.getBalance({ address }),
  ]);
  if (eth > 0n || glm > 0n) {
    console.error(`Refusing: the old ${name} wallet ${address} still holds funds. Move them first.`);
    process.exit(1);
  }
  old[name] = { address, value: env[name] };
}

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

const fresh = {};
for (const name of NAMES) fresh[name] = generatePrivateKey();
writeEnvValues(fresh);

for (const name of NAMES) {
  const label = name.replace("_PRIVATE_KEY", "").toLowerCase();
  const before = old[name] ? old[name].address : "(none)";
  console.log(`${label.padEnd(8)} old ${before}  new ${privateKeyToAccount(fresh[name]).address}`);
}
