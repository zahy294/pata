import { afterEach, expect, it, vi } from "vitest";
import { writeDirections, textToSpeech } from "./index";
import { testHouseholdKeys } from "./test-helpers";
import { recordingFixture } from "./recording-fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = { wayToTheDoor: "near temple, blue gate", pin: { lat: 19.04, lon: 72.85 }, landmarks: [] };
const directions = { hi: "नीला दरवाज़ा।", mr: "निळा दरवाजा.", en: "Blue gate." };

it("posts signed, schema-stripped direction inputs and validates the three-language response", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ directions }));
  vi.stubGlobal("fetch", network);
  await expect(
    writeDirections(await testHouseholdKeys(), { ...request, ...{ roomNumber: "PRIVATE_ROOM" } }),
  ).resolves.toEqual({ directions });
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://worker.test/address/directions");
  expect(JSON.parse(String(init?.body))).toEqual(request);
  expect(new Headers(init?.headers).has("x-pata-signature")).toBe(true);
});

it("posts text to the signed speech-out route and returns raw AAC bytes", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const aac = await recordingFixture("tts-silence-8000.aac");
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(aac, { headers: { "content-type": "audio/aac" } }));
  vi.stubGlobal("fetch", network);
  await expect(textToSpeech(await testHouseholdKeys(), directions.en, "en")).resolves.toEqual(
    new Uint8Array(aac),
  );
  expect(String(network.mock.calls[0][0])).toBe("https://worker.test/speech/out");
  expect(JSON.parse(String(network.mock.calls[0][1]?.body))).toEqual({ text: directions.en, language: "en" });
  expect(new Headers(network.mock.calls[0][1]?.headers).has("x-pata-signature")).toBe(true);
});

it.each([
  { body: new Uint8Array([1, 2, 3]), type: "audio/aac" },
  { body: new Uint8Array([1, 2, 3]), type: "application/json" },
  { body: new Uint8Array(1024 * 1024 + 1), type: "audio/aac" },
])("rejects wrong, malformed or excessive audio", async ({ body, type }) => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "content-type": type } })),
  );
  await expect(textToSpeech(await testHouseholdKeys(), directions.en, "en")).rejects.toThrow(
    /^Speech service unavailable$/,
  );
});

it("preserves safe server limit errors for synthesis", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ code: "spend_limit", error: "Daily spend limit reached" }, { status: 429 }),
      ),
  );
  await expect(textToSpeech(await testHouseholdKeys(), directions.en, "en")).rejects.toMatchObject({
    name: "ServerError",
    status: 429,
    code: "spend_limit",
  });
});

it("rejects blank and overlong synthesis input before HTTP", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  const keys = await testHouseholdKeys();
  for (const text of ["   ", "a".repeat(2501)])
    await expect(textToSpeech(keys, text, "en")).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
});

it("rejects missing or empty directions fields", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(Response.json({ directions: { ...directions, hi: "" } })),
  );
  await expect(writeDirections(await testHouseholdKeys(), request)).rejects.toThrow(
    /^Address service unavailable$/,
  );
});
