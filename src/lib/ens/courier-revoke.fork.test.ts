// Opt-in backend evidence; no Cloudflare resources or owner scripts. Keys stay in memory.
// node --env-file=.env.local node_modules/vitest/vitest.mjs run --config src/lib/ens/courier-revoke.fork.config.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  labelhash,
  parseAbi,
  zeroAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createPublicClient as createArkivPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { deriveHouseholdKeys, deriveGrantIdentity, newRandomRoot, newSessionKey } from "../keys";
import { deployHouseholdContracts } from "./household";
import { mintGrant, unregisterGrant, sepoliaNow, grantStatusByName } from "./grants";
import { createGrantBatch, readGrantPayload, deleteGrantPayload, createHistoryEntry } from "../arkiv";
import { userRegistryAbi } from "./abis";
import type { GrantPayload } from "../../../shared/domain";

vi.mock("../rpc", async () => {
  const v = await import("viem");
  const sdk = await import("@arkiv-network/sdk");
  const { sepolia } = await import("viem/chains");
  const { rabdi } = await import("@arkiv-network/sdk/chains");
  const transport = () =>
    v.http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", { retryCount: 0 });
  const publicClient = v.createPublicClient({
    chain: sepolia,
    ccipRead: false,
    transport: transport(),
    pollingInterval: 1000,
  });
  const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
  const arkiv = sdk.createPublicClient({
    chain,
    transport: v.http(undefined, { retryCount: 0 }),
    pollingInterval: 1000,
  });
  return {
    sepoliaPublicClient: () => publicClient,
    sepoliaWalletClient: (account: Parameters<typeof v.createWalletClient>[0]["account"]) =>
      v.createWalletClient({ chain: sepolia, account, transport: transport() }),
    arkivPublicClient: () => arkiv,
    arkivWalletClient: (account: Parameters<typeof sdk.createWalletClient>[0]["account"]) =>
      sdk.createWalletClient({
        chain,
        account,
        transport: v.http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      }),
  };
});

