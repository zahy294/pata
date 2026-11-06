import { beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "@arkiv-network/sdk";
import { custom, toHex, type Hex } from "viem";
import { sealJson, sealBytes } from "../seal";
import type { HomeRecord } from "../../../shared/domain";
import { deriveHouseholdKeys } from "../keys";
import { createHomeRecord, readHomeRecord, createVoiceRecord, readVoiceRecord } from "./index";

const network = vi.hoisted(() => ({ createEntity: vi.fn(), request: vi.fn() }));
vi.mock("../rpc", () => ({
  arkivWalletClient: () => ({ createEntity: network.createEntity }),
  arkivPublicClient: () => createPublicClient({ transport: custom({ request: network.request }) }),
}));

const key: Hex = `0x${"12".repeat(32)}`;
const home: HomeRecord = {
  version: 1,
  digipin: "39J49LL8T4",
  pin: { lat: 28.622788, lon: 77.213033 },
  locality: { name: "Test locality", pinCode: "110001" },
  roomNumber: "private-room-731",
  writtenAddress: "private test address",
  directions: { en: "private way to the door", hi: "हिंदी", mr: "मराठी" },
  voiceKeys: { en: key, hi: key, mr: key },
};
beforeEach(() => {
  vi.resetAllMocks();
  network.request.mockImplementation(async ({ method }) =>
    method === "arkiv_query" ? { data: [], blockNumber: "0x1" } : null,
  );
});

it("reuses a matching decrypted home from this owner's schema query instead of creating again", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const sealed = toHex(await sealJson(keys.sealKey, home));
  network.request.mockImplementation(async ({ method, params }) => {
    expect(method).toBe("arkiv_query");
    expect(params[0]).toContain("pata.home.v1");
    expect(params[0].toLowerCase()).toContain(keys.address.toLowerCase());
    return { data: [rpcRow(keys.address, "pata.home.v1", sealed)], blockNumber: "0x1" };
  });
  expect(await createHomeRecord(keys, home)).toBe(key);
  expect(network.createEntity).not.toHaveBeenCalled();
});

it("finds the home after the create response is lost, without issuing another create", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  let rows: ReturnType<typeof rpcRow>[] = [];
  network.request.mockImplementation(async () => ({ data: rows, blockNumber: "0x1" }));
  network.createEntity.mockImplementation(async (_schema, values) => {
    rows = [rpcRow(keys.address, "pata.home.v1", values.sealed.value)];
    throw new Error("lost response after mining");
  });
  await expect(createHomeRecord(keys, home)).rejects.toThrow("Could not create home record");
  expect(await createHomeRecord(keys, home)).toBe(key);
  expect(network.createEntity).toHaveBeenCalledTimes(1);
});

it("recovers a voice clip after its create response is lost by matching decrypted bytes", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const clip = new Uint8Array([73, 68, 51, 99]);
  let rows: ReturnType<typeof rpcRow>[] = [];
  network.request.mockImplementation(async ({ params }) => {
    expect(params[0]).toContain("pata.voice.v1");
    return { data: rows, blockNumber: "0x1" };
  });
  network.createEntity.mockImplementation(async (_schema, values) => {
    rows = [rpcRow(keys.address, "pata.voice.v1", values.sealed.value)];
    throw new Error("lost voice response");
  });
  await expect(createVoiceRecord(keys, "hi", clip)).rejects.toThrow("Could not create voice record");
  expect(await createVoiceRecord(keys, "hi", clip)).toBe(key);
  expect(network.createEntity).toHaveBeenCalledTimes(1);
});

it("scans later pages and compares home contents independently of JSON property order", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const reordered = Object.fromEntries(Object.entries(home).reverse());
  const sealed = toHex(await sealJson(keys.sealKey, reordered));
  network.request.mockImplementation(async ({ params }) => ({
    data:
      params[1].offset === "0x0"
        ? Array.from({ length: 100 }, () => rpcRow(keys.address))
        : [rpcRow(keys.address, "pata.home.v1", sealed)],
    blockNumber: "0x1",
  }));
  expect(await createHomeRecord(keys, home)).toBe(key);
  expect(network.createEntity).not.toHaveBeenCalled();
  expect(network.request.mock.calls[1][0].params[1].offset).toBe("0x64");
});

it("does not create when home discovery fails", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  network.request.mockRejectedValue(new Error("private RPC details"));
  await expect(createHomeRecord(keys, home)).rejects.toThrow(/^Could not create home record$/);
  expect(network.createEntity).not.toHaveBeenCalled();
});

function rpcRow(owner: Hex, schema = "pata.home.v1", sealed: Hex = "0x") {
  return {
    key,
    owner,
    creator: owner,
    createdAt: "0x1",
    updatedAt: "0x1",
    expiresAt: "0x77f881",
    creationFlags: 0,
    attributes: [
      { name: "arkiv.schema", type: "str", value: schema },
      { name: "sealed", type: "bytes", value: sealed },
    ],
    attributeSchema: [
      { name: "arkiv.schema", type: "str", indexed: true },
      { name: "sealed", type: "bytes", indexed: false },
    ],
  };
}

