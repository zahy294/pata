import { afterEach, expect, it, vi } from "vitest";
import { guard } from "../guard";
import { testEnv } from "../test-env";
import { addressExtract } from "./address-extract";
import { extractAddress } from "../../../src/lib/server-client";
import { testHouseholdKeys } from "../../../src/lib/server-client/test-helpers";
import { modelReply } from "../ai/test-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("passes signed extraction through the real guard and charges actual usage without forwarding room fields", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const env = testEnv();
  env.ANTHROPIC_API_KEY = "test-key";
  const result = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Temple"] };
  let providerCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).startsWith("https://worker.test")) {
        const checked = await guard(new Request(String(url), init), env, () => {});
        return checked.ok ? addressExtract(checked.ctx) : checked.response;
      }
      expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
      expect(String(init?.body)).not.toContain("PRIVATE_ROOM");
      providerCalls++;
      return modelReply(result);
    }),
  );
  await expect(
    extractAddress(await testHouseholdKeys(), {
      wayToTheDoor: "near Temple in Dharavi 400017",
      language: "en",
      ...{ roomNumber: "PRIVATE_ROOM" },
    }),
  ).resolves.toEqual(result);
  expect(providerCalls).toBe(1);
  expect(Number(await env.PATA_KV.get(`spend:${new Date().toISOString().slice(0, 10)}`))).toBeCloseTo(
    0.015,
    10,
  );
});
