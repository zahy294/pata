import { vi } from "vitest";

/** Test-only KV boundary: real adapter code reads and writes this memory store. */
export function memoryCache() {
  const values = new Map<string, string>();
  const kv = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, _options?: { expirationTtl?: number }) => {
      values.set(key, value);
    }),
  };
  return { kv, values };
}
