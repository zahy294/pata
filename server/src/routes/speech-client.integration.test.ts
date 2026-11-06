import { afterEach, expect, it, vi } from "vitest";
import { guard } from "../guard";
import { testEnv } from "../test-env";
import { speechIn } from "./speech-in";
import { speechToText } from "../../../src/lib/server-client";
import { testHouseholdKeys } from "../../../src/lib/server-client/test-helpers";
import { recordingFixture } from "../../../src/lib/server-client/recording-fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("accepts client speech uploads through the real query-bound guard and spend interface", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const env = testEnv();
  let providerCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).startsWith("https://worker.test")) {
        const checked = await guard(new Request(String(url), init), env, () => {});
        return checked.ok ? speechIn(checked.ctx) : checked.response;
      }
      expect(String(url)).toBe("https://api.sarvam.ai/speech-to-text");
      providerCalls++;
      return Response.json({ transcript: "मंदिर के पीछे" });
    }),
  );
  await expect(
    speechToText(await testHouseholdKeys(), new Blob([await recordingFixture()]), "hi"),
  ).resolves.toBe("मंदिर के पीछे");
  expect(providerCalls).toBe(1);
  expect(Number(await env.PATA_KV.get(`spend:${new Date().toISOString().slice(0, 10)}`))).toBeCloseTo(
    0.028,
    10,
  );
});

it("rejects language-query tampering before the provider is contacted", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const env = testEnv();
  let providerCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).startsWith("https://worker.test")) {
        const changed = new URL(String(url));
        changed.searchParams.set("lang", "mr");
        const checked = await guard(new Request(changed, init), env, () => {});
        return checked.ok ? speechIn(checked.ctx) : checked.response;
      }
      providerCalls++;
      return Response.json({ transcript: "should not be reached" });
    }),
  );
  await expect(
    speechToText(await testHouseholdKeys(), new Blob([await recordingFixture()]), "hi"),
  ).rejects.toMatchObject({ name: "ServerError", status: 401, code: "unauthorized" });
  expect(providerCalls).toBe(0);
});
