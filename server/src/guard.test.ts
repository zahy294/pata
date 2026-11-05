import { afterEach, expect, it, vi } from "vitest";
import { chargeSpend, guard } from "./guard";
import { testEnv } from "./test-env";
import worker from "./index";
import { privateKeyToAccount } from "viem/accounts";
import { sha256, toHex } from "viem";
import { SIGNATURE_HEADERS, signedMessage } from "../../shared/api";

const account = privateKeyToAccount(`0x${"02".repeat(32)}`);
async function signed(
  body = '{ "chain": "sepolia" }',
  timestamp = Math.floor(Date.now() / 1000),
  route = "/topup",
) {
  const signature = await account.signMessage({
    message: signedMessage(route, timestamp, sha256(toHex(body)).slice(2)),
  });
  return new Request(`https://worker.test${route}`, {
    method: "POST",
    body,
    headers: {
      [SIGNATURE_HEADERS.address]: account.address,
      [SIGNATURE_HEADERS.timestamp]: String(timestamp),
      [SIGNATURE_HEADERS.signature]: signature,
    },
  });
}

it("accepts a household signature with no Origin and preserves exact body bytes", async () => {
  const result = await guard(await signed(), testEnv(), () => {});
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.ctx.household).toBe(account.address);
    expect(new TextDecoder().decode(result.ctx.body)).toBe('{ "chain": "sepolia" }');
  }
});

const execution = { waitUntil() {} } as unknown as ExecutionContext;

it("rejects missing headers, forged signers, tampered bodies and stale or future timestamps", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
  const env = testEnv();
  const original = await signed();
  const forged = new Headers(original.headers);
  forged.set(SIGNATURE_HEADERS.address, privateKeyToAccount(`0x${"03".repeat(32)}`).address);
  const malformed = new Headers(original.headers);
  malformed.set(SIGNATURE_HEADERS.signature, "0x1234");
  for (const request of [
    new Request(original.url, { method: "POST" }),
    new Request(original.url, { method: "POST", body: "{}", headers: original.headers }),
    new Request(original.url, { method: "POST", body: '{ "chain": "sepolia" }', headers: forged }),
    new Request(original.url, { method: "POST", body: "{}", headers: malformed }),
    await signed("{}", Math.floor(Date.now() / 1000) - 121),
    await signed("{}", Math.floor(Date.now() / 1000) + 130),
  ]) {
    const result = await guard(request, env, () => {});
    expect(result.ok ? 200 : result.response.status).toBe(401);
    vi.setSystemTime(Date.now() + 1000);
  }
});

it("keeps health alive during shutdown and adds CORS to errors", async () => {
  const env = testEnv();
  env.KILL_SWITCH = "on";
  const health = await worker.fetch(new Request("https://worker.test/health"), env, execution);
  expect(health.status).toBe(200);
  const response = await worker.fetch(
    new Request("https://worker.test/topup", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
    env,
    execution,
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
});

it("allows 30 requests per IP per minute, then resets the window", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
  const env = testEnv();
  for (let i = 0; i < 30; i++) {
    expect((await guard(await signed(), env, () => {})).ok).toBe(true);
    vi.setSystemTime(Date.now() + 1000);
  }
  const blocked = await guard(await signed(), env, () => {});
  expect(blocked.ok ? 200 : blocked.response.status).toBe(429);
  vi.setSystemTime(new Date("2026-11-06T00:01:00Z"));
  expect((await guard(await signed(), env, () => {})).ok).toBe(true);
});

it("answers allowed preflights and rejects disallowed origins", async () => {
  const env = testEnv();
  const preflight = await worker.fetch(
    new Request("https://worker.test/topup", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" },
    }),
    env,
    execution,
  );
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-headers")).toContain("x-pata-signature");
  const denied = await worker.fetch(
    new Request("https://worker.test/topup", {
      method: "POST",
      headers: { origin: "https://attacker.test" },
    }),
    env,
    execution,
  );
  expect(denied.status).toBe(403);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("refuses spending beyond the cap and starts a fresh UTC date", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T23:59:58Z"));
  const env = testEnv();
  expect(await chargeSpend(env, 2)).toBe(true);
  expect(await chargeSpend(env, 2)).toBe(false);
  vi.setSystemTime(new Date("2026-11-06T23:59:59Z"));
  expect(await chargeSpend(env, 1)).toBe(true);
  expect(await chargeSpend(env, 0.01)).toBe(false);
  vi.setSystemTime(new Date("2026-11-07T00:00:00Z"));
  expect(await chargeSpend(env, 3)).toBe(true);
  expect(await chargeSpend(env, -1)).toBe(false);
  expect(await chargeSpend(env, NaN)).toBe(false);
});

it("serializes concurrent spend charges and respects KV's per-key write interval", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
  const env = testEnv();
  const put = env.PATA_KV.put.bind(env.PATA_KV);
  let lastWrite = -Infinity;
  env.PATA_KV.put = async (key, value, options) => {
    if (Date.now() - lastWrite < 1000) throw new Error("KV write rate exceeded");
    lastWrite = Date.now();
    return put(key, value, options);
  };
  const work = Promise.all([chargeSpend(env, 1), chargeSpend(env, 1), chargeSpend(env, 2)]);
  await vi.runAllTimersAsync();
  expect(await work).toEqual([true, true, false]);
});

it("blocks requests when the kill switch is on", async () => {
  const env = testEnv();
  env.KILL_SWITCH = "on";
  const result = await guard(new Request("https://worker.test/topup", { method: "POST" }), env, () => {});
  expect(result.ok ? 200 : result.response.status).toBe(503);
});
