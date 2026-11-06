import { beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "@arkiv-network/sdk";
import { custom, toHex, type Hex } from "viem";
import { deriveHouseholdKeys, deriveGrantIdentity } from "../keys";
import { sealJson } from "../seal";
import { checkCourierLink } from "./courier";
import type { GrantPayload } from "../../../shared/domain";
const io = vi.hoisted(() => ({ parse: vi.fn(), request: vi.fn(), readContract: vi.fn(), getEnsText: vi.fn() }));
// Frontend-owned parser is still a stub on this branch. This verifies only its agreed boundary.
vi.mock("../link", () => ({ parseCourierFragment: io.parse }));
vi.mock("../rpc", () => ({
  arkivPublicClient: () => createPublicClient({ transport: custom({ request: io.request }) }),
  sepoliaPublicClient: () => io,
}));
const key: Hex = `0x${"12".repeat(32)}`;
const locality = { name: "Dharavi", pinCode: "400017" };
const payload: GrantPayload = { version: 1, requester: { displayName: "Courier" }, purpose: "Delivery", language: "en",
  digipin: "39J49LL8T4", pin: { lat: 28.6, lon: 77.2 }, locality, roomNumber: "731",
  writtenAddress: "Test door", directions: "Test directions", audioMp3Base64: "SUQz", grantEnd: 2000 };
function rpcRow(owner: Hex, sealed: Hex) {
  return { key, owner, creator: owner, createdAt: "0x1", updatedAt: "0x1", expiresAt: "0x77f881", creationFlags: 0,
    attributes: [{ name: "arkiv.schema", type: "str", value: "pata.grant.v1" },
      { name: "payload", type: "bytes", value: sealed }, { name: "index", type: "bytes", value: "0x" }],
    attributeSchema: [{ name: "arkiv.schema", type: "str", indexed: true },
      { name: "payload", type: "bytes", indexed: false }, { name: "index", type: "bytes", indexed: false }],
  };
}
beforeEach(async () => {
  vi.resetAllMocks();
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const identity = await deriveGrantIdentity(new Uint8Array(32));
  io.parse.mockImplementation(() => ({ householdName: "home.pata.eth", payloadKey: key, sessionKey: new Uint8Array(32) }));
  io.getEnsText.mockImplementation(async ({ key }) => key === "location" ? locality.name : locality.pinCode);
  io.readContract.mockImplementation(async ({ args }) => args[0].startsWith("0x08") ? identity.owner.address : keys.address);
  io.request.mockResolvedValue(rpcRow(keys.address, toHex(await sealJson(identity.sealKey, payload))));
});
it("shows the door after both independent owners pass", async () => {
  expect(await checkCourierLink("fragment")).toEqual({ state: "live", locality, payload });
});
it("ends for a missing payload or household owner mismatch before opening bytes", async () => {
  io.request.mockResolvedValueOnce(null);
  expect(await checkCourierLink("fragment")).toEqual({ state: "ended", locality });
  io.request.mockResolvedValueOnce(rpcRow("0x2222222222222222222222222222222222222222", "0xff"));
  expect(await checkCourierLink("fragment")).toEqual({ state: "ended", locality });
});
it("rejects malformed parsed names before any network call", async () => {
  io.parse.mockReturnValueOnce(null);
  expect(await checkCourierLink("bad")).toEqual({ state: "invalid" });
  io.parse.mockReturnValueOnce({ householdName: "evil.example", payloadKey: key, sessionKey: new Uint8Array(32) });
  expect(await checkCourierLink("bad")).toEqual({ state: "invalid" });
  expect(io.getEnsText).not.toHaveBeenCalled();
});
it("a later ownership check ends access even while locality still resolves", async () => {
  expect((await checkCourierLink("fragment")).state).toBe("live");
  io.readContract.mockResolvedValue("0x0000000000000000000000000000000000000000");
  io.request.mockClear();
  expect(await checkCourierLink("fragment")).toEqual({ state: "ended", locality });
  expect(io.request).not.toHaveBeenCalled();
});
it("keeps a transient failure retryable and never shows stale door data", async () => {
  io.readContract.mockRejectedValueOnce(new Error("secret RPC URL"));
  expect(await checkCourierLink("fragment")).toEqual({ state: "checking", locality });
  expect(io.request).not.toHaveBeenCalled();
  expect((await checkCourierLink("fragment")).state).toBe("live");
});
