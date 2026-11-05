import { afterEach, describe, expect, it, vi } from "vitest";
import { localityBBox } from "./nominatim";
import { memoryCache } from "./test-helpers";

const locality = { name: "Dharavi", pinCode: "400017" };
const reply = [
  {
    type: "administrative",
    addresstype: "suburb",
    osm_type: "way",
    osm_id: 280668341,
    boundingbox: ["19.0368844", "19.0542277", "72.8484246", "72.8651342"],
    address: { suburb: "Dharavi", postcode: "400017" },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("localityBBox", () => {
  it("supports a configured endpoint and ignores unrelated private fields", async () => {
    const { kv, values } = memoryCache();
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(reply));
    vi.stubGlobal("fetch", network);
    const input = { ...locality, wayToTheDoor: "PRIVATE_BLUE_GATE", roomNumber: "PRIVATE_ROOM_14" };
    await localityBBox(kv, input, { nominatimUrl: "https://geo.example/search" });
    expect(String(network.mock.calls[0][0])).toContain("https://geo.example/search?");
    expect(JSON.stringify(network.mock.calls)).not.toContain("PRIVATE_");
    expect(JSON.stringify([...values.entries()])).not.toContain("PRIVATE_");
  });
  it.each([
    { name: "", pinCode: "400017" },
    { name: "Dharavi", pinCode: "invalid" },
  ])("rejects invalid locality input before networking", async (input) => {
    const { kv } = memoryCache();
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    await expect(localityBBox(kv, input)).rejects.toThrow("Invalid locality");
    expect(network).not.toHaveBeenCalled();
  });
  it.each([
    { rows: [{ ...reply[0], type: "postcode", addresstype: "postcode" }] },
    { rows: [{ ...reply[0], address: { postcode: "999999" } }] },
  ])("does not use postcode-only or mismatched results", async ({ rows }) => {
    const { kv } = memoryCache();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(rows)));
    await expect(localityBBox(kv, locality)).resolves.toBeNull();
  });
  it.each([{ error: "private server detail" }, [{ ...reply[0], boundingbox: ["oops", "19", "72", "73"] }]])(
    "rejects malformed Nominatim replies",
    async (rows) => {
      const { kv } = memoryCache();
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(rows)));
      await expect(localityBBox(kv, locality)).rejects.toThrow("Map search unavailable");
    },
  );
  it("rejects HTTP failures without exposing the upstream body", async () => {
    const { kv, values } = memoryCache();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("private upstream detail", { status: 429 })),
    );
    await expect(localityBBox(kv, locality)).rejects.toThrow("Map search unavailable");
    expect([...values.keys()].filter((key) => key.startsWith("geo:v1:"))).toEqual([]);
  });
  it("paces different cache misses at least one second apart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    const { kv } = memoryCache();
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async () => {
        starts.push(Date.now());
        return Response.json(reply);
      }),
    );
    const work = Promise.all([
      localityBBox(kv, locality),
      localityBBox(kv, { name: "BKC", pinCode: "400051" }),
    ]);
    // Drain async hashing before advancing the request timer.
    await vi.waitFor(() => expect(starts.length).toBeGreaterThanOrEqual(1));
    await vi.runAllTimersAsync();
    await work;
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
  });
  it("caches normalized locality lookups for 30 days, including simultaneous callers", async () => {
    const { kv } = memoryCache();
    const network = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(reply));
    vi.stubGlobal("fetch", network);
    const results = await Promise.all([
      localityBBox(kv, locality),
      localityBBox(kv, { name: "  DHARAVI  ", pinCode: "400017" }),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(network).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledWith(expect.any(String), expect.any(String), { expirationTtl: 2592000 });
  });
  it("returns null when no locality was found", async () => {
    const { kv } = memoryCache();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json([])));
    await expect(localityBBox(kv, locality)).resolves.toBeNull();
  });
  it("searches only the locality and converts Nominatim's coordinate order", async () => {
    const { kv } = memoryCache();
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(reply));
    vi.stubGlobal("fetch", network);
    await expect(localityBBox(kv, locality)).resolves.toEqual([
      72.8484246, 19.0368844, 72.8651342, 19.0542277,
    ]);
    const [input, init] = network.mock.calls[0];
    const url = new URL(String(input));
    expect(url.searchParams.get("q")).toBe("Dharavi, 400017");
    expect(url.searchParams.get("countrycodes")).toBe("in");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(new Headers(init?.headers).get("User-Agent")).toContain("Pata/0.1");
  });
});
