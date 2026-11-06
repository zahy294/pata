// Opt-in testnet checks. Keys exist only in memory; evidence contains public data only.
// node --env-file=.env.local node_modules/vitest/vitest.mjs run --config src/lib/ens/grants.fork.config.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseAbi,
  labelhash,
  hexToBytes,
  BaseError,
  ContractFunctionRevertedError,
  zeroAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createPublicClient as createArkivPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { deriveHouseholdKeys, newRandomRoot, newSessionKey, deriveGrantIdentity } from "../keys";
import { deployHouseholdContracts } from "./household";
import { mintGrant, sepoliaNow } from "./grants";
import { createGrantBatch } from "../arkiv";
import { grantSchema, historySchema } from "../arkiv/schemas";
import { userRegistryAbi, permissionedResolverAbi } from "./abis";
import { dnsEncode } from "./names";
import { openJson } from "../seal";
import type { GrantPayload, HistoryEntry } from "../../../shared/domain";

const evidence = vi.hoisted(() => ({
  stage: "preflight",
  receipts: [] as { stage: string; hash: Hex; gasUsed: string; status: string }[],
}));
vi.mock("../rpc", async () => {
  const viem = await import("viem");
  const sdk = await import("@arkiv-network/sdk");
  const { sepolia } = await import("viem/chains");
  const { rabdi } = await import("@arkiv-network/sdk/chains");
  const transport = () =>
    viem.http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
      retryCount: 0,
    });
  const client = viem.createPublicClient({
    chain: sepolia,
    ccipRead: false,
    transport: transport(),
    pollingInterval: 1000,
  });
  return {
    sepoliaPublicClient: () => ({
      ...client,
      waitForTransactionReceipt: async (args: { hash: Hex }) => {
        const receipt = await client.waitForTransactionReceipt(args);
        evidence.receipts.push({
          stage: evidence.stage,
          hash: receipt.transactionHash,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
        });
        return receipt;
      },
    }),
    sepoliaWalletClient: (account: Parameters<typeof viem.createWalletClient>[0]["account"]) =>
      viem.createWalletClient({ chain: sepolia, account, transport: transport() }),
    arkivWalletClient: (account: Parameters<typeof sdk.createWalletClient>[0]["account"]) => {
      const wallet = sdk.createWalletClient({
        chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }),
        account,
        transport: viem.http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      return {
        ...wallet,
        executeBatch: async (...args: Parameters<typeof wallet.executeBatch>) => {
          const result = await wallet.executeBatch(...args);
          evidence.receipts.push({
            stage: evidence.stage,
            hash: result.txHash,
            gasUsed: (await wallet.waitForTransactionReceipt({ hash: result.txHash })).gasUsed.toString(),
            status: "success",
          });
          return result;
        },
      };
    },
  };
});

const permissionErrors = parseAbi([
  "error EACUnauthorizedAccountRoles(uint256 resource,uint256 roleBitmap,address account)",
]);
const registryAbi = [
  ...userRegistryAbi,
  ...permissionErrors,
  ...parseAbi([
    "function safeTransferFrom(address from,address to,uint256 id,uint256 value,bytes data)",
    "error TransferDisallowed(uint256 tokenId,address from)",
    "error TransferUnsafeUntilRegistryIsEmancipated()",
    "error LabelExpired(uint256 tokenId)",
  ]),
];
function errorName(error: unknown): string | undefined {
  const reverted =
    error instanceof BaseError
      ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
      : undefined;
  return reverted instanceof ContractFunctionRevertedError ? reverted.data?.errorName : undefined;
}
async function rejectsWith(operation: () => Promise<unknown>, expected: string): Promise<void> {
  let found: string | undefined;
  try {
    await operation();
  } catch (error) {
    found = errorName(error);
  }
  expect(found).toBe(expected);
}

