import { beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "@arkiv-network/sdk";
import { custom } from "viem";
import { deriveHouseholdKeys } from "../keys";
import { revokeGrant } from "./revoke";
const io = vi.hoisted(() => ({
  request: vi.fn(),
  readContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  getBlock: vi.fn(),
  deleteEntity: vi.fn(),
  createEntity: vi.fn(),
  loadRevocationCheckpoint: vi.fn(),
  saveRevocationCheckpoint: vi.fn(),
}));
vi.mock("../keys/store", () => io);
vi.mock("../rpc", () => ({
  arkivPublicClient: () => createPublicClient({ transport: custom({ request: io.request }) }),
  arkivWalletClient: () => io,
  sepoliaPublicClient: () => io,
  sepoliaWalletClient: () => io,
}));
const key = `0x${"12".repeat(32)}` as const;
const household = {
  name: "home.pata.eth",
  resolver: "0x2222222222222222222222222222222222222222",
  grantRegistry: "0x3333333333333333333333333333333333333333",
  homeRecordKey: key,
} as const;
const grant = {
  grantLabel: "abcdefgh",
  payloadKey: key,
  requester: { displayName: "Courier" },
  purpose: "Delivery",
  grantEnd: 2000,
};
let checkpoint: unknown;
beforeEach(() => {
  vi.resetAllMocks();
  checkpoint = null;
  io.loadRevocationCheckpoint.mockImplementation(async () => structuredClone(checkpoint));
  io.saveRevocationCheckpoint.mockImplementation(async (_address, _key, value) => {
    checkpoint = structuredClone(value);
  });
  io.getBlock.mockResolvedValue({ timestamp: 1000n });
  io.readContract.mockImplementation(async ({ functionName }) =>
    functionName === "getStatus" ? 2 : "0x1111111111111111111111111111111111111111",
  );
  io.writeContract.mockResolvedValue("0x01");
  io.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
  io.request.mockImplementation(async ({ method }) =>
    method === "arkiv_query" ? { data: [], blockNumber: "0x1" } : null,
  );
  io.createEntity.mockResolvedValue({ entityKey: key });
});
it("reads the household registry before revoking even if an ancestor is detached", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.readContract.mockImplementation(async ({ functionName }) =>
    functionName === "getStatus" ? 2 : "0x0000000000000000000000000000000000000000",
  );
  expect(await revokeGrant(keys, household, grant)).toBe("revoked");
  expect(io.writeContract).toHaveBeenCalledOnce();
});
it("revokes ENS before Arkiv cleanup and writes one readonly history entry", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  expect(await revokeGrant(keys, household, grant)).toBe("revoked");
  expect(io.writeContract).toHaveBeenCalledOnce();
  expect(io.createEntity).toHaveBeenCalledOnce();
  expect(io.waitForTransactionReceipt.mock.invocationCallOrder[0]).toBeLessThan(
    io.createEntity.mock.invocationCallOrder[0],
  );
  expect(await revokeGrant(keys, household, grant)).toBe("revoked");
  expect(io.createEntity).toHaveBeenCalledOnce();
});
it("sends nothing for a grant already ended before a revoke intent exists", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.readContract.mockResolvedValue("0x0000000000000000000000000000000000000000");
  expect(await revokeGrant(keys, household, grant)).toBe("already-ended");
  expect(io.writeContract).not.toHaveBeenCalled();
  expect(io.createEntity).not.toHaveBeenCalled();
});
it("shares simultaneous revoke calls so they cannot race two unregistrations", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  expect(
    await Promise.all([revokeGrant(keys, household, grant), revokeGrant(keys, household, grant)]),
  ).toEqual(["revoked", "revoked"]);
  expect(io.writeContract).toHaveBeenCalledOnce();
  expect(io.createEntity).toHaveBeenCalledOnce();
});
it("serializes revocation across browser tabs when Web Locks are available", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const request = vi.fn(async (_name: string, operation: () => Promise<unknown>) => operation());
  vi.stubGlobal("navigator", { locks: { request } });
  try {
    expect(await revokeGrant(keys, household, grant)).toBe("revoked");
    expect(request).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("resumes cleanup after an unregistration acknowledgement is lost", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.waitForTransactionReceipt.mockRejectedValueOnce(new Error("lost ack private RPC"));
  await expect(revokeGrant(keys, household, grant)).rejects.toThrow(
    /^Could not revoke grant; retry to finish cleanup$/,
  );
  io.readContract.mockResolvedValue(0);
  expect(await revokeGrant(keys, household, grant)).toBe("revoked");
  expect(io.writeContract).toHaveBeenCalledOnce();
  expect(io.createEntity).toHaveBeenCalledOnce();
});
it("retains encrypted cleanup intent when Arkiv fails after ENS revocation", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.request.mockRejectedValue(new Error("private Arkiv key"));
  await expect(revokeGrant(keys, household, grant)).rejects.toThrow("retry to finish cleanup");
  expect(JSON.stringify(checkpoint)).not.toContain("Delivery");
  io.request.mockImplementation(async ({ method }) =>
    method === "arkiv_query" ? { data: [], blockNumber: "0x1" } : null,
  );
  io.readContract.mockResolvedValue(0);
  expect(await revokeGrant(keys, household, grant)).toBe("revoked");
  expect(io.writeContract).toHaveBeenCalledOnce();
  expect(io.createEntity).toHaveBeenCalledOnce();
});
it("deletes the grant's audio entity along with its payload", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const audioKey = `0x${"77".repeat(32)}` as const;
  io.request.mockImplementation(async ({ method, params }) => {
    if (method === "arkiv_query") return { data: [], blockNumber: "0x1" };
    if (params?.[0] !== audioKey) return null;
    return {
      key: audioKey,
      owner: keys.address,
      creator: keys.address,
      createdAt: "0x1",
      updatedAt: "0x1",
      expiresAt: "0x77f881",
      creationFlags: 0,
      attributes: [
        { name: "arkiv.schema", type: "str", value: "pata.grant-audio.v1" },
        { name: "sealed", type: "bytes", value: "0x01" },
      ],
      attributeSchema: [
        { name: "arkiv.schema", type: "str", indexed: true },
        { name: "sealed", type: "bytes", indexed: false },
      ],
    };
  });
  expect(await revokeGrant(keys, household, { ...grant, audioKey })).toBe("revoked");
  expect(io.deleteEntity).toHaveBeenCalledWith({ entityKey: audioKey });
});
