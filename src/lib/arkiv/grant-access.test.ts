import { beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "@arkiv-network/sdk";
import { custom, toHex, type Hex } from "viem";
import { deriveHouseholdKeys, deriveGrantIdentity } from "../keys";
import { sealJson } from "../seal";
import { readGrantPayload, deleteGrantPayload, createHistoryEntry, listLiveGrants } from "./index";
import { openJson } from "../seal";
import { hexToBytes } from "viem";
const io = vi.hoisted(() => ({ request: vi.fn(), deleteEntity: vi.fn(), createEntity: vi.fn(), readContract: vi.fn() }));
vi.mock("../rpc", () => ({
  arkivPublicClient: () => createPublicClient({ transport: custom({ request: io.request }) }),
  arkivWalletClient: () => io, sepoliaPublicClient: () => io,
}));
const key: Hex = `0x${"12".repeat(32)}`;
function row(owner: Hex, values: Record<string, Hex>, schema = "pata.grant.v1") {
  return { key, owner, creator: owner, createdAt: "0x1", updatedAt: "0x1", expiresAt: "0x77f881", creationFlags: 0,
    attributes: [{ name: "arkiv.schema", type: "str", value: schema },
      ...Object.entries(values).map(([name, value]) => ({ name, type: "bytes", value }))],
    attributeSchema: [{ name: "arkiv.schema", type: "str", indexed: true },
      ...Object.keys(values).map(name => ({ name, type: "bytes", indexed: false }))],
  };
}
beforeEach(() => vi.resetAllMocks());
it("lists owned decrypted indexes only when registry ownership is live", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const index = { grantLabel: "abcdefgh", requester: { displayName: "Courier" }, purpose: "Delivery", grantEnd: 2000 };
  const sealed = toHex(await sealJson(keys.sealKey, index));
  io.request.mockImplementation(async ({ params }) => {
    expect(params[0]).toContain("pata.grant.v1");
    expect(params[0].toLowerCase()).toContain(keys.address.toLowerCase());
    return { data: [row(keys.address, { index: sealed, payload: "0x" })], blockNumber: "0x1" };
  });
  io.readContract.mockResolvedValueOnce("0x1111111111111111111111111111111111111111")
    .mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
  expect(await listLiveGrants(keys, "home.pata.eth")).toEqual([{ ...index, payloadKey: key }]);
  expect(await listLiveGrants(keys, "home.pata.eth")).toEqual([]);
});
it("seals readonly 182-day history and reconciles a lost create acknowledgement", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const entry = { version: 1, kind: "revoked", grantLabel: "abcdefgh", requester: { displayName: "Courier" },
    purpose: "Delivery", at: 1000, grantEnd: 2000 } as const;
  let rows: ReturnType<typeof row>[] = [];
  io.request.mockImplementation(async ({ params }) => {
    expect(params[0].toLowerCase()).toContain(keys.address.toLowerCase());
    return { data: rows, blockNumber: "0x1" };
  });
  io.createEntity.mockImplementation(async (_schema, values, options) => {
    expect(options).toMatchObject({ flags: { readonly: true }, expiration: { minLifetime: 7862400n } });
    expect(await openJson(keys.sealKey, hexToBytes(values.sealed.value))).toEqual(entry);
    rows = [row(keys.address, { sealed: values.sealed.value }, "pata.history.v1")];
    throw new Error("lost acknowledgement");
  });
  await expect(createHistoryEntry(keys, entry)).rejects.toThrow(/^Could not create history entry$/);
  expect(await createHistoryEntry(keys, entry)).toBe(key);
  expect(io.createEntity).toHaveBeenCalledTimes(1);
});
it("deletes only an owned grant and safely retries a deletion that already landed", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.request.mockResolvedValueOnce(row(keys.address, { payload: "0x", index: "0x" })).mockResolvedValueOnce(null);
  await deleteGrantPayload(keys, key);
  await deleteGrantPayload(keys, key);
  expect(io.deleteEntity).toHaveBeenCalledExactlyOnceWith({ entityKey: key });
  io.request.mockResolvedValueOnce(row("0x2222222222222222222222222222222222222222", { payload: "0x", index: "0x" }));
  await expect(deleteGrantPayload(keys, key)).rejects.toThrow(/^Could not delete grant payload$/);
  expect(io.deleteEntity).toHaveBeenCalledTimes(1);
});
it("returns null for absent entities and wrong owners before attempting to decrypt", async () => {
  const session = await deriveGrantIdentity(new Uint8Array(32));
  const owner = "0x1111111111111111111111111111111111111111";
  io.request.mockResolvedValueOnce(null);
  expect(await readGrantPayload(key, session.sealKey, owner)).toBeNull();
  io.request.mockResolvedValueOnce(row("0x2222222222222222222222222222222222222222", { payload: "0xff", index: "0x" }));
  expect(await readGrantPayload(key, session.sealKey, owner)).toBeNull();
  io.request.mockRejectedValue(new Error("private request body"));
  await expect(readGrantPayload(key, session.sealKey, owner)).rejects.toThrow(/^Could not read grant payload$/);
});
it("opens a session payload only for the expected household owner", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const session = await deriveGrantIdentity(new Uint8Array(32));
  const payload = { version: 1, purpose: "door" };
  io.request.mockResolvedValue(row(keys.address, { payload: toHex(await sealJson(session.sealKey, payload)), index: "0x" }));
  expect(await readGrantPayload(key, session.sealKey, keys.address)).toEqual({ payload, owner: keys.address });
});
