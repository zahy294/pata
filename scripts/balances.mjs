// node scripts/balances.mjs — the deployer's and relay's addresses and balances on Sepolia and Rabdi.
// Prints addresses only, never keys.
import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnv } from "./env-file.mjs";

const env = loadEnv();
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const arkivUrl = env.ARKIV_ACCESS_KEY ? `${env.ARKIV_RPC_URL}/${env.ARKIV_ACCESS_KEY}` : env.ARKIV_RPC_URL;
const arkivClient = createPublicClient({ transport: http(arkivUrl) });

for (const name of ["DEPLOYER_PRIVATE_KEY", "RELAY_PRIVATE_KEY"]) {
  const key = env[name];
  if (!key) {
    console.log(`${name}: missing`);
    continue;
  }
  const { address } = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
  const [eth, glm] = await Promise.all([
    sepoliaClient.getBalance({ address }),
    arkivClient.getBalance({ address }).catch(() => null),
  ]);
  console.log(
    `${name.replace("_PRIVATE_KEY", "").toLowerCase().padEnd(8)} ${address}  Sepolia ${formatEther(eth)} ETH  Rabdi ${glm === null ? "?" : formatEther(glm)} tGLM`,
  );
}
