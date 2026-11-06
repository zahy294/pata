import { createHash } from "node:crypto";
import { recoverMessageAddress } from "viem";
import { afterEach, expect, it, vi } from "vitest";
import { speechToText } from "./index";
import { testHouseholdKeys } from "./test-helpers";
import { recordingFixture } from "./recording-fixtures";
import { SIGNATURE_HEADERS } from "../../../shared/api";

it("preserves the owner's safe spend-limit status and code for speech calls", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ code: "spend_limit", error: "Daily spend limit reached" }, { status: 429 }),
      ),
  );
  await expect(
    speechToText(await testHouseholdKeys(), new Blob([await recordingFixture()]), "hi"),
  ).rejects.toMatchObject({
    name: "ServerError",
    status: 429,
    code: "spend_limit",
    message: "Daily spend limit reached",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("signs exact raw recording bytes for the speech path and parses the transcript", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const bytes = await recordingFixture();
  const keys = await testHouseholdKeys();
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "मंदिर के पीछे" }));
  vi.stubGlobal("fetch", network);
  await expect(speechToText(keys, new Blob([bytes], { type: "audio/webm;codecs=opus" }), "hi")).resolves.toBe(
    "मंदिर के पीछे",
  );
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://worker.test/speech/in?lang=hi");
  expect(init?.method).toBe("POST");
  const body = await new Response(init?.body).arrayBuffer();
  expect(new Uint8Array(body)).toEqual(new Uint8Array(bytes));
  const headers = new Headers(init?.headers);
  expect(headers.get("content-type")).toBe("audio/webm");
  const signature = headers.get(SIGNATURE_HEADERS.signature);
  if (!signature || !signature.startsWith("0x")) throw new Error("Missing signature");
  const recovered = await recoverMessageAddress({
    message: `pata:v1:/speech/in?lang=hi:${headers.get(SIGNATURE_HEADERS.timestamp)}:${createHash("sha256").update(new Uint8Array(body)).digest("hex")}`,
    signature: signature as `0x${string}`,
  });
  expect(recovered.toLowerCase()).toBe(keys.address.toLowerCase());
  expect(headers.get(SIGNATURE_HEADERS.address)?.toLowerCase()).toBe(keys.address.toLowerCase());
});

it("sniffs MP4 bytes when a Blob has no MIME type", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "मंदिराच्या मागे" }));
  vi.stubGlobal("fetch", network);
  await expect(
    speechToText(await testHouseholdKeys(), new Blob([await recordingFixture("mp4-2.mp4")]), "mr"),
  ).resolves.toBe("मंदिराच्या मागे");
  expect(String(network.mock.calls[0][0])).toContain("?lang=mr");
  expect(new Headers(network.mock.calls[0][1]?.headers).get("content-type")).toBe("audio/mp4");
});

it.each(["live-webm-31.webm", "fragmented-mp4-31.mp4"])(
  "rejects long %s before uploading to the Worker",
  async (name) => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", network);
    await expect(
      speechToText(await testHouseholdKeys(), new Blob([await recordingFixture(name)]), "hi"),
    ).rejects.toThrow(/30 seconds/);
    expect(network).not.toHaveBeenCalled();
  },
);

it("rejects an oversized Blob before upload", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(
    speechToText(await testHouseholdKeys(), new Blob([new ArrayBuffer(2 * 1024 * 1024 + 1)]), "hi"),
  ).rejects.toThrow(/2 MiB/);
  expect(network).not.toHaveBeenCalled();
});

it.each([
  {
    kind: "HTTP failure",
    expected: "Server request failed",
    reply: () => Response.json({ error: "PRIVATE_AUDIO_DETAILS" }, { status: 502 }),
  },
  {
    kind: "invalid transcript",
    expected: "Speech service unavailable",
    reply: () => Response.json({ transcript: 42 }),
  },
  {
    kind: "empty transcript",
    expected: "Speech service unavailable",
    reply: () => Response.json({ transcript: "   " }),
  },
  {
    kind: "network failure",
    expected: "Server request failed",
    reply: () => {
      throw new Error("PRIVATE_AUDIO_DETAILS");
    },
  },
])("drops $kind details", async ({ reply, expected }) => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => reply()),
  );
  await expect(
    speechToText(await testHouseholdKeys(), new Blob([await recordingFixture()]), "hi"),
  ).rejects.toThrow(expected);
});
