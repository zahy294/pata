import { afterEach, expect, it, vi } from "vitest";
import { extractAddressParts } from "./extract";
import { modelReply } from "./test-helpers";

afterEach(() => vi.unstubAllGlobals());

it("extracts a locality and landmark phrases with Haiku from only the way to the door", async () => {
  const output = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Hanuman Mandir"] };
  const network = vi.fn<typeof fetch>().mockResolvedValue(modelReply(output));
  vi.stubGlobal("fetch", network);
  const req = {
    wayToTheDoor: "धारावी 400017, हनुमान मंदिर के पीछे",
    language: "hi" as const,
    roomNumber: "PRIVATE_ROOM",
  };
  await expect(extractAddressParts("test-key", req)).resolves.toEqual(output);
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
  const body = JSON.parse(String(init?.body));
  expect(body.model).toBe("claude-haiku-5-5");
  expect(body.output_config.effort).toBe("low");
  expect(body.output_config.format.type).toBe("json_schema");
  expect(JSON.stringify(body)).not.toContain("PRIVATE_ROOM");
  expect(JSON.parse(body.messages[0].content)).toEqual({ wayToTheDoor: req.wayToTheDoor, language: "hi" });
});

it("charges actual token usage even when structured output is invalid, and exposes a plain error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(modelReply({ locality: "PRIVATE_PROVIDER_DETAIL" })),
  );
  const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
  await expect(
    extractAddressParts("test-key", { wayToTheDoor: "near temple", language: "en" }, charge),
  ).rejects.toThrow(/^Address extraction unavailable$/);
  expect(charge).toHaveBeenCalledWith(0.015);
});

it("allows missing locality without inventing one", async () => {
  const output = { locality: null, landmarkPhrases: ["blue gate"] };
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(modelReply(output)));
  await expect(
    extractAddressParts("test-key", { wayToTheDoor: "near blue gate", language: "en" }),
  ).resolves.toEqual(output);
});

it.each(["refusal", "max_tokens"])(
  "does not return partial output on %s but still charges usage",
  async (stopReason) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(modelReply({ locality: null, landmarkPhrases: [] }, { stopReason })),
    );
    const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
    await expect(
      extractAddressParts("test-key", { wayToTheDoor: "near gate", language: "mr" }, charge),
    ).rejects.toThrow(/^Address extraction unavailable$/);
    expect(charge).toHaveBeenCalledWith(0.015);
  },
);

it("retries a failing provider once, then drops its HTTP error details", async () => {
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ error: { message: "PRIVATE_KEY_AND_BODY" } }, { status: 500 }));
  vi.stubGlobal("fetch", network);
  await expect(
    extractAddressParts("test-key", { wayToTheDoor: "near gate", language: "en" }),
  ).rejects.toThrow(/^Address extraction unavailable$/);
  // Haiku and its SDK retry, then the Sonnet fallback and its SDK retry.
  expect(network.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).model)).toEqual([
    "claude-haiku-5-5",
    "claude-haiku-5-5",
    "claude-sonnet-5-5",
    "claude-sonnet-5-5",
  ]);
});

it("falls back to Sonnet when Haiku keeps failing, and logs only the failure category", async () => {
  const output = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Murugan temple"] };
  const overloaded = () =>
    Response.json(
      { type: "error", error: { type: "overloaded_error", message: "PRIVATE_DETAIL" } },
      { status: 529 },
    );
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(overloaded())
    .mockResolvedValueOnce(overloaded())
    .mockResolvedValue(modelReply(output));
  vi.stubGlobal("fetch", network);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
  await expect(
    extractAddressParts("test-key", { wayToTheDoor: "PRIVATE_WAY Dharavi 400017", language: "en" }, charge),
  ).resolves.toEqual(output);
  expect(JSON.parse(String(network.mock.calls[2][1]?.body)).model).toBe("claude-sonnet-5-5");
  expect(charge).toHaveBeenCalledTimes(1);
  const lines = log.mock.calls.map(([line]) => String(line));
  expect(lines).toEqual([
    JSON.stringify({
      event: "model_call_failed",
      model: "claude-haiku-5-5",
      status: 529,
      type: "overloaded_error",
    }),
  ]);
  expect(lines.join()).not.toMatch(/PRIVATE/);
  log.mockRestore();
});

it("recovers from one transient overload without the household seeing an error", async () => {
  const output = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Murugan temple"] };
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ error: { type: "overloaded_error" } }, { status: 529 }))
    .mockResolvedValue(modelReply(output));
  vi.stubGlobal("fetch", network);
  await expect(
    extractAddressParts("test-key", { wayToTheDoor: "Dharavi 400017 near Murugan temple", language: "en" }),
  ).resolves.toEqual(output);
  expect(network).toHaveBeenCalledTimes(2);
});

it("validates the request before calling a model", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(extractAddressParts("test-key", { wayToTheDoor: "", language: "en" })).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
});

it("asks once more when a complete reply fails the schema, charging both attempts", async () => {
  const output = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Murugan temple"] };
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      modelReply({ locality: { name: "Dharavi", pinCode: "400 017" }, landmarkPhrases: [] }),
    )
    .mockResolvedValue(modelReply(output));
  vi.stubGlobal("fetch", network);
  const charge = vi.fn<(cents: number) => Promise<void>>().mockResolvedValue();
  await expect(
    extractAddressParts(
      "test-key",
      { wayToTheDoor: "Dharavi 400017 near Murugan temple", language: "en" },
      charge,
    ),
  ).resolves.toEqual(output);
  expect(network).toHaveBeenCalledTimes(2);
  expect(charge).toHaveBeenCalledTimes(2);
});