it.skipIf(!process.env.DEPLOYER_PRIVATE_KEY)(
  "verifies live grant batch, revocation, permission denial and twenty-second expiry",
  async () => {
    const result: Record<string, unknown> = {
      checkedAt: new Date().toISOString(),
      transport: "Node-only direct Sepolia/Rabdi test adapters",
      status: "running",
    };
    let session: Uint8Array | null = null;
    let shortSession: Uint8Array | null = null;
    const persist = () => {
      mkdirSync("scripts/dev", { recursive: true });
      writeFileSync(
        "scripts/dev/grants-smoke-results.json",
        JSON.stringify({ ...result, stage: evidence.stage, receipts: evidence.receipts }, null, 2),
      );
    };
    const stage = (name: string) => {
      evidence.stage = name;
      persist();
    };
    try {
      stage("preflight");
      const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
      const client = createPublicClient({
        chain: sepolia,
        ccipRead: false,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
        pollingInterval: 1000,
      });
      const arkiv = createArkivPublicClient({
        chain,
        transport: http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      expect(await client.getChainId()).toBe(11155111);
      expect(await arkiv.getChainId()).toBe(7794095);
      const raw = process.env.DEPLOYER_PRIVATE_KEY!;
      const funder = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
      if (
        (await client.getBalance({ address: funder.address })) < parseEther("0.0002") ||
        (await arkiv.getBalance({ address: funder.address })) < parseEther("0.11")
      )
        throw new Error("Insufficient development funds");
      const root = newRandomRoot();
      const keys = await deriveHouseholdKeys(root);
      root.fill(0);
      result.household = keys.address;
      const fullName = `grant-test-${keys.address.slice(2, 10).toLowerCase()}.pata.eth`;
      result.name = fullName;
      result.registration = "not registered; isolated registry tests";
      stage("funding");
      const devWallet = createWalletClient({
        chain: sepolia,
        account: funder,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
      });
      const fundingHash = await devWallet.sendTransaction({ to: keys.address, value: parseEther("0.0001") });
      expect((await client.waitForTransactionReceipt({ hash: fundingHash })).status).toBe("success");
      result.sepoliaFunding = fundingHash;
      const arkivDevWallet = createWalletClient({
        chain,
        account: funder,
        transport: http(undefined, { retryCount: 0 }),
      });
      const arkivFundingHash = await arkivDevWallet.sendTransaction({
        to: keys.address,
        value: parseEther("0.1"),
      });
      expect((await arkiv.waitForTransactionReceipt({ hash: arkivFundingHash })).status).toBe("success");
      result.arkivFunding = arkivFundingHash;
      stage("household deployments");
      const contracts = await deployHouseholdContracts(keys, fullName, {
        name: "Test locality",
        pinCode: "110001",
      });
      result.contracts = contracts;
      session = newSessionKey();
      const identity = await deriveGrantIdentity(session);
      const now = await sepoliaNow();
      const longEnd = now + 180;
      const payload: GrantPayload = {
        version: 1,
        requester: { displayName: "Test courier" },
        purpose: "Permission smoke test",
        language: "en",
        digipin: "39J49LL8T4",
        pin: { lat: 28.622788, lon: 77.213033 },
        locality: { name: "Test locality", pinCode: "110001" },
        roomNumber: "Synthetic room",
        writtenAddress: "Synthetic test door",
        directions: "Synthetic test directions",
        audioMp3Base64: "AAEC/w==",
        grantEnd: longEnd,
      };
      const issued: HistoryEntry = {
        version: 1,
        kind: "issued",
        grantLabel: identity.label,
        requester: payload.requester,
        purpose: payload.purpose,
        at: now,
        grantEnd: longEnd,
      };
      stage("Arkiv grant batch");
      const batch = await createGrantBatch(keys, identity.sealKey, payload, issued);
      result.batch = batch;
      await expect
        .poll(
          async () => {
            const row = await arkiv.getEntity(batch.payloadKey, grantSchema);
            expect(row.$owner.toLowerCase()).toBe(keys.address.toLowerCase());
            expect(await openJson(keys.sealKey, hexToBytes(row.index.value))).toMatchObject({
              grantLabel: identity.label,
              grantEnd: longEnd,
            });
            return openJson(identity.sealKey, hexToBytes(row.payload.value));
          },
          { timeout: 30000, interval: 1000 },
        )
        .toEqual(payload);
      const history = await arkiv.getEntity(batch.historyKey, historySchema);
      expect(history.$creationFlags.readonly).toBe(true);
      expect(await openJson(keys.sealKey, hexToBytes(history.sealed.value))).toEqual(issued);
      result.batchReadback = "passed: payload, household index and readonly history";
      stage("long-lived grant mint");
      await mintGrant(keys, contracts, identity.label, identity.owner.address, longEnd);
      const state = await client.readContract({
        address: contracts.grantRegistry,
        abi: userRegistryAbi,
        functionName: "getState",
        args: [BigInt(labelhash(identity.label))],
      });
      expect(state.status).toBe(2);
      expect(state.latestOwner.toLowerCase()).toBe(identity.owner.address.toLowerCase());
      stage("grant owner permission checks");
      await rejectsWith(
        () =>
          client.simulateContract({
            address: contracts.grantRegistry,
            abi: registryAbi,
            functionName: "register",
            args: ["child", identity.owner.address, zeroAddress, zeroAddress, 0n, BigInt(longEnd)],
            account: identity.owner,
          }),
        "EACUnauthorizedAccountRoles",
      );
      await rejectsWith(
        () =>
          client.simulateContract({
            address: contracts.grantRegistry,
            abi: registryAbi,
            functionName: "setSubregistry",
            args: [BigInt(labelhash(identity.label)), contracts.grantRegistry],
            account: identity.owner,
          }),
        "EACUnauthorizedAccountRoles",
      );
      await rejectsWith(
        () =>
          client.simulateContract({
            address: contracts.resolver,
            abi: [...permissionedResolverAbi, ...permissionErrors],
            functionName: "setText",
            args: [dnsEncode(`${identity.label}.${fullName}`), "location", "Unauthorized"],
            account: identity.owner,
          }),
        "EACUnauthorizedAccountRoles",
      );
      await rejectsWith(
        () =>
          client.simulateContract({
            address: contracts.grantRegistry,
            abi: registryAbi,
            functionName: "safeTransferFrom",
            args: [identity.owner.address, keys.address, state.tokenId, 1n, "0x"],
            account: identity.owner,
          }),
        "TransferUnsafeUntilRegistryIsEmancipated",
      );
      result.permissions =
        "subname registration, subregistry change, record write and transfer all denied with decoded errors";
      result.transferRevert = "TransferUnsafeUntilRegistryIsEmancipated";
      stage("live grant revocation");
      const wallet = createWalletClient({
        chain: sepolia,
        account: keys.account,
        transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 0,
        }),
      });
      const revokeHash = await wallet.writeContract({
        address: contracts.grantRegistry,
        abi: userRegistryAbi,
        functionName: "unregister",
        args: [BigInt(labelhash(identity.label))],
      });
      const revoked = await client.waitForTransactionReceipt({ hash: revokeHash });
      expect(revoked.status).toBe("success");
      evidence.receipts.push({
        stage: evidence.stage,
        hash: revokeHash,
        gasUsed: revoked.gasUsed.toString(),
        status: revoked.status,
      });
      expect(
        await client.readContract({
          address: contracts.grantRegistry,
          abi: userRegistryAbi,
          functionName: "getStatus",
          args: [BigInt(labelhash(identity.label))],
        }),
      ).toBe(0);
      result.liveUnregister = "passed";
      stage("twenty-second grant mint");
      shortSession = newSessionKey();
      const shortIdentity = await deriveGrantIdentity(shortSession);
      let shortEnd = (await sepoliaNow()) + 20;
      await mintGrant(keys, contracts, shortIdentity.label, shortIdentity.owner.address, shortEnd, {
        refreshGrantEnd: async () => {
          shortEnd = Math.max(shortEnd + 1, (await sepoliaNow()) + 20);
          return shortEnd;
        },
      });
      result.shortGrant = { label: shortIdentity.label, requestedSeconds: 20, expiry: shortEnd };
      stage("waiting for expiry block");
      await expect
        .poll(
          async () => {
            if ((await sepoliaNow()) < shortEnd) return false;
            const status = await client.readContract({
              address: contracts.grantRegistry,
              abi: userRegistryAbi,
              functionName: "getStatus",
              args: [BigInt(labelhash(shortIdentity.label))],
            });
            if (status !== 0) return false;
            await rejectsWith(
              () =>
                client.simulateContract({
                  address: contracts.grantRegistry,
                  abi: registryAbi,
                  functionName: "unregister",
                  args: [BigInt(labelhash(shortIdentity.label))],
                  account: keys.account,
                }),
              "LabelExpired",
            );
            return true;
          },
          { timeout: 90000, interval: 2000 },
        )
        .toBe(true);
      result.expiredUnregister = "LabelExpired";
      result.observedSepoliaTime = await sepoliaNow();
      result.status = "passed";
      stage("complete");
    } catch {
      result.status = "failed";
      throw new Error(`Live grant test failed at ${evidence.stage}; inspect public-only evidence`);
    } finally {
      session?.fill(0);
      shortSession?.fill(0);
      session = null;
      shortSession = null;
      persist();
    }
  },
  240000,
);
