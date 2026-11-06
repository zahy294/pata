import { beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "@arkiv-network/sdk";
import { custom, toHex, type Hex } from "viem";
import { deriveHouseholdKeys, deriveGrantIdentity } from "../keys";
import { sealJson } from "../seal";
import { readGrantPayload, deleteGrantPayload, createHistoryEntry, listLiveGrants, listHistory } from "./index";
import { openJson } from "../seal";
import { hexToBytes } from "viem";
const io = vi.hoisted(() => ({
  request: vi.fn(),
  deleteEntity: vi.fn(),
  createEntity: vi.fn(),
  readContract: vi.fn(),
}));
vi.mock("../rpc", () => ({
  arkivPublicClient: () => createPublicClient({ transport: custom({ request: io.request }) }),
  arkivWalletClient: () => io,
  sepoliaPublicClient: () => io,
}));
const key: Hex = `0x${"12".repeat(32)}`;
function row(owner: Hex, values: Record<string, Hex>, schema = "pata.grant.v1", entityKey: Hex = key) {
  return {
    key: entityKey,
    owner,
    creator: owner,
    createdAt: "0x1",
    updatedAt: "0x1",
    expiresAt: "0x77f881",
    creationFlags: 0,
    attributes: [
      { name: "arkiv.schema", type: "str", value: schema },
      ...Object.entries(values).map(([name, value]) => ({ name, type: "bytes", value })),
    ],
    attributeSchema: [
      { name: "arkiv.schema", type: "str", indexed: true },
      ...Object.keys(values).map((name) => ({ name, type: "bytes", indexed: false })),
    ],
  };
}
beforeEach(() => vi.resetAllMocks());
it("paginates index discovery, skips unreadable/foreign rows and propagates registry outages", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const index = {
    grantLabel: "abcdefgh",
    requester: { displayName: "Courier" },
    purpose: "Delivery",
    grantEnd: 2000,
  };
  const sealed = toHex(await sealJson(keys.sealKey, index));
  io.request.mockImplementation(async ({ params }) => ({
    data:
      params[1].offset === "0x0"
        ? Array.from({ length: 100 }, (_, i) =>
            row(i === 0 ? "0x2222222222222222222222222222222222222222" : keys.address, {
              index: "0xff",
              payload: "0x",
            }),
          )
        : [row(keys.address, { index: sealed, payload: "0x" })],
    blockNumber: "0x1",
  }));
  io.readContract.mockResolvedValue("0x1111111111111111111111111111111111111111");
  expect(await listLiveGrants(keys, "home.pata.eth")).toEqual([{ ...index, payloadKey: key }]);
  expect(io.request.mock.calls[1][0].params[1].offset).toBe("0x64");
  expect(io.readContract).toHaveBeenCalledOnce();
  io.readContract.mockRejectedValue(new Error("private RPC request"));
  await expect(listLiveGrants(keys, "home.pata.eth")).rejects.toThrow(/^Could not list live grants$/);
});
it("lists owned decrypted indexes only when registry ownership is live", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const index = {
    grantLabel: "abcdefgh",
    requester: { displayName: "Courier" },
    purpose: "Delivery",
    grantEnd: 2000,
  };
  const sealed = toHex(await sealJson(keys.sealKey, index));
  io.request.mockImplementation(async ({ params }) => {
    expect(params[0]).toContain("pata.grant.v1");
    expect(params[0].toLowerCase()).toContain(keys.address.toLowerCase());
    return { data: [row(keys.address, { index: sealed, payload: "0x" })], blockNumber: "0x1" };
  });
  io.readContract
    .mockResolvedValueOnce("0x1111111111111111111111111111111111111111")
    .mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
  expect(await listLiveGrants(keys, "home.pata.eth")).toEqual([{ ...index, payloadKey: key }]);
  expect(await listLiveGrants(keys, "home.pata.eth")).toEqual([]);
});
it("seals readonly 182-day history and reconciles a lost create acknowledgement", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const entry = {
    version: 1,
    kind: "revoked",
    grantLabel: "abcdefgh",
    requester: { displayName: "Courier" },
    purpose: "Delivery",
    at: 1000,
    grantEnd: 2000,
  } as const;
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
  io.request
    .mockResolvedValueOnce(row(keys.address, { payload: "0x", index: "0x" }))
    .mockResolvedValueOnce(null);
  await deleteGrantPayload(keys, key);
  await deleteGrantPayload(keys, key);
  expect(io.deleteEntity).toHaveBeenCalledExactlyOnceWith({ entityKey: key });
  io.request.mockResolvedValueOnce(
    row("0x2222222222222222222222222222222222222222", { payload: "0x", index: "0x" }),
  );
  await expect(deleteGrantPayload(keys, key)).rejects.toThrow(/^Could not delete grant payload$/);
  expect(io.deleteEntity).toHaveBeenCalledTimes(1);
});
it("returns null for absent entities and wrong owners before attempting to decrypt", async () => {
  const session = await deriveGrantIdentity(new Uint8Array(32));
  const owner = "0x1111111111111111111111111111111111111111";
  io.request.mockResolvedValueOnce(null);
  expect(await readGrantPayload(key, session.sealKey, owner)).toBeNull();
  io.request.mockResolvedValueOnce(
    row("0x2222222222222222222222222222222222222222", { payload: "0xff", index: "0x" }),
  );
  expect(await readGrantPayload(key, session.sealKey, owner)).toBeNull();
  io.request.mockRejectedValue(new Error("private request body"));
  await expect(readGrantPayload(key, session.sealKey, owner)).rejects.toThrow(
    /^Could not read grant payload$/,
  );
});
it("opens a session payload only for the expected household owner", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const session = await deriveGrantIdentity(new Uint8Array(32));
  const payload = { version: 1, purpose: "door" };
  io.request.mockResolvedValue(
    row(keys.address, { payload: toHex(await sealJson(session.sealKey, payload)), index: "0x" }),
  );
  expect(await readGrantPayload(key, session.sealKey, keys.address)).toEqual({
    payload,
    owner: keys.address,
  });
});

