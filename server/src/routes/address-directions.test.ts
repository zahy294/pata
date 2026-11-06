import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addressDirections } from "./address-directions";
import { speechOut } from "./speech-out";
import { chargeSpend } from "../guard";
import { testEnv } from "../test-env";
import type { RouteContext } from "../env";
import { modelReply } from "../ai/test-helpers";
import { recordingFixture } from "../../../src/lib/server-client/recording-fixtures";
import { ErrorResponse } from "../../../shared/api";

vi.mock("../guard", () => ({ chargeSpend: vi.fn() }));
const charged = vi.mocked(chargeSpend);
beforeEach(() => {
  charged.mockReset();
  charged.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());
async function context(body: unknown): Promise<RouteContext> {
  const env = testEnv();
  env.ANTHROPIC_API_KEY = "test-key";
  env.SARVAM_API_KEY = "test-key";
  return {
    env,
    body: await new Response(JSON.stringify(body)).arrayBuffer(),
    household: "0x1111111111111111111111111111111111111111",
    ip: "local-test",
    url: new URL("https://worker.test/address/directions"),
    waitUntil() {},
  };
}
const request = { wayToTheDoor: "Temple, blue gate", pin: { lat: 19.04, lon: 72.85 }, landmarks: [] };
const directions = {
  hi: "मंदिर के पास नीला दरवाज़ा।",
  mr: "मंदिराजवळ निळा दरवाजा.",
  en: "At the temple, find the blue gate.",
};

it("returns schema-validated directions and charges model usage", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(modelReply({ directions })));
  const response = await addressDirections(await context(request));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ directions });
  expect(charged).toHaveBeenLastCalledWith(expect.anything(), 0.3);
});

it("returns uncached MP3 bytes and charges text before synthesis", async () => {
  const bytes = await recordingFixture("tts-silence-16000.mp3");
  const events: string[] = [];
  charged.mockImplementation(async () => {
    events.push("spend");
    return true;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => {
      events.push("provider");
      return Response.json({ audios: [Buffer.from(bytes).toString("base64")] });
    }),
  );
  const response = await speechOut(await context({ text: directions.hi, language: "hi" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));
  expect(events).toEqual(["spend", "provider"]);
  expect(charged.mock.calls[0][1]).toBeCloseTo(directions.hi.length * 0.0012, 10);
});

it.each([addressDirections, speechOut])(
  "rejects malformed requests before paid calls or charges",
  async (handler) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    const response = await handler(await context({ roomNumber: "PRIVATE_ROOM" }));
    expect(response.status).toBe(400);
    expect(network).not.toHaveBeenCalled();
    expect(charged).not.toHaveBeenCalled();
  },
);

it.each([
  { handler: addressDirections, body: request },
  { handler: speechOut, body: { text: directions.en, language: "en" } },
])("refuses spend denial without a provider call", async ({ handler, body }) => {
  charged.mockResolvedValue(false);
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  expect((await handler(await context(body))).status).toBe(429);
  expect(network).not.toHaveBeenCalled();
});

it("returns a spend error if model usage exceeds the remaining allowance", async () => {
  charged.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(modelReply({ directions })));
  expect((await addressDirections(await context(request))).status).toBe(429);
});

it.each([
  { handler: addressDirections, body: request, message: "Directions unavailable" },
  {
    handler: speechOut,
    body: { text: directions.en, language: "en" },
    message: "Speech synthesis unavailable",
  },
])("never echoes provider errors", async ({ handler, body, message }) => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("PRIVATE_KEY_AND_BODY")));
  const response = await handler(await context(body));
  expect(response.status).toBe(502);
  expect(ErrorResponse.parse(await response.json()).error).toBe(message);
});
