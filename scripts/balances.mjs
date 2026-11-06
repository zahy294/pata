// node scripts/balances.mjs — the deployer's and relay's addresses and balances on Sepolia and Rabdi.
// Prints addresses only, never keys.
import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnv, safeRpcError, toPrivateKey } from "./env-file.mjs";

const env = loadEnv();
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const arkivUrl = env.ARKIV_ACCESS_KEY ? `${env.ARKIV_RPC_URL}/${env.ARKIV_ACCESS_KEY}` : env.ARKIV_RPC_URL;
const arkivClient = createPublicClient({ transport: http(arkivUrl) });

for (const name of ["DEPLOYER_PRIVATE_KEY", "RELAY_PRIVATE_KEY"]) {
  const label = name.replace("_PRIVATE_KEY", "").toLowerCase().padEnd(8);
  if (!env[name]) {
    console.log(`${label} ${name} is missing in .env.local`);
    continue;
  }
  let address;
  try {
    address = privateKeyToAccount(toPrivateKey(name, env[name])).address;
  } catch (err) {
    console.log(`${label} ${err.message}`);
    continue;
  }
  const eth = await sepoliaClient.getBalance({ address }).then(formatEther, (e) => `? (${safeRpcError(e)})`);
  const glm = await arkivClient.getBalance({ address }).then(formatEther, (e) => `? (${safeRpcError(e)})`);
  console.log(`${label} ${address}  Sepolia ${eth} ETH  Rabdi ${glm} tGLM`);
}
