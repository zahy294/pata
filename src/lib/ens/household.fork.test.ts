// Opt-in real Sepolia test, excluded from npm run check. Owner: blockchain.
// A Node-only external RPC adapter exercises the real household module; app transports are unchanged.
// Run with household.fork.config.mts and Node's --env-file=.env.local.
import { writeFileSync, mkdirSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  encodeFunctionData,
  formatEther,
  http,
  namehash,
  parseAbi,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { deriveHouseholdKeys, newRandomRoot } from "../keys";
import { deployHouseholdContracts, setLocality } from "./household";
import { permissionedResolverAbi } from "./abis";
import { dnsEncode } from "./names";
import { ENS } from "../../../shared/constants";

const evidence = vi.hoisted(() => ({
  receipts: [] as { transactionHash: string; gasUsed: string; status: string }[],
}));
vi.mock("../rpc", async () => {
  const { createPublicClient, createWalletClient, http } = await import("viem");
  const { sepolia } = await import("viem/chains");
  const client = createPublicClient({
    chain: sepolia,
    ccipRead: false,
    transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
      retryCount: 0,
    }),
  });
  return {
    sepoliaPublicClient: () => ({
      ...client,
      waitForTransactionReceipt: async (args: { hash: `0x${string}` }) => {
        const receipt = await client.waitForTransactionReceipt(args);
        evidence.receipts.push({
          transactionHash: receipt.transactionHash,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
        });
        return receipt;
      },
    }),
    sepoliaWalletClient: (account: Parameters<typeof createWalletClient>[0]["account"]) =>
      createWalletClient({
        chain: sepolia,
        account,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
      }),
  };
});

it.skipIf(!process.env.DEPLOYER_PRIVATE_KEY)(
  "deploys a funded throwaway household and verifies its public locality",
  async () => {
    let stage = "preflight";
    const result: Record<string, unknown> = {
      checkedAt: new Date().toISOString(),
      registration: "pending owner /register; not attempted",
    };
    try {
      const client = createPublicClient({
        chain: sepolia,
        ccipRead: false,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
      });
      if ((await client.getChainId()) !== 11155111) throw new Error("Wrong chain");
      const raw = process.env.DEPLOYER_PRIVATE_KEY!;
      const funder = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);
      const balance = await client.getBalance({ address: funder.address });
      result.developmentWallet = funder.address;
      result.developmentBalanceEth = formatEther(balance);
      if (balance < parseEther("0.0002")) throw new Error("Insufficient test funds");
      for (const address of [ENS.verifiableFactory, ENS.permissionedResolverImpl, ENS.userRegistryImpl]) {
        if (!(await client.getCode({ address }))) throw new Error("Missing deployed ENS implementation");
      }
      const keys = await deriveHouseholdKeys(newRandomRoot());
      const fullName = `test-${keys.address.slice(2, 10).toLowerCase()}.pata.eth`;
      result.household = keys.address;
      result.householdName = fullName;
      stage = "funding";
      const wallet = createWalletClient({
        chain: sepolia,
        account: funder,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
      });
      const fundingHash = await wallet.sendTransaction({ to: keys.address, value: parseEther("0.0001") });
      const funded = await client.waitForTransactionReceipt({ hash: fundingHash });
      if (funded.status !== "success") throw new Error("Funding failed");
      result.fundingHash = fundingHash;
      stage = "household deployments";
      const contracts = await deployHouseholdContracts(keys, fullName, {
        name: "Dharavi",
        pinCode: "400017",
      });
      result.contracts = contracts;
      const textAbi = parseAbi(["function text(bytes32 node, string key) view returns (string)"]);
      async function resolverText(key: string): Promise<string> {
        const encoded = await client.readContract({
          address: contracts.resolver,
          abi: permissionedResolverAbi,
          functionName: "resolve",
          args: [
            dnsEncode(fullName),
            encodeFunctionData({ abi: textAbi, functionName: "text", args: [namehash(fullName), key] }),
          ],
        });
        return decodeAbiParameters([{ type: "string" }], encoded)[0];
      }
      stage = "initialized locality";
      // Public RPC nodes can lag the node that returned the mined receipt.
      const polling = { timeout: 30_000, interval: 1_000 };
      await expect.poll(() => resolverText("location"), polling).toBe("Dharavi, 400017");
      await expect.poll(() => resolverText("eth.pata.pincode"), polling).toBe("400017");
      stage = "grant registry emancipation";
      await expect
        .poll(
          () =>
            client.readContract({
              address: contracts.grantRegistry,
              abi: parseAbi(["function isEmancipated() view returns (bool)"]),
              functionName: "isEmancipated",
            }),
          polling,
        )
        .toBe(false);
      stage = "locality update";
      await setLocality(keys, contracts, fullName, { name: "BKC", pinCode: "400051" });
      await expect.poll(() => resolverText("location"), polling).toBe("BKC, 400051");
      await expect.poll(() => resolverText("eth.pata.pincode"), polling).toBe("400051");
      result.status = "passed";
    } catch {
      result.status = "failed";
      result.stage = stage;
      // Never let a viem error, raw transaction, URL or private key enter test output.
      throw new Error(
        `Sepolia household smoke test failed at ${stage}; inspect the public-only evidence file`,
      );
    } finally {
      result.receipts = evidence.receipts;
      mkdirSync("scripts/dev", { recursive: true });
      writeFileSync("scripts/dev/ens-smoke-results.json", JSON.stringify(result, null, 2));
    }
  },
  180_000,
);
