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

export type GuardResult = { ok: true; ctx: RouteContext } | { ok: false; response: Response };

export async function guard(request: Request, env: Env, waitUntil: (p: Promise<unknown>) => void): Promise<GuardResult> {
  void request;
  void env;
  void waitUntil;
  throw new Error("guard: not implemented (P0-6)");
}

/** Adds the request's cost to today's counter; returns false if the cap is reached. */
export async function chargeSpend(env: Env, cents: number): Promise<boolean> {
  void env;
  void cents;
  throw new Error("chargeSpend: not implemented (P0-6)");
}
