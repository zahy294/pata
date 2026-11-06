import { beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "@arkiv-network/sdk";
import { custom, hexToBytes, ContractFunctionRevertedError, encodeErrorResult, parseAbi } from "viem";
import { deriveHouseholdKeys, deriveGrantIdentity } from "../keys";
import { sealJson, sealBytes, openJson } from "../seal";
import { approveGrant } from "./approve-grant";
import type { HomeRecord, GrantRequest } from "../../../shared/domain";

const io = vi.hoisted(() => ({
  request: vi.fn(),
  executeBatch: vi.fn(),
  getBlock: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  simulateContract: vi.fn(),
  format: vi.fn(),
  link: null as null | { householdName: string; payloadKey: `0x${string}`; sessionKey: Uint8Array },
}));
vi.mock("../rpc", () => ({
  arkivPublicClient: () => createPublicClient({ transport: custom({ request: io.request }) }),
  arkivWalletClient: () => ({ executeBatch: io.executeBatch }),
  sepoliaPublicClient: () => io,
  sepoliaWalletClient: () => io,
}));
// Frontend formatter is a documented stub dependency; only its interface is substituted.
vi.mock("../link", () => ({ formatCourierLink: io.format }));
const homeKey = `0x${"11".repeat(32)}` as const;
const voiceKey = `0x${"22".repeat(32)}` as const;
const payloadKey = `0x${"33".repeat(32)}` as const;
const historyKey = `0x${"44".repeat(32)}` as const;
const home: HomeRecord = {
  version: 1,
  digipin: "39J49LL8T4",
  pin: { lat: 28.622788, lon: 77.213033 },
  locality: { name: "Test locality", pinCode: "110001" },
  roomNumber: "Room 731",
  writtenAddress: "Private test address",
  directions: { hi: "हिंदी", mr: "मराठी", en: "Test door directions" },
  voiceKeys: { hi: `0x${"55".repeat(32)}`, mr: `0x${"66".repeat(32)}`, en: voiceKey },
};
const household = {
  name: "sana.pata.eth",
  resolver: "0x7777777777777777777777777777777777777777",
  grantRegistry: "0x8888888888888888888888888888888888888888",
  homeRecordKey: homeKey,
} as const;
const request: GrantRequest = {
  requester: { displayName: "Test courier" },
  purpose: "Delivery",
  language: "en",
  durationSeconds: 20,
};
beforeEach(async () => {
  vi.resetAllMocks();
  io.link = null;
  vi.stubGlobal("location", { origin: "https://pata.test" });
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const homeBytes = await sealJson(keys.sealKey, home);
  const voiceBytes = await sealBytes(keys.sealKey, new Uint8Array([0, 1, 2, 255]));
  io.request.mockImplementation(async ({ method, params }) => {
    expect(method).toBe("arkiv_getEntity");
    const isHome = params[0] === homeKey;
    return {
      key: params[0],
      owner: keys.address,
      creator: keys.address,
      createdAt: "0x1",
      updatedAt: "0x1",
      expiresAt: "0x77f881",
      creationFlags: 0,
      attributes: [
        { name: "arkiv.schema", type: "str", value: isHome ? "pata.home.v1" : "pata.voice.v1" },
        {
          name: "sealed",
          type: "bytes",
          value: `0x${Buffer.from(isHome ? homeBytes : voiceBytes).toString("hex")}`,
        },
      ],
      attributeSchema: [
        { name: "arkiv.schema", type: "str", indexed: true },
        { name: "sealed", type: "bytes", indexed: false },
      ],
    };
  });
  io.getBlock.mockResolvedValue({ timestamp: 1_800_000_000n });
  io.executeBatch.mockResolvedValue({ createdEntities: [payloadKey, historyKey] });
  io.writeContract.mockResolvedValue("0x01");
  io.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
  io.format.mockImplementation((origin, link) => {
    io.link = { ...link, sessionKey: new Uint8Array(link.sessionKey) };
    return `${origin}/c#test-${link.payloadKey.slice(-4)}`;
  });
});

it("reads the requested clip, seals the batch, mints its derived owner and returns the frontend link", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const result = await approveGrant(keys, household, request);
  expect(result.courierLink).toBe("https://pata.test/c#test-3333");
  expect(result.grantEnd).toBe(1_800_000_050);
  expect(io.request.mock.calls.map(([item]) => item.params[0])).toEqual([homeKey, voiceKey]);
  const identity = await deriveGrantIdentity(io.link!.sessionKey);
  expect(result.grantLabel).toBe(identity.label);
  expect(io.writeContract.mock.calls[0][0].args).toEqual([
    identity.label,
    identity.owner.address,
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    0n,
    1_800_000_050n,
  ]);
  const { creates } = io.executeBatch.mock.calls[0][0];
  expect(await openJson(identity.sealKey, hexToBytes(creates[0].values.payload.value))).toMatchObject({
    roomNumber: "Room 731",
    directions: "Test door directions",
    audioMp3Base64: "AAEC/w==",
    grantEnd: result.grantEnd,
  });
  expect(io.format.mock.calls.at(-1)![1].sessionKey.every((value: number) => value === 0)).toBe(true);
});

