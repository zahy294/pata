import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { speechIn } from "./speech-in";
import { chargeSpend } from "../guard";
import type { Env, RouteContext } from "../env";
import { recordingFixture } from "../../../src/lib/server-client/recording-fixtures";

// Unfinished P0-6 owner boundary only; the adapter/container validation remains real.
vi.mock("../guard", () => ({ chargeSpend: vi.fn() }));
const charged = vi.mocked(chargeSpend);
beforeEach(() => {
  charged.mockReset();
  charged.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());
function context(body: ArrayBuffer, query = "?lang=hi"): RouteContext {
  return {
    env: { SARVAM_API_KEY: "test-sarvam-key" } as Env,
    household: "0x1111111111111111111111111111111111111111",
    ip: "local-test",
    body,
    url: new URL(`https://worker.test/speech/in${query}`),
    waitUntil() {},
  };
}

it("sniffs raw recorder bytes, charges the validated duration before upload and returns a transcript", async () => {
  const events: string[] = [];
  charged.mockImplementation(async () => {
    events.push("spend");
    return true;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => {
      events.push("provider");
      return Response.json({ transcript: "मंदिर के पीछे" });
    }),
  );
  const response = await speechIn(context(await recordingFixture()));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ transcript: "मंदिर के पीछे" });
  expect(events).toEqual(["spend", "provider"]);
  expect(charged.mock.calls[0][1]).toBeCloseTo(0.028, 10);
});

it.each(["", "?lang=xx", "?lang=hi-IN"])(
  "rejects missing/unsupported language %s before provider or spend",
  async (query) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    expect((await speechIn(context(await recordingFixture(), query))).status).toBe(400);
    expect(charged).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  },
);

it.each([
  { kind: "oversized", body: () => Promise.resolve(new ArrayBuffer(2 * 1024 * 1024 + 1)), status: 413 },
  { kind: "overlong", body: () => recordingFixture("live-webm-31.webm"), status: 422 },
  { kind: "malformed", body: () => Promise.resolve(new ArrayBuffer(32)), status: 400 },
])("rejects $kind recordings before provider or spend", async ({ body, status }) => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  const response = await speechIn(context(await body()));
  expect(response.status).toBe(status);
  expect(charged).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});

it("never uploads audio if the spend interface denies the request", async () => {
  charged.mockResolvedValue(false);
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  const response = await speechIn(context(await recordingFixture()));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ code: "spend_limit", error: "Daily spend limit reached" });
  expect(network).not.toHaveBeenCalled();
});

it("drops provider details and retains the conservative spend charge on failure", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("PRIVATE_AUDIO_AND_KEY_DETAILS")));
  const response = await speechIn(context(await recordingFixture()));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    code: "speech_unavailable",
    error: "Speech transcription unavailable",
  });
  expect(charged).toHaveBeenCalledTimes(1);
});
