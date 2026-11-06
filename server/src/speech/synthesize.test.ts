import { afterEach, expect, it, vi } from "vitest";
import { synthesize } from "./sarvam";
import { recordingFixture } from "../../../src/lib/server-client/recording-fixtures";

afterEach(() => vi.unstubAllGlobals());

it("synthesizes Hindi as AAC at 8 kHz with a model-specific voice and decodes original bytes", async () => {
  const bytes = await recordingFixture("tts-silence-8000.aac");
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ audios: [Buffer.from(bytes).toString("base64")] }));
  vi.stubGlobal("fetch", network);
  const result = await synthesize("test-sarvam-key", "मंदिर के पीछे नीला दरवाज़ा।", "hi");
  expect(new Uint8Array(result)).toEqual(new Uint8Array(bytes));
  expect(String(network.mock.calls[0][0])).toBe("https://api.sarvam.ai/text-to-speech");
  const init = network.mock.calls[0][1];
  expect(new Headers(init?.headers).get("api-subscription-key")).toBe("test-sarvam-key");
  expect(JSON.parse(String(init?.body))).toEqual({
    text: "मंदिर के पीछे नीला दरवाज़ा।",
    language_code: "hi-IN",
    model: "bulbul:v4-flash",
    speaker: "aditya_hi_conversational",
    output_audio_codec: "aac",
    speech_sample_rate: 8000,
  });
});

it("rejects non-AAC provider output even if it is valid base64", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ audios: [Buffer.from("not an AAC file").toString("base64")] })),
  );
  await expect(synthesize("test-key", "Turn at the temple.", "en")).rejects.toThrow(
    /^Speech synthesis unavailable$/,
  );
});

it.each([
  { language: "mr" as const, code: "mr-IN", voice: "ishita_mr_conversational" },
  { language: "en" as const, code: "en-IN", voice: "simran_en_customer" },
])("selects $language's v4 persona", async ({ language, code, voice }) => {
  const network = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      audios: [Buffer.from(await recordingFixture("tts-silence-8000.aac")).toString("base64")],
    }),
  );
  vi.stubGlobal("fetch", network);
  await synthesize("test-key", "Temple gate", language);
  expect(JSON.parse(String(network.mock.calls[0][1]?.body))).toMatchObject({
    speaker: voice,
    language_code: code,
  });
});

it.each(["", "a".repeat(2501)])("rejects text outside the provider limit before HTTP", async (text) => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(synthesize("test-key", text, "hi")).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
});

it.each([{ audios: [] }, { audios: ["%%%"] }, { audios: ["", ""] }, { audios: ["A".repeat(1_500_000)] }])(
  "rejects invalid or excessive audio responses",
  async (body) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)));
    await expect(synthesize("test-key", "Temple gate", "en")).rejects.toThrow(
      /^Speech synthesis unavailable$/,
    );
  },
);

it("hides provider errors without retrying", async () => {
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ error: "PRIVATE_PROVIDER_DETAILS" }, { status: 402 }));
  vi.stubGlobal("fetch", network);
  await expect(synthesize("test-key", "Temple gate", "en")).rejects.toThrow(/^Speech synthesis unavailable$/);
  expect(network).toHaveBeenCalledTimes(1);
});
