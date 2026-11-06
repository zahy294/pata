import { createHash } from "node:crypto";
import { recoverMessageAddress } from "viem";
import { afterEach, expect, it, vi } from "vitest";
import { extractAddress, rankLandmarks } from "./index";
import { testHouseholdKeys } from "./test-helpers";
import { SIGNATURE_HEADERS } from "../../../shared/api";

it("preserves the owner's safe spend-limit status and code for address calls", async () => {
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
    extractAddress(await testHouseholdKeys(), { wayToTheDoor: "near Temple", language: "en" }),
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
const parts = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Temple"] };

it("sends extraction with an independently verifiable signature over the exact stripped body", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test/");
  const keys = await testHouseholdKeys();
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(parts));
  vi.stubGlobal("fetch", network);
  await expect(
    extractAddress(keys, { wayToTheDoor: "near Temple", language: "en", ...{ roomNumber: "PRIVATE_ROOM" } }),
  ).resolves.toEqual(parts);
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://worker.test/address/extract");
  expect(init?.method).toBe("POST");
  const body = String(init?.body);
  expect(JSON.parse(body)).toEqual({ wayToTheDoor: "near Temple", language: "en" });
  const headers = new Headers(init?.headers);
  const timestamp = headers.get(SIGNATURE_HEADERS.timestamp);
  expect(Math.abs(Date.now() / 1000 - Number(timestamp))).toBeLessThan(2);
  expect(headers.get("content-type")).toBe("application/json");
  const signature = headers.get(SIGNATURE_HEADERS.signature);
  if (!signature || !signature.startsWith("0x")) throw new Error("Missing signature");
  const recovered = await recoverMessageAddress({
    message: `pata:v1:/address/extract:${timestamp}:${createHash("sha256").update(body).digest("hex")}`,
    signature: signature as `0x${string}`,
  });
  expect(recovered.toLowerCase()).toBe(keys.address.toLowerCase());
  expect(headers.get(SIGNATURE_HEADERS.address)?.toLowerCase()).toBe(keys.address.toLowerCase());
});

it("sends ranking to its signed route and parses the framed dropped-pin response", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const output = { candidates: [], bbox: [72.848, 19.036, 72.866, 19.055], duplicateLandmarkName: false };
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(output));
  vi.stubGlobal("fetch", network);
  const keys = await testHouseholdKeys();
  await expect(
    rankLandmarks(keys, {
      wayToTheDoor: "behind Temple",
      locality: parts.locality,
      landmarkPhrases: parts.landmarkPhrases,
      ...{ writtenAddress: "PRIVATE_ADDRESS" },
    }),
  ).resolves.toEqual(output);
  const [url, init] = network.mock.calls[0];
  expect(String(url)).toBe("https://worker.test/address/rank");
  expect(String(init?.body)).not.toContain("PRIVATE_ADDRESS");
  const headers = new Headers(init?.headers);
  const signature = headers.get(SIGNATURE_HEADERS.signature);
  if (!signature) throw new Error("Missing signature");
  const recovered = await recoverMessageAddress({
    message: `pata:v1:/address/rank:${headers.get(SIGNATURE_HEADERS.timestamp)}:${createHash("sha256").update(String(init?.body)).digest("hex")}`,
    signature: signature as `0x${string}`,
  });
  expect(recovered.toLowerCase()).toBe(keys.address.toLowerCase());
});

it.each([
  {
    kind: "HTTP failure",
    expected: "Server request failed",
    reply: () => Response.json({ error: "PRIVATE_PROVIDER_BODY" }, { status: 503 }),
  },
  {
    kind: "invalid schema",
    expected: "Address service unavailable",
    reply: () => Response.json({ locality: "PRIVATE_PROVIDER_BODY" }),
  },
  {
    kind: "network failure",
    expected: "Server request failed",
    reply: () => {
      throw new Error("PRIVATE_PROVIDER_BODY");
    },
  },
])("returns a plain client error for $kind", async ({ reply, expected }) => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => reply()),
  );
  await expect(
    extractAddress(await testHouseholdKeys(), { wayToTheDoor: "near Temple", language: "en" }),
  ).rejects.toThrow(expected);
});

it("validates input before signing or sending it", async () => {
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  await expect(
    extractAddress(await testHouseholdKeys(), { wayToTheDoor: "", language: "en" }),
  ).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
});

it("retries a model-unavailable 502 with a fresh request, but never the spend cap", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const unavailable = () =>
    Response.json({ code: "address_unavailable", error: "Address extraction unavailable" }, { status: 502 });
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(unavailable())
    .mockResolvedValueOnce(unavailable())
    .mockImplementation(async () => Response.json(parts));
  vi.stubGlobal("fetch", network);
  const keys = await testHouseholdKeys();
  await expect(extractAddress(keys, { wayToTheDoor: "near Temple", language: "en" })).resolves.toEqual(parts);
  expect(network).toHaveBeenCalledTimes(3);

  network.mockReset();
  network.mockImplementation(async () => unavailable());
  await expect(extractAddress(keys, { wayToTheDoor: "near Temple", language: "en" })).rejects.toMatchObject({
    status: 502,
    code: "address_unavailable",
  });
  expect(network).toHaveBeenCalledTimes(3);

  network.mockReset();
  network.mockResolvedValue(
    Response.json({ code: "spend_limit", error: "Daily spend limit reached" }, { status: 429 }),
  );
  await expect(extractAddress(keys, { wayToTheDoor: "near Temple", language: "en" })).rejects.toMatchObject({
    status: 429,
  });
  expect(network).toHaveBeenCalledTimes(1);
});
