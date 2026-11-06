import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  createPublicClient,
  http,
  labelhash,
  parseAbi,
  BaseError,
  ContractFunctionRevertedError,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { userRegistryAbi } from "./abis";

const file = "scripts/dev/grants-smoke-results.json";
it.skipIf(!existsSync(file))(
  "observes the recorded short grant expired and unregister reverting LabelExpired, without sending a transaction",
  async () => {
    try {
      const prior = JSON.parse(readFileSync(file, "utf8"));
      const client = createPublicClient({
        chain: sepolia,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
      });
      const registry: Hex = prior.contracts.grantRegistry;
      const label: string = prior.shortGrant.label;
      const expiry: number = prior.shortGrant.expiry;
      let observedTimestamp = 0;
      await expect
        .poll(
          async () => {
            observedTimestamp = Number((await client.getBlock({ blockTag: "latest" })).timestamp);
            const status = await client.readContract({
              address: registry,
              abi: userRegistryAbi,
              functionName: "getStatus",
              args: [BigInt(labelhash(label))],
            });
            return observedTimestamp >= expiry && status === 0;
          },
          { timeout: 90000, interval: 2000 },
        )
        .toBe(true);
      let denied: string | undefined;
      try {
        await client.simulateContract({
          address: registry,
          abi: [...userRegistryAbi, ...parseAbi(["error LabelExpired(uint256 tokenId)"])],
          functionName: "unregister",
          args: [BigInt(labelhash(label))],
          account: prior.household,
        });
      } catch (error) {
        const reverted =
          error instanceof BaseError
            ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
            : undefined;
        denied = reverted instanceof ContractFunctionRevertedError ? reverted.data?.errorName : undefined;
      }
      expect(denied).toBe("LabelExpired");
      const mintReceipt = prior.receipts.find(
        (receipt: { stage: string }) => receipt.stage === "twenty-second grant mint",
      );
      const receipt = await client.getTransactionReceipt({ hash: mintReceipt.hash });
      const mintBlock = await client.getBlock({ blockNumber: receipt.blockNumber });
      writeFileSync(
        "scripts/dev/grants-expiry-results.json",
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            household: prior.household,
            registry,
            label,
            expiry,
            observedTimestamp,
            status: 0,
            expiredUnregister: denied,
            mintBlock: receipt.blockNumber.toString(),
            mintTimestamp: Number(mintBlock.timestamp),
            secondsRemainingAtInclusion: expiry - Number(mintBlock.timestamp),
            result: "passed",
          },
          null,
          2,
        ),
      );
    } catch {
      throw new Error("Read-only expiry verification failed; no transaction was sent");
    }
  },
  120000,
);
