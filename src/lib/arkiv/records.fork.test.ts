// Opt-in real Rabdi test, excluded from check. Never persist or print private keys or raw SDK errors.
// node --env-file=.env.local node_modules/vitest/vitest.mjs run --config src/lib/arkiv/records.fork.config.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { bytes } from "@arkiv-network/sdk/schema";
import { http, parseEther, formatEther, hexToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { HomeRecord } from "../../../shared/domain";
import { deriveHouseholdKeys, newRandomRoot } from "../keys";
import { createHomeRecord, readHomeRecord, createVoiceRecord, readVoiceRecord } from "./index";
import { homeSchema, voiceSchema } from "./schemas";
import { sealJson } from "../seal";

const evidence = vi.hoisted(() => ({ creates: [] as { entityKey: Hex; txHash: Hex }[] }));
// Only the external RPC boundary is adapted for Node. App clients keep their Nox transport.
vi.mock("../rpc", async () => {
  const { createPublicClient, createWalletClient } = await import("@arkiv-network/sdk");
  const { rabdi } = await import("@arkiv-network/sdk/chains");
  const { http } = await import("viem");
  const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
  return {
    arkivPublicClient: () =>
      createPublicClient({ chain, transport: http(undefined, { retryCount: 0 }), pollingInterval: 1000 }),
    arkivWalletClient: (account: Parameters<typeof createWalletClient>[0]["account"]) => {
      const wallet = createWalletClient({
        chain,
        account,
        transport: http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      return {
        ...wallet,
        createEntity: async (...args: Parameters<typeof wallet.createEntity>) => {
          const result = await wallet.createEntity(...args);
          evidence.creates.push({ entityKey: result.entityKey, txHash: result.txHash });
          return result;
        },
      };
    },
  };
});

it.skipIf(!process.env.DEPLOYER_PRIVATE_KEY)(
  "round-trips sealed home and voice records on Rabdi and rejects 183 days",
  async () => {
    let stage = "preflight";
    const result: Record<string, unknown> = {
      checkedAt: new Date().toISOString(),
      transport: "Node-only direct Rabdi adapter",
    };
    try {
      const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
      const client = createPublicClient({
        chain,
        transport: http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      if ((await client.getChainId()) !== 7794095) throw new Error("Wrong chain");
      const raw = process.env.DEPLOYER_PRIVATE_KEY!;
      const funder = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
      const balance = await client.getBalance({ address: funder.address });
      result.developmentWallet = funder.address;
      result.developmentBalanceTglm = formatEther(balance);
      if (balance < parseEther("0.11")) throw new Error("Insufficient funds");
      const keys = await deriveHouseholdKeys(newRandomRoot());
      result.household = keys.address;
      stage = "funding";
      const wallet = createWalletClient({
        chain,
        account: funder,
        transport: http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      const fundingHash = await wallet.sendTransaction({ to: keys.address, value: parseEther("0.1") });
      if ((await client.waitForTransactionReceipt({ hash: fundingHash })).status !== "success")
        throw new Error("Funding failed");
      result.fundingHash = fundingHash;
      const mp3 = new TextEncoder().encode("ID3-private-rabdi-voice-fixture-731");
      stage = "voice create";
      const voiceKey = await createVoiceRecord(keys, "en", mp3);
      const home: HomeRecord = {
        version: 1,
        digipin: "39J49LL8T4",
        pin: { lat: 28.622788, lon: 77.213033 },
        locality: { name: "Test locality", pinCode: "110001" },
        roomNumber: "private-room-731",
        writtenAddress: "private-rabdi-test-address",
        directions: { en: "private way to test door", hi: "हिंदी", mr: "मराठी" },
        voiceKeys: { en: voiceKey, hi: voiceKey, mr: voiceKey },
      };
      stage = "home create";
      const homeKey = await createHomeRecord(keys, home);
      result.homeKey = homeKey;
      result.voiceKey = voiceKey;
      const polling = { timeout: 30_000, interval: 1_000 };
      stage = "home read";
      await expect.poll(() => readHomeRecord(keys, homeKey), polling).toEqual(home);
      stage = "voice read";
      await expect.poll(() => readVoiceRecord(keys, voiceKey), polling).toEqual(mp3);
      stage = "ciphertext inspection";
      const homeRow = await client.getEntity(homeKey, homeSchema);
      const voiceRow = await client.getEntity(voiceKey, voiceSchema);
      for (const row of [homeRow, voiceRow]) {
        expect(row.$owner.toLowerCase()).toBe(keys.address.toLowerCase());
        expect(row.$expiresAt - row.$createdAt).toBe(7_862_400n);
        expect(row.sealed.value.startsWith("0x01")).toBe(true);
      }
      const homeCiphertext = Buffer.from(hexToBytes(homeRow.sealed.value));
      for (const plaintext of [
        JSON.stringify(home),
        home.roomNumber,
        home.writtenAddress,
        home.directions.en,
      ])
        expect(homeCiphertext.includes(Buffer.from(plaintext))).toBe(false);
      expect(Buffer.from(hexToBytes(voiceRow.sealed.value)).includes(Buffer.from(mp3))).toBe(false);
      result.ciphertextChecks = "passed";
      stage = "183-day rejection";
      const householdWallet = createWalletClient({
        chain,
        account: keys.account,
        transport: http(undefined, { retryCount: 0 }),
        pollingInterval: 1000,
      });
      let capRejected = false;
      try {
        await householdWallet.createEntity(
          homeSchema,
          { sealed: bytes(await sealJson(keys.sealKey, home)) },
          { expiration: ExpirationTime.fromDays(183) },
        );
      } catch (error) {
        // Inspect in memory only; a generic network failure does not count as lifetime rejection.
        let cause: unknown = error;
        for (let depth = 0; depth < 12 && cause && typeof cause === "object"; depth++) {
          if (
            "data" in cause &&
            cause.data &&
            typeof cause.data === "object" &&
            "errorName" in cause.data &&
            cause.data.errorName === "ExpiryBeyondMaxLifetime"
          )
            capRejected = true;
          cause = "cause" in cause ? cause.cause : undefined;
        }
      }
      expect(capRejected).toBe(true);
      result.lifetime183 = "ExpiryBeyondMaxLifetime";
      result.status = "passed";
      result.receipts = await Promise.all(
        evidence.creates.map(async ({ entityKey, txHash }) => {
          const receipt = await client.getTransactionReceipt({ hash: txHash });
          return { entityKey, txHash, gasUsed: receipt.gasUsed.toString(), status: receipt.status };
        }),
      );
    } catch {
      result.status = "failed";
      result.stage = stage;
      throw new Error(`Rabdi record smoke test failed at ${stage}; inspect public-only evidence`);
    } finally {
      result.creates = evidence.creates;
      mkdirSync("scripts/dev", { recursive: true });
      writeFileSync("scripts/dev/arkiv-smoke-results.json", JSON.stringify(result, null, 2));
    }
  },
  180_000,
);
