// Bindings the Worker receives. Vars come from wrangler.jsonc; secrets from `wrangler secret put`.
// Every name here is also listed in .env.example.
export interface Env {
  // Secrets
  ANTHROPIC_API_KEY: string;
  SARVAM_API_KEY: string;
  RELAY_PRIVATE_KEY: `0x${string}`;
  ARKIV_ACCESS_KEY: string;
  // Vars
  ALLOWED_ORIGINS: string;
  KILL_SWITCH: "on" | "off";
  DAILY_SPEND_CAP_CENTS: string;
  PATA_REGISTRY_ADDRESS: string;
  SEPOLIA_RPC_URL: string;
  ARKIV_RPC_URL: string;
  // KV: rate limits, spend counter, Nominatim/Overpass cache
  PATA_KV: KVNamespace;
}

/** What a route handler gets after the guard has passed. */
export interface RouteContext {
  env: Env;
  /** The household address that signed the request (checked by the guard). */
  household: `0x${string}`;
  /** Cloudflare's trusted client IP, never supplied in the signed JSON body. */
  ip: string;
  /** Raw body bytes, already read once by the guard to check the signature. */
  body: ArrayBuffer;
  url: URL;
  waitUntil(promise: Promise<unknown>): void;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response>;
