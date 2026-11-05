import { afterEach, expect, it, vi } from "vitest";
import { keepKnownLandmarks, rankLandmarks } from "./rank";
import { modelReply } from "./test-helpers";
import type { OsmFeature } from "../../../shared/domain";

const features: OsmFeature[] = [
  { osmId: "node/1", name: "Mandir", kind: "amenity=place_of_worship", point: { lat: 19.04, lon: 72.85 } },
];
afterEach(() => vi.unstubAllGlobals());

it("ranks known landmark ids with Sonnet without sending coordinates and charges usage", async () => {
  const ranked = [{ osmId: "node/1", relation: "behind", confidence: "high" }];
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      modelReply({ landmarks: [...ranked, { osmId: "node/999", relation: "at", confidence: "high" }] }),
    );
  vi.stubGlobal("fetch", network);
  const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
  await expect(rankLandmarks("test-key", "मंदिर के पीछे", features, charge)).resolves.toEqual(ranked);
  const body = JSON.parse(String(network.mock.calls[0][1]?.body));
  expect(body.model).toBe("claude-sonnet-5-5");
  expect(JSON.parse(body.messages[0].content)).toEqual({
    wayToTheDoor: "मंदिर के पीछे",
    features: [{ osmId: "node/1", name: "Mandir", kind: "amenity=place_of_worship" }],
  });
  expect(charge).toHaveBeenCalledWith(0.3);
});

it("keeps only known ids at the plain-code boundary", () => {
  expect(
    keepKnownLandmarks(
      [
        { osmId: "node/1", relation: "at", confidence: "low" },
        { osmId: "way/404", relation: "near", confidence: "high" },
      ],
      features,
    ),
  ).toEqual([{ osmId: "node/1", relation: "at", confidence: "low" }]);
});

it("does not call the model when no map features exist", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(rankLandmarks("test-key", "near gate", [])).resolves.toEqual([]);
  expect(network).not.toHaveBeenCalled();
});

it.each([
  { landmarks: [{ osmId: "node/1", relation: "across Mars", confidence: "high" }] },
  { landmarks: [{ osmId: "node/1", relation: "at", confidence: "certain" }] },
  { landmarks: Array.from({ length: 6 }, () => ({ osmId: "node/1", relation: "near", confidence: "low" })) },
])("rejects invalid relations, confidence and oversized rankings", async (output) => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(modelReply(output)));
  await expect(rankLandmarks("test-key", "near temple", features)).rejects.toThrow(
    /^Landmark ranking unavailable$/,
  );
});
