import { afterEach, describe, expect, it, vi } from "vitest";
import { featuresInBox } from "./overpass";
import { memoryCache } from "./test-helpers";
import type { BBox } from "./nominatim";

const bbox: BBox = [72.848, 19.036, 72.866, 19.055];
const reply = {
  elements: [
    { type: "node", id: 1, lat: 19.04, lon: 72.85, tags: { name: "Temple", amenity: "place_of_worship" } },
    { type: "way", id: 2, center: { lat: 19.042, lon: 72.852 }, tags: { name: "School", amenity: "school" } },
    {
      type: "way",
      id: 3,
      tags: { name: "Lane", highway: "residential" },
      geometry: [
        { lat: 19.04, lon: 72.85 },
        { lat: 19.041, lon: 72.851 },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("featuresInBox", () => {
  it("honours a longer Retry-After and stops after a failed fallback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    const { kv, values } = memoryCache();
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async () => {
        starts.push(Date.now());
        return new Response("busy", { status: 429, headers: { "Retry-After": "45" } });
      }),
    );
    const work = featuresInBox(kv, bbox, []);
    const rejected = expect(work).rejects.toThrow(/^Map search unavailable$/);
    await vi.waitFor(() => expect(starts).toHaveLength(1));
    await vi.runAllTimersAsync();
    await rejected;
    expect(starts).toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(45000);
    expect([...values.keys()].filter((key) => key.startsWith("geo:v1:"))).toEqual([]);
  });
  it("keeps fallback pacing compatible with KV's one write per key per second", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    const { kv, values } = memoryCache();
    const written = new Map<string, number>();
    kv.put.mockImplementation(async (key, value) => {
      if (Date.now() - (written.get(key) ?? -Infinity) < 1000) throw new Error("KV write rate exceeded");
      written.set(key, Date.now());
      values.set(key, value);
    });
    const network = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(Response.json(reply));
    vi.stubGlobal("fetch", network);
    const work = featuresInBox(kv, bbox, []);
    void work.catch(() => undefined);
    await vi.waitFor(() => expect(network).toHaveBeenCalledTimes(1));
    await vi.runAllTimersAsync();
    await expect(work).resolves.toHaveProperty("features");
    expect(network).toHaveBeenCalledTimes(2);
  });
  it.each([
    { body: { remark: "runtime error: timed out", elements: [] } },
    { body: { message: "bad schema" } },
  ])("rejects incomplete or malformed replies without caching them", async ({ body }) => {
    const { kv, values } = memoryCache();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)));
    await expect(featuresInBox(kv, bbox, [])).rejects.toThrow("Map search unavailable");
    expect([...values.keys()].filter((key) => key.startsWith("geo:v1:"))).toEqual([]);
  });
  it("drops network errors rather than exposing their request details", async () => {
    const { kv } = memoryCache();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("PRIVATE_NETWORK_DETAILS")));
    await expect(featuresInBox(kv, bbox, [])).rejects.toThrow(/^Map search unavailable$/);
  });
  it.each([{ box: [72, 20, 71, 21] }, { box: [72, 20, 73, 19] }, { box: [NaN, 19, 73, 20] }])(
    "rejects invalid bbox before sending a query",
    async ({ box }) => {
      const { kv } = memoryCache();
      const network = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", network);
      // These are deliberately invalid runtime coordinates, still a four-number tuple.
      const input: BBox = [box[0], box[1], box[2], box[3]];
      await expect(featuresInBox(kv, input, [])).rejects.toThrow("Invalid locality bounds");
      expect(network).not.toHaveBeenCalled();
    },
  );
  it.each([429, 504, 406])(
    "waits at least 30 seconds before using the fallback after HTTP %s",
    async (status) => {
      vi.useFakeTimers();
      vi.setSystemTime(10000);
      const { kv } = memoryCache();
      const starts: number[] = [];
      const urls: string[] = [];
      const network = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        starts.push(Date.now());
        urls.push(String(input));
        return starts.length === 1 ? new Response("busy", { status }) : Response.json(reply);
      });
      vi.stubGlobal("fetch", network);
      const work = featuresInBox(kv, bbox, [], {
        overpassUrl: "https://primary.example/query",
        overpassFallbackUrl: "https://backup.example/query",
      });
      await vi.waitFor(() => expect(starts).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(29900);
      expect(starts).toHaveLength(1);
      await vi.runAllTimersAsync();
      expect((await work).features).toHaveLength(2);
      expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(30000);
      expect(urls).toEqual(["https://primary.example/query", "https://backup.example/query"]);
    },
  );
  it("keeps only valid in-box features, deduplicates ids and accepts relation centres", async () => {
    const { kv } = memoryCache();
    const data = {
      elements: [
        ...reply.elements,
        reply.elements[0],
        {
          type: "relation",
          id: 4,
          center: { lat: 19.043, lon: 72.853 },
          tags: { name: "Garden", leisure: "park" },
        },
        { type: "node", id: 5, lat: 0, lon: 0, tags: { name: "Wrong city", shop: "bakery" } },
        { type: "node", id: 6, lat: "bad", lon: 72.85, tags: { name: "Broken", shop: "bakery" } },
      ],
    };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(data)));
    const { features } = await featuresInBox(kv, bbox, []);
    expect(features.map((feature) => feature.osmId)).toEqual(["node/1", "way/2", "relation/4"]);
  });
  it("caches a box independently of landmark phrases and never sends private words", async () => {
    const { kv, values } = memoryCache();
    const network = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(reply));
    vi.stubGlobal("fetch", network);
    const [first, second] = await Promise.all([
      featuresInBox(kv, bbox, ["PRIVATE_ROOM_14 blue gate"]),
      featuresInBox(kv, bbox, ["different temple"]),
    ]);
    expect(first).toEqual(second);
    expect(network).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(network.mock.calls)).not.toContain("PRIVATE_ROOM_14");
    expect(JSON.stringify([...values.entries()])).not.toContain("PRIVATE_ROOM_14");
    expect(kv.put).toHaveBeenCalledWith(expect.any(String), expect.any(String), { expirationTtl: 2592000 });
  });
  it("fetches a bounded query and returns features plus lon/lat street geometry", async () => {
    const { kv } = memoryCache();
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(reply));
    vi.stubGlobal("fetch", network);
    await expect(featuresInBox(kv, bbox, ["Temple"])).resolves.toEqual({
      features: [
        {
          osmId: "node/1",
          name: "Temple",
          kind: "amenity=place_of_worship",
          point: { lat: 19.04, lon: 72.85 },
        },
        { osmId: "way/2", name: "School", kind: "amenity=school", point: { lat: 19.042, lon: 72.852 } },
      ],
      streets: [
        {
          osmId: "way/3",
          name: "Lane",
          coords: [
            [72.85, 19.04],
            [72.851, 19.041],
          ],
        },
      ],
    });
    expect(network).toHaveBeenCalledTimes(1);
    const [, init] = network.mock.calls[0];
    const query = new URLSearchParams(String(init?.body)).get("data");
    expect(query).toContain("[bbox:19.036,72.848,19.055,72.866]");
    expect(query).toContain("[timeout:25][maxsize:67108864]");
    expect(query).toContain('way["highway"]');
    expect(new Headers(init?.headers).get("User-Agent")).toContain("Pata/0.1");
  });
});
