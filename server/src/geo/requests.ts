/** Minimal KV boundary; a Cloudflare KVNamespace satisfies this interface. */
export interface GeoCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export const GEO_USER_AGENT = "Pata/0.1 (ETHGlobal Mumbai hackathon; https://github.com/zahy294/pata)";
export const GEO_CACHE_SECONDS = 30 * 24 * 60 * 60;

const queues = new WeakMap<GeoCache, Map<string, Promise<unknown>>>();

/** Serialize one service within this isolate, including full response consumption. */
export function queuedGeo<T>(kv: GeoCache, service: string, work: () => Promise<T>): Promise<T> {
  let services = queues.get(kv);
  if (!services) {
    services = new Map();
    queues.set(kv, services);
  }
  const result = (services.get(service) ?? Promise.resolve()).then(work);
  services.set(
    service,
    result.catch(() => undefined),
  );
  return result;
}

export async function geoCacheKey(service: string, input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return `geo:v1:${service}:${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const nextStarts = new WeakMap<GeoCache, Map<string, number>>();
export const geoDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Best-effort persisted pacing, NOT an atomic cross-isolate rate limiter. */
export async function paceGeo(kv: GeoCache, service: string): Promise<void> {
  let starts = nextStarts.get(kv);
  if (!starts) {
    starts = new Map();
    nextStarts.set(kv, starts);
  }
  const key = `geo:pacing:${service}`;
  const saved = Number(await kv.get(key));
  const cooldown = Number(await kv.get(`geo:cooldown:${service}`));
  const next = Math.max(
    starts.get(service) ?? 0,
    Number.isFinite(saved) ? saved : 0,
    Number.isFinite(cooldown) ? cooldown : 0,
  );
  if (next > Date.now()) await geoDelay(next - Date.now());
  const nextStart = Date.now() + 1000;
  starts.set(service, nextStart);
  await kv.put(key, String(nextStart), { expirationTtl: 60 });
}

export async function backoffGeo(kv: GeoCache, service: string, retryAfter: string | null): Promise<void> {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter ?? "") - Date.now();
  const ms = Math.max(30000, Number.isFinite(requested) ? requested : 0);
  let starts = nextStarts.get(kv);
  if (!starts) {
    starts = new Map();
    nextStarts.set(kv, starts);
  }
  const next = Math.max(starts.get(service) ?? 0, Date.now() + ms);
  starts.set(service, next);
  // A separate key avoids two writes to the pacing key within one second on a fast failure.
  await kv.put(`geo:cooldown:${service}`, String(next), { expirationTtl: Math.ceil(ms / 1000) + 60 });
}
