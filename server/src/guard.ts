// The guard runs before every route (ticket P0-6, owner).
// 1. Kill switch: KILL_SWITCH === "on" → 503 for everything but /health.
// 2. CORS: only ALLOWED_ORIGINS.
// 3. Per-IP rate limit in KV (CF-Connecting-IP), e.g. 30 requests a minute.
// 4. Household signature: SIGNATURE_HEADERS from shared/api.ts; verify with viem's verifyMessage
//    over signedMessage(route, timestamp, sha256(body)); reject timestamps older than 120 s.
// 5. Daily spend cap: model and speech routes add their estimated cost (cents) to a KV counter
//    keyed by UTC date; refuse with 429 once DAILY_SPEND_CAP_CENTS is reached.
// Never log the body. Never forward a viem error message to the client.
import type { Env, RouteContext } from "./env";
import { allowedOrigin, error } from "./http";
import { getAddress, sha256, toHex, verifyMessage } from "viem";
import { SIGNATURE_HEADERS, signedMessage } from "../../shared/api";

export type GuardResult = { ok: true; ctx: RouteContext } | { ok: false; response: Response };

const locks = new WeakMap<Env["PATA_KV"], Map<string, Promise<unknown>>>();
/** Local serialization only: KV cannot provide atomic cross-isolate counters or locks. */
export async function withKvLock<T>(env: Env, key: string, work: () => Promise<T>): Promise<T> {
  let entries = locks.get(env.PATA_KV);
  if (!entries) {
    entries = new Map();
    locks.set(env.PATA_KV, entries);
  }
  const pending = (entries.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
  entries.set(key, pending);
  try {
    return await pending;
  } finally {
    if (entries.get(key) === pending) entries.delete(key);
  }
}

const counters = new WeakMap<
  Env["PATA_KV"],
  Map<string, { value: number; written: number; expires: number }>
>();
async function addCounter(env: Env, key: string, amount: number, cap: number, ttl: number): Promise<boolean> {
  return withKvLock(env, key, async () => {
    let entries = counters.get(env.PATA_KV);
    if (!entries) {
      entries = new Map();
      counters.set(env.PATA_KV, entries);
    }
    for (const [name, entry] of entries) if (entry.expires <= Date.now()) entries.delete(name);
    const previous = entries.get(key);
    const stored = Number((await env.PATA_KV.get(key)) ?? 0);
    if (!Number.isFinite(stored) || stored < 0) return false;
    const value = Math.max(stored, previous?.value ?? 0) + amount;
    if (value > cap) return false;
    const delay = (previous?.written ?? -Infinity) + 1000 - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    await env.PATA_KV.put(key, String(value), { expirationTtl: ttl });
    entries.set(key, { value, written: Date.now(), expires: Date.now() + ttl * 1000 });
    return true;
  });
}

export async function guard(
  request: Request,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<GuardResult> {
  if (env.KILL_SWITCH === "on" && new URL(request.url).pathname !== "/health") {
    return { ok: false, response: error(503, "unavailable", "Service paused") };
  }
  if (!allowedOrigin(request, env))
    return { ok: false, response: error(403, "origin", "Origin not allowed") };
  if (request.method === "OPTIONS") return { ok: false, response: new Response(null, { status: 204 }) };
  const minute = Math.floor(Date.now() / 60000);
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (!(await addCounter(env, `rate:${minute}:${ip}`, 1, 30, 120))) {
    return { ok: false, response: error(429, "rate_limit", "Too many requests") };
  }
  const denied: GuardResult = {
    ok: false,
    response: error(401, "unauthorized", "Invalid household signature"),
  };
  try {
    const address = request.headers.get(SIGNATURE_HEADERS.address) ?? "";
    const rawTimestamp = request.headers.get(SIGNATURE_HEADERS.timestamp) ?? "";
    const signature = request.headers.get(SIGNATURE_HEADERS.signature) ?? "";
    if (
      !/^0x[0-9a-fA-F]{40}$/.test(address) ||
      !/^\d{1,12}$/.test(rawTimestamp) ||
      !/^0x[0-9a-fA-F]{130}$/.test(signature)
    )
      return denied;
    const timestamp = Number(rawTimestamp);
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 120) return denied;
    const url = new URL(request.url);
    const body = await request.arrayBuffer();
    const household = getAddress(address);
    if (
      !(await verifyMessage({
        address: household,
        message: signedMessage(
          url.pathname + url.search,
          timestamp,
          sha256(toHex(new Uint8Array(body))).slice(2),
        ),
        signature: signature as `0x${string}`,
      }))
    )
      return denied;
    return { ok: true, ctx: { env, household, ip, body, url, waitUntil } };
  } catch {
    return denied;
  }
}

/** Adds the request's cost to today's counter; returns false if the cap is reached. */
export async function chargeSpend(env: Env, cents: number): Promise<boolean> {
  const cap = Number(env.DAILY_SPEND_CAP_CENTS);
  if (
    !Number.isFinite(cents) ||
    cents < 0 ||
    !env.DAILY_SPEND_CAP_CENTS.trim() ||
    !Number.isFinite(cap) ||
    cap < 0
  )
    return false;
  return addCounter(env, `spend:${new Date().toISOString().slice(0, 10)}`, cents, cap, 172800);
}
