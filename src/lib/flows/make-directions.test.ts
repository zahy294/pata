import { afterEach, expect, it, vi } from "vitest";
import { makeDirections } from "./setup-household";
import { testHouseholdKeys } from "../server-client/test-helpers";
import { recordingFixture } from "../server-client/recording-fixtures";

const directions = { hi: "नीला दरवाज़ा।", mr: "निळा दरवाजा.", en: "Blue gate." };
const pin = { lat: 19.04, lon: 72.85 };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("returns three raw language clips and directions without Arkiv or RPC calls", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const audio = await recordingFixture("tts-silence-16000.mp3");
  const network = vi.fn<typeof fetch>(async (url) => {
    if (String(url) === "https://worker.test/address/directions") return Response.json({ directions });
    if (String(url) === "https://worker.test/speech/out")
      return new Response(audio, { headers: { "content-type": "audio/mpeg" } });
    throw new Error("Unexpected external call");
  });
  vi.stubGlobal("fetch", network);
  const result = await makeDirections(await testHouseholdKeys(), "near temple, blue gate", pin, []);
  expect(result).toEqual({
    directions,
    clips: {
      hi: new Uint8Array(audio),
      mr: new Uint8Array(audio),
      en: new Uint8Array(audio),
    },
  });
  expect(network).toHaveBeenCalledTimes(4);
});

it("keeps text and other clips when one language's speech provider fails", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const audio = await recordingFixture("tts-silence-16000.mp3");
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith("/address/directions")) return Response.json({ directions });
      if (JSON.parse(String(init?.body)).language === "hi") return new Response(null, { status: 502 });
      return new Response(audio, { headers: { "content-type": "audio/mpeg" } });
    }),
  );
  await expect(makeDirections(await testHouseholdKeys(), "near temple", pin, [])).resolves.toEqual({
    directions,
    clips: { mr: new Uint8Array(audio), en: new Uint8Array(audio) },
  });
});

it("shortens only an oversized language once and returns text matching the retry audio", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const audio = await recordingFixture("tts-silence-16000.mp3");
  const boundary = new Uint8Array(131043); // + 29-byte envelope = exactly 128 KiB: must retry.
  boundary.set(new Uint8Array(audio));
  const largestFit = new Uint8Array(131042);
  largestFit.set(new Uint8Array(audio));
  const hiTexts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith("/address/directions")) return Response.json({ directions });
      const input = JSON.parse(String(init?.body));
      if (input.language === "hi") hiTexts.push(input.text);
      const bytes = input.language === "hi" && hiTexts.length === 1 ? boundary : largestFit;
      return new Response(bytes, { headers: { "content-type": "audio/mpeg" } });
    }),
  );
  const keys = await testHouseholdKeys();
  const result = await makeDirections(keys, "near temple", pin, []);
  expect(hiTexts).toHaveLength(2);
  expect(hiTexts[1].length).toBeLessThan(hiTexts[0].length);
  expect(result.directions).toEqual({ ...directions, hi: hiTexts[1] });
  expect(result.clips.hi).toEqual(largestFit);
  const { sealBytes } = await import("../seal");
  expect((await sealBytes(keys.sealKey, largestFit)).byteLength).toBe(131071);
});

it.each([false, true])("omits a clip after an oversized or failed retry (failure=%s)", async (failRetry) => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const audio = await recordingFixture("tts-silence-16000.mp3");
  const oversized = new Uint8Array(131043);
  oversized.set(new Uint8Array(audio));
  let hiCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith("/address/directions")) return Response.json({ directions });
      if (JSON.parse(String(init?.body)).language === "hi") {
        hiCalls++;
        if (failRetry && hiCalls === 2) return new Response(null, { status: 502 });
        return new Response(oversized, { headers: { "content-type": "audio/mpeg" } });
      }
      return new Response(audio, { headers: { "content-type": "audio/mpeg" } });
    }),
  );
  await expect(makeDirections(await testHouseholdKeys(), "near temple", pin, [])).resolves.toEqual({
    directions,
    clips: { mr: new Uint8Array(audio), en: new Uint8Array(audio) },
  });
  expect(hiCalls).toBe(2);
});

it("retains all directions when every synthesis call fails without retrying provider errors", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith("/address/directions")
      ? Response.json({ directions })
      : new Response(null, { status: 502 }),
  );
  vi.stubGlobal("fetch", network);
  await expect(makeDirections(await testHouseholdKeys(), "near temple", pin, [])).resolves.toEqual({
    directions,
    clips: {},
  });
  expect(network).toHaveBeenCalledTimes(4);
});

it("stops before speech when the directions request fails", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 502 }));
  vi.stubGlobal("fetch", network);
  await expect(makeDirections(await testHouseholdKeys(), "near temple", pin, [])).rejects.toThrow();
  expect(network).toHaveBeenCalledTimes(1);
});

it("sends code-computed landmark distances from the confirmed pin", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith("/address/directions")
      ? Response.json({ directions })
      : new Response(null, { status: 502 }),
  );
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