it("rebuilds payload/index/history and the link together when an expiry retry changes the deadline", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const errorAbi = parseAbi(["error CannotSetPastExpiry(uint64 expiry)"]);
  io.writeContract
    .mockRejectedValueOnce(
      new ContractFunctionRevertedError({
        abi: errorAbi,
        functionName: "register",
        data: encodeErrorResult({ abi: errorAbi, errorName: "CannotSetPastExpiry", args: [1_800_000_050n] }),
      }),
    )
    .mockResolvedValueOnce("0x02");
  io.getBlock
    .mockResolvedValueOnce({ timestamp: 1_800_000_000n })
    .mockResolvedValueOnce({ timestamp: 1_800_000_000n })
    .mockResolvedValue({ timestamp: 1_800_000_100n });
  const freshPayloadKey = `0x${"aa".repeat(32)}` as const;
  const freshHistoryKey = `0x${"bb".repeat(32)}` as const;
  io.executeBatch
    .mockResolvedValueOnce({ createdEntities: [payloadKey, historyKey] })
    .mockResolvedValueOnce({ createdEntities: [freshPayloadKey, freshHistoryKey] });
  const result = await approveGrant(keys, household, request);
  expect(result.grantEnd).toBe(1_800_000_150);
  expect(io.link!.payloadKey).toBe(freshPayloadKey);
  expect(io.executeBatch).toHaveBeenCalledTimes(2);
  const identity = await deriveGrantIdentity(io.link!.sessionKey);
  const { creates, deletes } = io.executeBatch.mock.calls[1][0];
  expect(deletes).toEqual([{ entityKey: historyKey }]);
  expect(await openJson(identity.sealKey, hexToBytes(creates[0].values.payload.value))).toMatchObject({
    grantEnd: result.grantEnd,
  });
  expect(await openJson(keys.sealKey, hexToBytes(creates[0].values.index.value))).toMatchObject({
    grantEnd: result.grantEnd,
  });
  expect(await openJson(keys.sealKey, hexToBytes(creates[1].values.sealed.value))).toMatchObject({
    grantEnd: result.grantEnd,
  });
  expect(io.writeContract.mock.calls[1][0].args[5]).toBe(1_800_000_150n);
});

it("fails before paid work when the frontend formatter is unavailable, and clears session bytes", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.format.mockImplementation(() => {
    throw new Error("frontend dependency unavailable");
  });
  await expect(approveGrant(keys, household, request)).rejects.toThrow(/^Could not approve grant$/);
  expect(io.executeBatch).not.toHaveBeenCalled();
  expect(io.writeContract).not.toHaveBeenCalled();
  expect(io.format.mock.calls[0][1].sessionKey.every((value: number) => value === 0)).toBe(true);
});

it("never mints after a failed batch or exposes the SDK error", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.executeBatch.mockRejectedValue(new Error("private URL and ciphertext request"));
  await expect(approveGrant(keys, household, request)).rejects.toThrow(/^Could not approve grant$/);
  expect(io.writeContract).not.toHaveBeenCalled();
  expect(io.format.mock.calls[0][1].sessionKey.every((value: number) => value === 0)).toBe(true);
});

it("never blindly retries an uncertain mint and clears session bytes on failure", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.writeContract.mockRejectedValue(new Error("send response lost: private RPC details"));
  await expect(approveGrant(keys, household, request)).rejects.toThrow(/^Could not approve grant$/);
  expect(io.writeContract).toHaveBeenCalledTimes(1);
  expect(io.format.mock.calls[0][1].sessionKey.every((value: number) => value === 0)).toBe(true);
});
