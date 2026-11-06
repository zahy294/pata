import { beforeEach, expect, it, vi } from "vitest";
import { deriveHouseholdKeys } from "../keys";
import { sealJson } from "../seal";
import type { HistoryEntry, LiveGrant } from "../../../shared/domain";
import { finishInterruptedStops, loadLiveAccess, stopAccess, timeLeft } from "./access";

const io = vi.hoisted(() => ({
  listLiveGrants: vi.fn(),
  revokeGrant: vi.fn(),
  listUnfinishedRevocations: vi.fn(),
}));
vi.mock("../arkiv", () => ({ listLiveGrants: io.listLiveGrants }));
vi.mock("./revoke", () => ({ revokeGrant: io.revokeGrant }));
vi.mock("../keys/store", () => ({ listUnfinishedRevocations: io.listUnfinishedRevocations }));

const payloadKey = `0x${"12".repeat(32)}` as const;
const household = {
  name: "sana.pata.eth",
  resolver: "0x2222222222222222222222222222222222222222",
  grantRegistry: "0x3333333333333333333333333333333333333333",
  homeRecordKey: payloadKey,
} as const;
const grant: LiveGrant = {
  grantLabel: "abcdefgh",
  payloadKey,
  requester: { displayName: "Chai Kart", ensName: "chai-kart.pata.eth" },
  purpose: "Order #4821",
  grantEnd: 2000,
};
beforeEach(() => vi.resetAllMocks());

it("lists the live grants of this phone's household", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.listLiveGrants.mockResolvedValue([grant]);
  expect(await loadLiveAccess(keys, household)).toEqual([grant]);
  expect(io.listLiveGrants).toHaveBeenCalledWith(keys, "sana.pata.eth");
});

it("says plainly when the list can't be read, never showing an empty list instead", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.listLiveGrants.mockRejectedValue(new Error("https://arkiv.test/key body=private"));
  await expect(loadLiveAccess(keys, household)).rejects.toThrow(
    /^Couldn't check who can find your door right now\.$/,
  );
});

it("stopping access reports a grant that had already ended on its own", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.revokeGrant.mockResolvedValueOnce("revoked").mockResolvedValueOnce("already-ended");
  expect(await stopAccess(keys, household, grant)).toBe("stopped");
  expect(await stopAccess(keys, household, grant)).toBe("already-ended");
  io.revokeGrant.mockRejectedValue(new Error("Could not revoke grant; retry to finish cleanup"));
  await expect(stopAccess(keys, household, grant)).rejects.toThrow(
    /^Access may not have stopped yet\. Tap Stop again to finish\.$/,
  );
});

it("finishes a stop that was cut off after the name was released, from the sealed checkpoint alone", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const entry: HistoryEntry = {
    version: 1,
    kind: "revoked",
    grantLabel: grant.grantLabel,
    requester: grant.requester,
    purpose: grant.purpose,
    at: 1500,
    grantEnd: grant.grantEnd,
  };
  io.listUnfinishedRevocations.mockResolvedValue([
    { payloadKey, checkpoint: { sealedHistory: await sealJson(keys.sealKey, entry) } },
  ]);
  io.revokeGrant.mockResolvedValue("revoked");
  expect(await finishInterruptedStops(keys, household)).toBe(1);
  expect(io.listUnfinishedRevocations).toHaveBeenCalledWith(keys.address);
  expect(io.revokeGrant).toHaveBeenCalledWith(keys, household, {
    grantLabel: grant.grantLabel,
    payloadKey,
    requester: grant.requester,
    purpose: grant.purpose,
    grantEnd: grant.grantEnd,
  });
});

it("leaves a stop that still can't finish, or a checkpoint that won't open, for next time", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const stranger = await deriveHouseholdKeys(new Uint8Array(32).fill(9));
  io.listUnfinishedRevocations.mockResolvedValue([
    { payloadKey, checkpoint: { sealedHistory: await sealJson(stranger.sealKey, { kind: "revoked" }) } },
    {
      payloadKey,
      checkpoint: {
        sealedHistory: await sealJson(keys.sealKey, {
          version: 1,
          kind: "revoked",
          grantLabel: "abcdefgh",
          requester: { displayName: "Courier" },
          purpose: "Delivery",
          at: 1,
          grantEnd: 2,
        }),
      },
    },
  ]);
  io.revokeGrant.mockRejectedValue(new Error("Could not revoke grant; retry to finish cleanup"));
  expect(await finishInterruptedStops(keys, household)).toBe(0);
  expect(io.revokeGrant).toHaveBeenCalledOnce();
  io.listUnfinishedRevocations.mockRejectedValue(new Error("Device storage is blocked"));
  expect(await finishInterruptedStops(keys, household)).toBe(0);
});

it.each([
  [2017, "0:17"],
  [2065, "1:05"],
  [2900, "15 min"],
  [5700, "1 h 1 min"],
  [2000 + 2 * 86_400 + 60, "2 days"],
  [2000, "Ending now"],
  [1990, "Ending now"],
])("shows the time left until %i as %s", (grantEnd, words) => {
  expect(timeLeft(grantEnd, 2000)).toBe(words);
});
