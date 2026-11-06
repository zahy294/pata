import { beforeEach, expect, it, vi } from "vitest";
import { hexToBytes } from "viem";
import { deriveHouseholdKeys, deriveGrantIdentity } from "../keys";
import { openJson } from "../seal";
import { createGrantBatch } from "./index";
import type { GrantPayload, HistoryEntry } from "../../../shared/domain";

const rpc = vi.hoisted(() => ({ executeBatch: vi.fn() }));
vi.mock("../rpc", () => ({ arkivWalletClient: () => ({ executeBatch: rpc.executeBatch }) }));
const payload: GrantPayload = {
  version: 1,
  requester: { displayName: "Courier" },
  purpose: "Test delivery",
  language: "en",
  digipin: "39J49LL8T4",
  pin: { lat: 28.622788, lon: 77.213033 },
  locality: { name: "Test locality", pinCode: "110001" },
  roomNumber: "Room 731",
  writtenAddress: "Test door",
  directions: "Take the test door",
  audioKey: `0x${"77".repeat(32)}`,
  grantEnd: 1_800_000_050,
};
const issued: HistoryEntry = {
  version: 1,
  kind: "issued",
  grantLabel: "abcdefgh",
  requester: payload.requester,
  purpose: payload.purpose,
  at: 1_800_000_000,
  grantEnd: payload.grantEnd,
};
const payloadKey = `0x${"11".repeat(32)}` as const;
const historyKey = `0x${"22".repeat(32)}` as const;
beforeEach(() => vi.resetAllMocks());

it("creates one atomic grant/history batch with separate encryption recipients and ordered receipt keys", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const identity = await deriveGrantIdentity(new Uint8Array(32).fill(1));
  rpc.executeBatch.mockResolvedValue({ createdEntities: [payloadKey, historyKey] });
  expect(await createGrantBatch(keys, identity.sealKey, payload, issued)).toEqual({ payloadKey, historyKey });
  expect(rpc.executeBatch).toHaveBeenCalledTimes(1);
  const { creates } = rpc.executeBatch.mock.calls[0][0];
  expect(creates.map((item: { schema: { name: string } }) => item.schema.name)).toEqual([
    "pata.grant.v1",
    "pata.history.v1",
  ]);
  expect(Object.keys(creates[0].values)).toEqual(["payload", "index"]);
  expect(creates[0].expiration.expiresAt).toEqual(new Date("2027-01-15T08:00:50.000Z"));
  expect(creates[1].expiration).toMatchObject({ minLifetime: 7_862_400n, expiresAt: 0n });
  expect(creates[1].flags).toEqual({ readonly: true });
  expect(await openJson(identity.sealKey, hexToBytes(creates[0].values.payload.value))).toEqual(payload);
  expect(await openJson(keys.sealKey, hexToBytes(creates[0].values.index.value))).toEqual({
    grantLabel: "abcdefgh",
    requester: { displayName: "Courier" },
    purpose: "Test delivery",
    grantEnd: 1_800_000_050,
    audioKey: payload.audioKey,
  });
  expect(await openJson(keys.sealKey, hexToBytes(creates[1].values.sealed.value))).toEqual(issued);
  await expect(openJson(keys.sealKey, hexToBytes(creates[0].values.payload.value))).rejects.toThrow();
});

it.each([
  { createdEntities: [] },
  { createdEntities: [payloadKey] },
  { createdEntities: [payloadKey, payloadKey] },
])("rejects incomplete or duplicate created entity keys ($createdEntities)", async ({ createdEntities }) => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const identity = await deriveGrantIdentity(new Uint8Array(32).fill(1));
  rpc.executeBatch.mockResolvedValue({ createdEntities });
  await expect(createGrantBatch(keys, identity.sealKey, payload, issued)).rejects.toThrow(
    /^Could not create grant batch$/,
  );
});

it("replaces only the unissued history when rebuilding a batch for a refreshed deadline", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const identity = await deriveGrantIdentity(new Uint8Array(32).fill(1));
  rpc.executeBatch.mockResolvedValue({ createdEntities: [payloadKey, historyKey] });
  await createGrantBatch(keys, identity.sealKey, payload, issued, `0x${"33".repeat(32)}`);
  expect(rpc.executeBatch.mock.calls[0][0].deletes).toEqual([{ entityKey: `0x${"33".repeat(32)}` }]);
});

it("rejects a mismatched history deadline or an oversized encrypted payload before sending", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const identity = await deriveGrantIdentity(new Uint8Array(32).fill(1));
  await expect(
    createGrantBatch(keys, identity.sealKey, payload, { ...issued, grantEnd: issued.grantEnd + 1 }),
  ).rejects.toThrow();
  await expect(
    createGrantBatch(keys, identity.sealKey, { ...payload, writtenAddress: "x".repeat(128 * 1024) }, issued),
  ).rejects.toThrow();
  expect(rpc.executeBatch).not.toHaveBeenCalled();
});
