import { afterEach, expect, it, vi } from "vitest";
import { guard } from "../guard";
import { testEnv } from "../test-env";
import { addressDirections } from "./address-directions";
import { speechOut } from "./speech-out";
import { modelReply } from "../ai/test-helpers";
import { writeDirections, textToSpeech } from "../../../src/lib/server-client";
import { testHouseholdKeys } from "../../../src/lib/server-client/test-helpers";
import { recordingFixture } from "../../../src/lib/server-client/recording-fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("generates raw clips through real signing, guard and spend accounting with provider HTTP mocked", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const env = testEnv();
  env.ANTHROPIC_API_KEY = "test-key";
  const audio = await recordingFixture("tts-silence-16000.mp3");
  const directions = { hi: "नीला दरवाज़ा।", mr: "निळा दरवाजा.", en: "Blue gate." };
  const providers: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).startsWith("https://worker.test/")) {
        const checked = await guard(new Request(String(url), init), env, () => {});
        if (!checked.ok) return checked.response;
        return String(url).endsWith("/address/directions")
          ? addressDirections(checked.ctx)
          : speechOut(checked.ctx);
      }
      providers.push(String(url));
      if (String(url) === "https://api.anthropic.com/v1/messages") return modelReply({ directions });
      expect(String(url)).toBe("https://api.sarvam.ai/text-to-speech");
      return Response.json({ audios: [btoa(String.fromCharCode(...new Uint8Array(audio)))] });
    }),
  );
  const keys = await testHouseholdKeys();
  const result = await writeDirections(keys, {
    wayToTheDoor: "near temple, blue gate",
    pin: { lat: 19.04, lon: 72.85 },
    landmarks: [],
  });
  expect(result).toEqual({ directions });
  for (const language of ["hi", "mr", "en"] as const) {
    await expect(textToSpeech(keys, result.directions[language], language)).resolves.toEqual(
      new Uint8Array(audio),
    );
  }
  expect(providers).toHaveLength(4);
  const expectedSpend = 0.3 + (directions.hi.length + directions.mr.length + directions.en.length) * 0.0012;
  expect(Number(await env.PATA_KV.get(`spend:${new Date().toISOString().slice(0, 10)}`))).toBeCloseTo(
    expectedSpend,
    10,
  );
}, 15000);
