import { afterEach, expect, it, vi } from "vitest";
import { makeDirections } from "./setup-household";
import { testHouseholdKeys } from "../server-client/test-helpers";

const directions = { hi: "नीला दरवाज़ा।", mr: "निळा दरवाजा.", en: "Blue gate." };
const pin = { lat: 19.04, lon: 72.85 };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("returns the three directions texts with one call and no speech, Arkiv or RPC calls (ADR 0010)", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>(async (url) => {
    if (String(url) === "https://worker.test/address/directions") return Response.json({ directions });
    throw new Error("Unexpected external call");
  });
  vi.stubGlobal("fetch", network);
  await expect(makeDirections(await testHouseholdKeys(), "near temple, blue gate", pin, [])).resolves.toEqual(
    {
      directions,
    },
  );
  expect(network).toHaveBeenCalledTimes(1);
});

it("throws when the directions request fails", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 502 }));
  vi.stubGlobal("fetch", network);
  await expect(makeDirections(await testHouseholdKeys(), "near temple", pin, [])).rejects.toThrow();
  expect(network).toHaveBeenCalledTimes(1);
});

it("sends code-computed landmark distances from the confirmed pin", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>(async () => Response.json({ directions }));
  vi.stubGlobal("fetch", network);
  await makeDirections(await testHouseholdKeys(), "near temple", pin, [
    {
      feature: { osmId: "node/1", name: "Temple", kind: "amenity", point: { lat: 19.041, lon: 72.85 } },
      relation: "near",
    },
  ]);
  const sent = JSON.parse(String(network.mock.calls[0][1]?.body));
  expect(sent.landmarks[0].metres).toBeCloseTo(111.195, 2);
  expect(sent.pin).toEqual(pin);
});
