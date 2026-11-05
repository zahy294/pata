// node scripts/check-names.mjs — are pata.eth, digipin.eth and the fallbacks still free on Sepolia's ENSv2?
// getStatus(labelhash) on the ETHRegistry: 0 available, 1 reserved, 2 registered (docs/research/ens-v2.md).
import { createPublicClient, http, labelhash, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { loadEnv } from "./env-file.mjs";

const ETH_REGISTRY = "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4";
const abi = parseAbi(["function getStatus(uint256 anyId) view returns (uint8)"]);
const labels = ["pata", "digipin", "pata-in", "digipin-grid", "patanet", "digipin-in"];
const names = ["available", "reserved", "registered"];

const env = loadEnv();
const client = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });

for (const label of labels) {
  const status = await client.readContract({
    address: ETH_REGISTRY,
    abi,
    functionName: "getStatus",
    args: [BigInt(labelhash(label))],
  });
  console.log(`${(label + ".eth").padEnd(18)} ${names[status] ?? status}`);
}
