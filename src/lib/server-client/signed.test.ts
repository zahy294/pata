import { afterEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { sha256, toHex, verifyMessage } from "viem";
import { SIGNATURE_HEADERS, signedMessage } from "../../../shared/api";
import { deriveHouseholdKeys } from "../keys";
import { topup, registerName } from "./index";
import { signedPost } from "./signed";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("topup signs the exact posted body and parses the balance", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test/");
  const keys = await deriveHouseholdKeys(new Uint8Array(32).fill(7));
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ txHash: null, balanceWei: "123" }));
  vi.stubGlobal("fetch", network);
  expect(await topup(keys, { chain: "arkiv" })).toEqual({ txHash: null, balanceWei: "123" });
  const [url, init] = network.mock.calls[0];
  expect(url).toBe("https://worker.test/topup");
  const headers = new Headers(init?.headers);
  expect(init?.method).toBe("POST");
  expect(headers.get("content-type")).toBe("application/json");
  expect(headers.get(SIGNATURE_HEADERS.address)).toBe(keys.address);
  const body = await new Response(init?.body).arrayBuffer();
  expect(new TextDecoder().decode(body)).toBe('{"chain":"arkiv"}');
  expect(
    await verifyMessage({
      address: keys.address,
      message: signedMessage(
        "/topup",
        Number(headers.get(SIGNATURE_HEADERS.timestamp)),
        sha256(toHex(new Uint8Array(body))).slice(2),
      ),
      signature: headers.get(SIGNATURE_HEADERS.signature) as `0x${string}`,
    }),
  ).toBe(true);
});

it("registerName posts the deployment addresses and parses the transaction hash", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const keys = await deriveHouseholdKeys(new Uint8Array(32).fill(7));
  const hash = `0x${"aa".repeat(32)}`;
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ txHash: hash }));
  vi.stubGlobal("fetch", network);
  const request = { label: "sana", resolver: keys.address, grantRegistry: keys.address };
  expect(await registerName(keys, request)).toEqual({ txHash: hash });
  expect(network.mock.calls[0][0]).toBe("https://worker.test/register");
  expect(JSON.parse(String(network.mock.calls[0][1]?.body))).toEqual(request);
});

it("accepts ownership-confirmed registration success without a saved hash", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const keys = await deriveHouseholdKeys(new Uint8Array(32).fill(7));
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ txHash: null })));
  expect(
    await registerName(keys, { label: "sana", resolver: keys.address, grantRegistry: keys.address }),
  ).toEqual({ txHash: null });
});

it("signs raw audio bytes and binds the speech language query", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const keys = await deriveHouseholdKeys(new Uint8Array(32).fill(7));
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ transcript: "ok" }));
  vi.stubGlobal("fetch", network);
  const audio = new Blob([new Uint8Array([0, 255, 1, 128])], { type: "audio/webm" });
  await signedPost(keys, "/speech/in?lang=hi", audio, audio.type);
  const [url, init] = network.mock.calls[0];
  expect(url).toBe("https://worker.test/speech/in?lang=hi");
  const headers = new Headers(init?.headers);
  expect(headers.get("content-type")).toBe("audio/webm");
  const body = new Uint8Array(await new Response(init?.body).arrayBuffer());
  expect([...body]).toEqual([0, 255, 1, 128]);
  expect(
    await verifyMessage({
      address: keys.address,
      message: signedMessage(
        "/speech/in?lang=hi",
        Number(headers.get(SIGNATURE_HEADERS.timestamp)),
        sha256(toHex(body)).slice(2),
      ),
      signature: headers.get(SIGNATURE_HEADERS.signature) as `0x${string}`,
    }),
  ).toBe(true);
});

it("drops upstream failures and rejects malformed successful replies", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const keys = await deriveHouseholdKeys(new Uint8Array(32).fill(7));
  const network = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", network);
  network.mockResolvedValueOnce(new Response("PRIVATE_ERROR_BODY", { status: 503 }));
  await expect(topup(keys, { chain: "arkiv" })).rejects.toThrow(/^Server request failed$/);
  network.mockRejectedValueOnce(new Error("PRIVATE_NETWORK_KEY"));
  await expect(topup(keys, { chain: "arkiv" })).rejects.toThrow(/^Server request failed$/);
  network.mockResolvedValueOnce(Response.json({ txHash: null, balanceWei: 123 }));
  await expect(topup(keys, { chain: "arkiv" })).rejects.toThrow(/^Invalid server response$/);
  network.mockResolvedValueOnce(Response.json({ txHash: "PRIVATE_BAD_HASH" }));
  await expect(
    registerName(keys, { label: "sana", resolver: keys.address, grantRegistry: keys.address }),
  ).rejects.toThrow(/^Invalid server response$/);
});
