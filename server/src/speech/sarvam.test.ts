import { afterEach, expect, it, vi } from "vitest";
import { transcribe } from "./sarvam";
import { recordingFixture } from "../../../src/lib/server-client/recording-fixtures";

afterEach(() => vi.unstubAllGlobals());

it("transcribes a short WebM as codemix with the server-only Sarvam key", async () => {
  const bytes = await recordingFixture();
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ transcript: "मंदिर के पीछे blue gate" }));
  vi.stubGlobal("fetch", network);
  await expect(transcribe("test-sarvam-key", bytes, "audio/webm;codecs=opus", "hi")).resolves.toBe(
    "मंदिर के पीछे blue gate",
  );
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://api.sarvam.ai/speech-to-text");
  expect(init?.method).toBe("POST");
  const headers = new Headers(init?.headers);
  expect(headers.get("api-subscription-key")).toBe("test-sarvam-key");
  expect(headers.has("content-type")).toBe(false);
  const form = init?.body;
  if (!(form instanceof FormData)) throw new Error("Expected multipart audio");
  expect(form.get("model")).toBe("saaras:v4");
  expect(form.get("mode")).toBe("codemix");
  expect(form.get("language_code")).toBe("hi-IN");
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new Error("Expected recording");
  expect(file.type).toBe("audio/webm");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(bytes));
});

it("rejects a durationless WebM over thirty seconds before contacting Sarvam", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(
    transcribe("test-key", await recordingFixture("live-webm-31.webm"), "audio/webm", "hi"),
  ).rejects.toThrow(/30 seconds/);
  expect(network).not.toHaveBeenCalled();
});

it("accepts MP4/AAC unchanged with its proper filename and language", async () => {
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "मंदिराच्या मागे" }));
  vi.stubGlobal("fetch", network);
  const bytes = await recordingFixture("mp4-2.mp4");
  await expect(transcribe("test-key", bytes, "audio/mp4", "mr")).resolves.toBe("मंदिराच्या मागे");
  const form = network.mock.calls[0][1]?.body;
  if (!(form instanceof FormData)) throw new Error("Expected multipart");
  expect(form.get("language_code")).toBe("mr-IN");
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Expected file");
  expect(file.name).toBe("recording.mp4");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(bytes));
});

it("measures fragmented MP4 without trusting an empty movie duration", async () => {
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "near the temple" }));
  vi.stubGlobal("fetch", network);
  await expect(
    transcribe("test-key", await recordingFixture("fragmented-mp4-2.mp4"), "audio/mp4", "en"),
  ).resolves.toBe("near the temple");
});

it.each(["webm-31.webm", "mp4-31.mp4", "fragmented-mp4-31.mp4"])(
  "rejects long %s before provider HTTP",
  async (name) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    await expect(
      transcribe(
        "test-key",
        await recordingFixture(name),
        name.endsWith("webm") ? "audio/webm" : "audio/mp4",
        "hi",
      ),
    ).rejects.toThrow(/30 seconds/);
    expect(network).not.toHaveBeenCalled();
  },
);

it("accepts a WebM with a declared duration as well as a streaming WebM", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "near blue gate" })),
  );
  await expect(
    transcribe("test-key", await recordingFixture("webm-2.webm"), "audio/webm", "en"),
  ).resolves.toBe("near blue gate");
});

it("rejects recordings over 2 MiB before inspecting or uploading them", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(
    transcribe("test-key", new ArrayBuffer(2 * 1024 * 1024 + 1), "audio/webm", "hi"),
  ).rejects.toThrow(/2 MiB/);
  expect(network).not.toHaveBeenCalled();
});

it("allows the inclusive 2 MiB size limit with valid short MP4 content", async () => {
  const original = await recordingFixture("mp4-2.mp4");
  const padded = new ArrayBuffer(2 * 1024 * 1024);
  new Uint8Array(padded).set(new Uint8Array(original));
  const free = new DataView(padded, original.byteLength);
  free.setUint32(0, padded.byteLength - original.byteLength);
  free.setUint32(4, 0x66726565); // legal MP4 free-space box
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "near blue gate" })),
  );
  await expect(transcribe("test-key", padded, "audio/mp4", "en")).resolves.toBe("near blue gate");
});

it.each([new ArrayBuffer(0), new ArrayBuffer(32)])(
  "rejects missing or malformed recordings",
  async (bytes) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    await expect(transcribe("test-key", bytes, "audio/webm", "hi")).rejects.toThrow(
      /Invalid or unsupported speech recording/,
    );
    expect(network).not.toHaveBeenCalled();
  },
);

it("rejects a spoofed content type before upload", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(transcribe("test-key", await recordingFixture(), "audio/mp4", "hi")).rejects.toThrow(
    /does not match/,
  );
  expect(network).not.toHaveBeenCalled();
});

it("does not trust a shortened WebM duration header to hide a long packet timeline", async () => {
  const bytes = await recordingFixture("webm-31.webm");
  const offset = Buffer.from(bytes).indexOf(Buffer.from([0x44, 0x89, 0x88]));
  if (offset < 0) throw new Error("Expected eight-byte duration element in fixture");
  new DataView(bytes).setFloat64(offset + 3, 2000);
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(transcribe("test-key", bytes, "audio/webm", "hi")).rejects.toThrow(/30 seconds/);
  expect(network).not.toHaveBeenCalled();
});

it.each(["live-webm-2.webm", "mp4-2.mp4", "fragmented-mp4-2.mp4"])("rejects truncated %s", async (name) => {
  const bytes = await recordingFixture(name);
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(
    transcribe(
      "test-key",
      bytes.slice(0, Math.floor(bytes.byteLength / 2)),
      name.endsWith("webm") ? "audio/webm" : "audio/mp4",
      "hi",
    ),
  ).rejects.toThrow(/Invalid or unsupported/);
  expect(network).not.toHaveBeenCalled();
});

it.each([
  {
    kind: "quota failure",
    reply: () => Response.json({ error: "PRIVATE_PROVIDER_DETAILS" }, { status: 402 }),
  },
  { kind: "invalid reply", reply: () => Response.json({ transcript: 42 }) },
  { kind: "silence", reply: () => Response.json({ transcript: "  " }) },
  { kind: "overlong transcript", reply: () => Response.json({ transcript: "a".repeat(2001) }) },
  {
    kind: "network failure",
    reply: () => {
      throw new Error("PRIVATE_PROVIDER_DETAILS");
    },
  },
])("returns a plain error on $kind without retrying", async ({ reply }) => {
  const network = vi.fn<typeof fetch>().mockImplementation(async () => reply());
  vi.stubGlobal("fetch", network);
  await expect(transcribe("test-key", await recordingFixture(), "audio/webm", "hi")).rejects.toThrow(
    /^Speech transcription unavailable$/,
  );
  expect(network).toHaveBeenCalledTimes(1);
});