it("shows a grant once when a refreshed deadline left two payloads under one label", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const older = { grantLabel: "abcdefgh", requester: { displayName: "Courier" }, purpose: "Delivery", grantEnd: 2000 };
  const newer = { ...older, grantEnd: 2050 };
  const newerKey: Hex = `0x${"34".repeat(32)}`;
  io.request.mockResolvedValue({
    data: [
      row(keys.address, { index: toHex(await sealJson(keys.sealKey, older)), payload: "0x" }),
      row(keys.address, { index: toHex(await sealJson(keys.sealKey, newer)), payload: "0x" }, "pata.grant.v1", newerKey),
    ],
    blockNumber: "0x1",
  });
  io.readContract.mockResolvedValue("0x1111111111111111111111111111111111111111");
  expect(await listLiveGrants(keys, "home.pata.eth")).toEqual([{ ...newer, payloadKey: newerKey }]);
  expect(io.readContract).toHaveBeenCalledOnce();
});

const issued = {
  version: 1,
  kind: "issued",
  grantLabel: "abcdefgh",
  requester: { displayName: "Chai Kart", ensName: "chai-kart.pata.eth" },
  purpose: "Order #4821",
  at: 1000,
  grantEnd: 1020,
} as const;

it("reads the household's own sealed history across pages, skipping foreign, unreadable and malformed rows", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const stranger = await deriveHouseholdKeys(new Uint8Array(32).fill(7));
  const revoked = { ...issued, kind: "revoked", at: 1010 } as const;
  const seal = async (value: unknown, sealKey = keys.sealKey) => toHex(await sealJson(sealKey, value));
  const firstPage = [
    row(keys.address, { sealed: await seal(issued) }, "pata.history.v1"),
    row(stranger.address, { sealed: await seal(issued, stranger.sealKey) }, "pata.history.v1"),
    row(keys.address, { sealed: await seal(issued, stranger.sealKey) }, "pata.history.v1"),
    row(keys.address, { sealed: await seal({ ...issued, kind: "shared" }) }, "pata.history.v1"),
    row(keys.address, { sealed: "0x00" }, "pata.history.v1"),
  ];
  while (firstPage.length < 100) firstPage.push(row(keys.address, { sealed: "0x00" }, "pata.history.v1"));
  io.request.mockImplementation(async ({ params }) => {
    expect(params[0]).toContain("pata.history.v1");
    expect(params[0].toLowerCase()).toContain(keys.address.toLowerCase());
    return {
      data:
        params[1].offset === "0x0"
          ? firstPage
          : [row(keys.address, { sealed: await seal(revoked) }, "pata.history.v1")],
      blockNumber: "0x1",
    };
  });
  expect(await listHistory(keys)).toEqual([issued, revoked]);
});

it("never turns a failed history query into an empty history", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.request.mockRejectedValue(new Error("https://arkiv.test/secret-key body=private"));
  await expect(listHistory(keys)).rejects.toThrow(/^Could not read history$/);
});
