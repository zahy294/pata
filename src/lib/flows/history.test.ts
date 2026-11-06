import { beforeEach, expect, it, vi } from "vitest";
import { deriveHouseholdKeys } from "../keys";
import type { HistoryEntry } from "../../../shared/domain";
import { consentRecords, loadConsentHistory } from "./history";

const io = vi.hoisted(() => ({ listHistory: vi.fn() }));
vi.mock("../arkiv", () => ({ listHistory: io.listHistory }));
beforeEach(() => vi.resetAllMocks());

const chai = { displayName: "Chai Kart", ensName: "chai-kart.pata.eth" };
function entry(kind: HistoryEntry["kind"], grantLabel: string, at: number, grantEnd: number): HistoryEntry {
  return { version: 1, kind, grantLabel, requester: chai, purpose: "Order #4821", at, grantEnd };
}

it("turns history entries into one record per grant, newest first, each with how it ended", () => {
  const records = consentRecords(
    [
      entry("issued", "aaaaaaaa", 1000, 1020),
      entry("issued", "bbbbbbbb", 2000, 9000),
      entry("revoked", "bbbbbbbb", 2500, 9000),
      entry("issued", "cccccccc", 3000, 9999),
    ],
    5000,
  );
  expect(records.map((r) => [r.grantLabel, r.status])).toEqual([
    ["cccccccc", "live"],
    ["bbbbbbbb", "stopped"],
    ["aaaaaaaa", "ended"],
  ]);
  expect(records[1]).toEqual({
    grantLabel: "bbbbbbbb",
    requester: chai,
    purpose: "Order #4821",
    issuedAt: 2000,
    grantEnd: 9000,
    stoppedAt: 2500,
    status: "stopped",
  });
});

it("keeps the later deadline when approval refreshed a grant, and shows a stop whose issue entry is missing", () => {
  const records = consentRecords(
    [
      entry("issued", "aaaaaaaa", 1000, 1020),
      entry("issued", "aaaaaaaa", 1004, 1025),
      entry("revoked", "dddddddd", 800, 900),
    ],
    1022,
  );
  expect(records).toEqual([
    expect.objectContaining({ grantLabel: "aaaaaaaa", issuedAt: 1004, grantEnd: 1025, status: "live" }),
    expect.objectContaining({ grantLabel: "dddddddd", issuedAt: null, stoppedAt: 800, status: "stopped" }),
  ]);
});

it("reads the household's history and says plainly when it can't", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.listHistory.mockResolvedValue([entry("issued", "aaaaaaaa", 1000, 1020)]);
  expect(await loadConsentHistory(keys, 2000)).toEqual([
    expect.objectContaining({ grantLabel: "aaaaaaaa", status: "ended" }),
  ]);
  io.listHistory.mockRejectedValue(new Error("https://arkiv.test/key body=private"));
  await expect(loadConsentHistory(keys, 2000)).rejects.toThrow(/^Couldn't read your history right now\.$/);
});