it("a household can create and read its encrypted home for 182 days", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  network.createEntity.mockImplementation(async (schema, values, options) => {
    expect(schema.name).toBe("pata.home.v1");
    expect(Object.keys(values)).toEqual(["sealed"]);
    expect(options.expiration).toMatchObject({ minLifetime: 7_862_400n, expiresAt: 0n });
    const sealed = values.sealed.value;
    expect(sealed).toMatch(/^0x01/);
    expect(Buffer.from(sealed.slice(2), "hex").includes(Buffer.from(home.roomNumber))).toBe(false);
    network.request.mockResolvedValue({
      key,
      owner: keys.address,
      creator: keys.address,
      createdAt: "0x1",
      updatedAt: "0x1",
      expiresAt: "0x77f881",
      creationFlags: 0,
      attributes: [
        { name: "arkiv.schema", type: "str", value: schema.name },
        { name: "sealed", type: "bytes", value: sealed },
      ],
      attributeSchema: [
        { name: "arkiv.schema", type: "str", indexed: true },
        { name: "sealed", type: "bytes", indexed: false },
      ],
    });
    return { entityKey: key };
  });
  const created = await createHomeRecord(keys, home);
  expect(created).toBe(key);
  expect(await readHomeRecord(keys, created)).toEqual(home);
});

it("rejects another owner's home before attempting decryption", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  network.request.mockResolvedValue(
    rpcRow(
      "0x0000000000000000000000000000000000000001",
      "pata.home.v1",
      toHex(await sealJson(keys.sealKey, home)),
    ),
  );
  await expect(readHomeRecord(keys, key)).rejects.toThrow(/^Could not read home record$/);
});

it.each(["wrong schema", "missing", "network error"])(
  "a home read reports a safe error for %s",
  async (failure) => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    if (failure === "wrong schema") network.request.mockResolvedValue(rpcRow(keys.address, "untrusted.home"));
    else if (failure === "missing") network.request.mockResolvedValue(null);
    else network.request.mockRejectedValue(new Error("SECRET_URL_AND_REQUEST_BODY"));
    await expect(readHomeRecord(keys, key)).rejects.toThrow(/^Could not read home record$/);
  },
);

it("home create never exposes SDK request details on failure", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  network.createEntity.mockRejectedValue(new Error("SECRET_URL_AND_REQUEST_BODY"));
  await expect(createHomeRecord(keys, home)).rejects.toThrow(/^Could not create home record$/);
});

it("a household can round-trip an encrypted MP3 without public language metadata", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const mp3 = new TextEncoder().encode("ID3-private-test-audio-731");
  network.createEntity.mockImplementation(async (schema, values, options) => {
    expect(schema.name).toBe("pata.voice.v1");
    expect(Object.keys(values)).toEqual(["sealed"]);
    expect(options.expiration).toMatchObject({ minLifetime: 7_862_400n, expiresAt: 0n });
    expect(Buffer.from(values.sealed.value.slice(2), "hex").includes(Buffer.from(mp3))).toBe(false);
    network.request.mockResolvedValue(rpcRow(keys.address, schema.name, values.sealed.value));
    return { entityKey: key };
  });
  expect(await createVoiceRecord(keys, "hi", mp3)).toBe(key);
  expect(await readVoiceRecord(keys, key)).toEqual(mp3);
});

it("rejects voice ciphertext from another owner even if it opens with the household key", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  network.request.mockResolvedValue(
    rpcRow(
      "0x0000000000000000000000000000000000000001",
      "pata.voice.v1",
      toHex(await sealBytes(keys.sealKey, new Uint8Array([1, 2, 3]))),
    ),
  );
  await expect(readVoiceRecord(keys, key)).rejects.toThrow(/^Could not read voice record$/);
});

it("voice create never exposes SDK request details on failure", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  network.createEntity.mockRejectedValue(new Error("SECRET_URL_AND_REQUEST_BODY"));
  await expect(createVoiceRecord(keys, "en", new Uint8Array([1, 2, 3]))).rejects.toThrow(
    /^Could not create voice record$/,
  );
});

it.each(["wrong schema", "missing", "network error", "damaged ciphertext"])(
  "a voice read reports a safe error for %s",
  async (failure) => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    if (failure === "wrong schema")
      network.request.mockResolvedValue(rpcRow(keys.address, "untrusted.voice"));
    else if (failure === "missing") network.request.mockResolvedValue(null);
    else if (failure === "damaged ciphertext")
      network.request.mockResolvedValue(rpcRow(keys.address, "pata.voice.v1", "0x010203"));
    else network.request.mockRejectedValue(new Error("SECRET_URL_AND_REQUEST_BODY"));
    await expect(readVoiceRecord(keys, key)).rejects.toThrow(/^Could not read voice record$/);
  },
);
