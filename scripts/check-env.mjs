// node scripts/check-env.mjs — which names from .env.example are set in your .env.local.
// Prints "set" or "missing" only, never a value.
import { ENV_EXAMPLE, readEnvFile } from "./env-file.mjs";

const example = readEnvFile(ENV_EXAMPLE);
const local = readEnvFile();
const ownerOnly = new Set([
  "DEPLOYER_PRIVATE_KEY",
  "RELAY_PRIVATE_KEY",
  "ANTHROPIC_API_KEY",
  "SARVAM_API_KEY",
  "PINATA_JWT",
  "ETHERSCAN_API_KEY",
]);

for (const name of Object.keys(example)) {
  const state = local[name] ? "set" : "missing";
  const note = ownerOnly.has(name) ? " (owner only)" : "";
  console.log(`${state.padEnd(8)} ${name}${note}`);
}
