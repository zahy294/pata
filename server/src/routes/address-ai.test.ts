import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addressExtract } from "./address-extract";
import { addressRank } from "./address-rank";
import { chargeSpend } from "../guard";
import type { Env, RouteContext } from "../env";
import { memoryCache } from "../geo/test-helpers";
import { modelReply } from "../ai/test-helpers";
import { RankResponse } from "../../../shared/api";

// P0-6 owner boundary is currently a stub. Model/map code stays real; only HTTP is mocked.
vi.mock("../guard", () => ({ chargeSpend: vi.fn() }));
const charged = vi.mocked(chargeSpend);
const extracted = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Temple"] };
const request = { wayToTheDoor: "behind Temple in Dharavi 400017", language: "en" };
function bodyBytes(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(encoded.length);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}
function context(body: unknown, route = "/address/extract"): RouteContext {
  const { kv } = memoryCache();
  return {
    env: {
      ANTHROPIC_API_KEY: "test-key",
      SARVAM_API_KEY: "unused-test-key",
      RELAY_PRIVATE_KEY: "0x00",
      ARKIV_ACCESS_KEY: "unused-test-key",
      ALLOWED_ORIGINS: "https://app.test",
      KILL_SWITCH: "off",
      DAILY_SPEND_CAP_CENTS: "300",
      PATA_REGISTRY_ADDRESS: "",
      SEPOLIA_RPC_URL: "https://rpc.test",
      ARKIV_RPC_URL: "https://rpc.test",
      PATA_KV: kv as unknown as Env["PATA_KV"],
    },
    household: "0x1111111111111111111111111111111111111111",
    ip: "local-test",
    body: bodyBytes(JSON.stringify(body)),
    url: new URL(`https://worker.test${route}`),
    waitUntil() {},
  };
}
beforeEach(() => {
  charged.mockReset();
  charged.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());

it("validates extraction, charges usage and strips room fields before the model", async () => {
  const network = vi.fn<typeof fetch>().mockResolvedValue(modelReply(extracted));
  vi.stubGlobal("fetch", network);
  const ctx = context({ ...request, roomNumber: "PRIVATE_ROOM" });
  const response = await addressExtract(ctx);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(extracted);
  expect(charged).toHaveBeenNthCalledWith(1, ctx.env, 0);
  expect(charged).toHaveBeenNthCalledWith(2, ctx.env, 0.015);
  expect(JSON.stringify(network.mock.calls)).not.toContain("PRIVATE_ROOM");
});

const nominatim = [
  {
    osm_type: "way",
    type: "suburb",
    boundingbox: ["19.036", "19.055", "72.848", "72.866"],
    address: { postcode: "400017" },
  },
];
const mapReply = {
  elements: [
    { type: "node", id: 1, lat: 19.04, lon: 72.85, tags: { name: "Temple", amenity: "place_of_worship" } },
    { type: "node", id: 2, lat: 19.041, lon: 72.852, tags: { name: "Temple", amenity: "place_of_worship" } },
    {
      type: "way",
      id: 3,
      tags: { highway: "residential" },
      geometry: [
        { lat: 19.0395, lon: 72.849 },
        { lat: 19.0395, lon: 72.854 },
      ],
    },
  ],
};
const rankRequest = {
  wayToTheDoor: "PRIVATE_WAY behind Temple",
  locality: extracted.locality,
  landmarkPhrases: ["Temple"],
};

it("ranks real adapter outputs, places known pins and detects the chosen landmark's duplicate name", async () => {
  const network = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).includes("nominatim")) return Response.json(nominatim);
    if (String(url).includes("overpass")) return Response.json(mapReply);
    return modelReply({
      landmarks: [
        { osmId: "node/999", relation: "near", confidence: "high" },
        { osmId: "node/1", relation: "behind", confidence: "high" },
      ],
    });
  });
  vi.stubGlobal("fetch", network);
  const response = await addressRank(
    context({ ...rankRequest, roomNumber: "PRIVATE_ROOM" }, "/address/rank"),
  );
  expect(response.status).toBe(200);
  const result = RankResponse.parse(await response.json());
  expect(result.bbox).toEqual([72.848, 19.036, 72.866, 19.055]);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0].landmark.osmId).toBe("node/1");
  expect(result.candidates[0].metresFromLandmark).toBeCloseTo(10, 4);
  expect(result.duplicateLandmarkName).toBe(true);
  expect(JSON.stringify(network.mock.calls)).not.toContain("PRIVATE_ROOM");
  const mapCalls = network.mock.calls.filter(([url]) => !String(url).includes("anthropic"));
  expect(JSON.stringify(mapCalls)).not.toContain("PRIVATE_WAY");
  expect(charged).toHaveBeenLastCalledWith(expect.anything(), 0.3);
});

it("returns a framed empty map on Overpass failure without calling or charging Sonnet", async () => {
  const network = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).includes("nominatim")) return Response.json(nominatim);
    throw new Error("PRIVATE_NETWORK_DETAILS");
  });
  vi.stubGlobal("fetch", network);
  const response = await addressRank(context(rankRequest, "/address/rank"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    candidates: [],
    bbox: [72.848, 19.036, 72.866, 19.055],
    duplicateLandmarkName: false,
  });
  expect(network.mock.calls.some(([url]) => String(url).includes("anthropic"))).toBe(false);
  expect(charged).not.toHaveBeenCalled();
});

it.each([addressExtract, addressRank])(
  "rejects invalid and malformed bodies before outbound work",
  async (handler) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    expect((await handler(context({ roomNumber: "PRIVATE_ROOM" }))).status).toBe(400);
    const ctx = context({});
    ctx.body = bodyBytes("{broken PRIVATE_ROOM");
    const response = await handler(ctx);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("PRIVATE_ROOM");
    expect(network).not.toHaveBeenCalled();
    expect(charged).not.toHaveBeenCalled();
  },
);

it("refuses extraction before a paid request if the owner's spend check denies it", async () => {
  charged.mockResolvedValue(false);
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  expect((await addressExtract(context(request))).status).toBe(429);
  expect(network).not.toHaveBeenCalled();
});

it("returns a plain limit error if token charging reaches the cap", async () => {
  charged.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(modelReply(extracted)));
  const response = await addressExtract(context(request));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ code: "spend_limit", error: "Daily spend limit reached" });
});

it("does not invent locality bounds when Nominatim finds no locality", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json([])));
  expect((await addressRank(context(rankRequest))).status).toBe(422);
  expect(charged).not.toHaveBeenCalled();
});

it("does not flag a duplicate when no landmark was chosen", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes("nominatim")) return Response.json(nominatim);
      if (String(url).includes("overpass")) return Response.json(mapReply);
      return modelReply({ landmarks: [] });
    }),
  );
  const response = await addressRank(context(rankRequest));
  const result = RankResponse.parse(await response.json());
  expect(result.candidates).toEqual([]);
  expect(result.duplicateLandmarkName).toBe(false);
});

it("returns plain model errors while charging invalid structured output", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(modelReply({ private: "PRIVATE_PROVIDER_DETAILS" })),
  );
  const response = await addressExtract(context(request));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    code: "address_unavailable",
    error: "Address extraction unavailable",
  });
  expect(charged).toHaveBeenLastCalledWith(expect.anything(), 0.015);
});
