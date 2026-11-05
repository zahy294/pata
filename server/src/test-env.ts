import type { Env } from "./env";

/** Test-only bindings. No real secrets or network endpoints. */
export function testEnv(): Env {
  const values = new Map<string, string>();
  const kv = {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
  return {
    ANTHROPIC_API_KEY: "",
    SARVAM_API_KEY: "",
    ARKIV_ACCESS_KEY: "test-key",
    RELAY_PRIVATE_KEY: `0x${"01".repeat(32)}`,
    ALLOWED_ORIGINS: "http://localhost:3000",
    KILL_SWITCH: "off",
    DAILY_SPEND_CAP_CENTS: "3",
    PATA_REGISTRY_ADDRESS: `0x${"11".repeat(20)}`,
    SEPOLIA_RPC_URL: "https://sepolia.example",
    ARKIV_RPC_URL: "https://arkiv.example",
    PATA_KV: kv as KVNamespace,
  };
}
