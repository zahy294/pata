import { afterEach, expect, it, vi } from "vitest";
import { writeDirections } from "./directions";
import { modelReply } from "./test-helpers";

afterEach(() => vi.unstubAllGlobals());
const request = {
  wayToTheDoor: "behind Temple, blue gate",
  pin: { lat: 0, lon: 0 },
  landmarks: [
    {
      feature: {
        osmId: "node/1",
        name: "Temple",
        kind: "amenity=place_of_worship",
        point: { lat: 0.001, lon: 0 },
      },
      relation: "behind" as const,
      metres: 999,
    },
  ],
};
const directions = {
  hi: "मंदिर के पीछे नीला दरवाज़ा।",
  mr: "मंदिराच्या मागे निळा दरवाजा.",
  en: "Behind the temple, find the blue gate.",
};

it("writes three languages with Sonnet using code-computed metres and no coordinates or extra room fields", async () => {
  const network = vi.fn<typeof fetch>().mockResolvedValue(modelReply({ directions }));
  vi.stubGlobal("fetch", network);
  const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
  await expect(
    writeDirections("test-key", { ...request, ...{ roomNumber: "PRIVATE_ROOM" } }, charge),
  ).resolves.toEqual({ directions });
  const body = JSON.parse(String(network.mock.calls[0][1]?.body));
  expect(body.model).toBe("claude-sonnet-5-5");
  const input = JSON.parse(body.messages[0].content);
  expect(input).toEqual({
    wayToTheDoor: request.wayToTheDoor,
    landmarks: [{ name: "Temple", kind: "amenity=place_of_worship", relation: "behind", metres: 111 }],
  });
  expect(JSON.stringify(body)).not.toContain("PRIVATE_ROOM");
  expect(body.system).toContain("50");
  expect(charge).toHaveBeenCalledWith(0.3);
});

it("caps long provider text to 300 Unicode characters without splitting surrogate pairs", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        modelReply({
          directions: {
            hi: "मंदिर के पीछे ".repeat(40),
            mr: "मंदिराच्या मागे ".repeat(40),
            en: "🚪".repeat(350),
          },
        }),
      ),
  );
  const result = await writeDirections("test-key", request);
  for (const text of Object.values(result.directions))
    expect(Array.from(text).length).toBeLessThanOrEqual(300);
  expect(result.directions.en).toBe("🚪".repeat(300));
});

it.each([
  { output: { directions: { hi: "", mr: "मागे", en: "Behind" } }, stopReason: "end_turn" },
  { output: { directions: { hi: "पीछे", en: "Behind" } }, stopReason: "end_turn" },
  { output: { directions }, stopReason: "refusal" },
  { output: { directions }, stopReason: "max_tokens" },
])(
  "rejects invalid/partial directions with a plain error and accounts for usage",
  async ({ output, stopReason }) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(modelReply(output, { stopReason })));
    const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
    await expect(writeDirections("test-key", request, charge)).rejects.toThrow(/^Directions unavailable$/);
    expect(charge).toHaveBeenCalledWith(0.3);
  },
);