it.skipIf(!process.env.DEPLOYER_PRIVATE_KEY)(
  "verifies live payload ownership, idempotent cleanup and registry expiry",
  async () => {
    const evidence: Record<string, unknown> = {
      checkedAt: new Date().toISOString(),
      status: "running",
      scope:
        "Direct Node test adapters; isolated unregistered household. Browser courier timing not verified.",
    };
    let stage = "preflight";
    const persist = () => {
      mkdirSync("scripts/dev", { recursive: true });
      writeFileSync(
        "scripts/dev/courier-revoke-results.json",
        JSON.stringify({ ...evidence, stage }, null, 2),
      );
    };
    const session = newSessionKey();
    const shortSession = newSessionKey();
    try {
      const transport = () =>
        http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com", { retryCount: 0 });
      const client = createPublicClient({
        chain: sepolia,
        transport: transport(),
        ccipRead: false,
        pollingInterval: 1000,
      });
      const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
      const arkiv = createArkivPublicClient({
        chain,
        transport: http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      const raw = process.env.DEPLOYER_PRIVATE_KEY!;
      const funder = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
      if (
        (await client.getBalance({ address: funder.address })) < parseEther("0.0002") ||
        (await arkiv.getBalance({ address: funder.address })) < parseEther("0.11")
      )
        throw new Error("Insufficient funds");
      const root = newRandomRoot();
      const keys = await deriveHouseholdKeys(root);
      root.fill(0);
      evidence.household = keys.address;
      stage = "funding";
      persist();
      const wallet = createWalletClient({ chain: sepolia, account: funder, transport: transport() });
      const funding = await wallet.sendTransaction({ to: keys.address, value: parseEther("0.0001") });
      expect((await client.waitForTransactionReceipt({ hash: funding })).status).toBe("success");
      const arkivWallet = createWalletClient({
        chain,
        account: funder,
        transport: http(undefined, { retryCount: 0 }),
      });
      const arkivFunding = await arkivWallet.sendTransaction({ to: keys.address, value: parseEther("0.1") });
      expect((await arkiv.waitForTransactionReceipt({ hash: arkivFunding })).status).toBe("success");
      stage = "deploy";
      persist();
      const name = `check-${keys.address.slice(2, 10).toLowerCase()}.pata.eth`;
      const contracts = await deployHouseholdContracts(keys, name, {
        name: "Test locality",
        pinCode: "110001",
      });
      evidence.contracts = contracts;
      const identity = await deriveGrantIdentity(session);
      const at = await sepoliaNow();
      const payload: GrantPayload = {
        version: 1,
        requester: { displayName: "Test courier" },
        purpose: "Delivery",
        language: "en",
        digipin: "39J49LL8T4",
        pin: { lat: 28.62, lon: 77.21 },
        locality: { name: "Test locality", pinCode: "110001" },
        roomNumber: "Test room",
        writtenAddress: "Synthetic address",
        directions: "Synthetic directions",
        grantEnd: at + 180,
      };
      stage = "create payload";
      persist();
      const batch = await createGrantBatch(keys, identity.sealKey, payload, {
        version: 1,
        kind: "issued",
        grantLabel: identity.label,
        requester: payload.requester,
        purpose: payload.purpose,
        at,
        grantEnd: payload.grantEnd,
      });
      evidence.payloadKey = batch.payloadKey;
      expect((await readGrantPayload(batch.payloadKey, identity.sealKey, keys.address))?.payload).toEqual(
        payload,
      );
      expect(await readGrantPayload(batch.payloadKey, identity.sealKey, zeroAddress)).toBeNull();
      stage = "mint and revoke";
      persist();
      evidence.mint = await mintGrant(
        keys,
        contracts,
        identity.label,
        identity.owner.address,
        payload.grantEnd,
      );
      expect(await unregisterGrant(keys, contracts, identity.label)).toBe("revoked");
      const mintReceipt = await client.getTransactionReceipt({ hash: evidence.mint as Hex });
      const [revokedLog] = await client.getLogs({
        address: contracts.grantRegistry,
        event: parseAbi(["event LabelUnregistered(uint256 indexed tokenId, address indexed sender)"])[0],
        fromBlock: mintReceipt.blockNumber,
      });
      if (!revokedLog) throw new Error("Missing unregistration event");
      const revokeReceipt = await client.getTransactionReceipt({ hash: revokedLog.transactionHash });
      const statusAtReceiptBlock = await client.readContract({
        address: contracts.grantRegistry,
        abi: userRegistryAbi,
        functionName: "getStatus",
        args: [BigInt(labelhash(identity.label))],
        blockNumber: revokeReceipt.blockNumber,
      });
      expect(statusAtReceiptBlock).toBe(0);
      evidence.revoke = {
        hash: revokeReceipt.transactionHash,
        block: revokeReceipt.blockNumber.toString(),
        statusAtReceiptBlock,
        gasUsed: revokeReceipt.gasUsed.toString(),
      };
      expect(await unregisterGrant(keys, contracts, identity.label)).toBe("already-ended");
      const status = await client.readContract({
        address: contracts.grantRegistry,
        abi: userRegistryAbi,
        functionName: "getStatus",
        args: [BigInt(labelhash(identity.label))],
      });
      expect(status).toBe(0);
      stage = "cleanup and history";
      persist();
      await deleteGrantPayload(keys, batch.payloadKey);
      await deleteGrantPayload(keys, batch.payloadKey);
      expect(await readGrantPayload(batch.payloadKey, identity.sealKey, keys.address)).toBeNull();
      const revoked = {
        version: 1,
        kind: "revoked",
        grantLabel: identity.label,
        requester: payload.requester,
        purpose: payload.purpose,
        at: await sepoliaNow(),
        grantEnd: payload.grantEnd,
      } as const;
      const historyKey = await createHistoryEntry(keys, revoked);
      expect(await createHistoryEntry(keys, revoked)).toBe(historyKey);
      evidence.historyKey = historyKey;
      stage = "short expiry";
      persist();
      const shortIdentity = await deriveGrantIdentity(shortSession);
      const end = (await sepoliaNow()) + 50; // 20 seconds + configured latency margin.
      evidence.shortMint = await mintGrant(
        keys,
        contracts,
        shortIdentity.label,
        shortIdentity.owner.address,
        end,
      );
      evidence.shortEnd = end;
      let ended = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const state = await client.readContract({
          address: contracts.grantRegistry,
          abi: userRegistryAbi,
          functionName: "getState",
          args: [BigInt(labelhash(shortIdentity.label))],
        });
        if (state.status === 0) {
          ended = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      expect(ended).toBe(true);
      expect(await unregisterGrant(keys, contracts, shortIdentity.label)).toBe("already-ended");
      // Exercise the actual UniversalHelper against an existing ancestor and a missing exact name.
      expect((await grantStatusByName("pata.eth")).live).toBe(true);
      expect((await grantStatusByName(`${shortIdentity.label}.${name}`)).live).toBe(false);
      evidence.status = "passed";
      stage = "complete";
      persist();
    } catch {
      evidence.status = "failed";
      persist();
      throw new Error(`Courier/revoke live check failed at ${stage}`);
    } finally {
      session.fill(0);
      shortSession.fill(0);
    }
  },
  300_000,
);
