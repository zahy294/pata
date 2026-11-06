import { defineConfig } from "vitest/config";
// Explicit opt-in: funds one throwaway household on Sepolia/Rabdi; no Cloudflare resources.
export default defineConfig({ test: { include: ["src/lib/ens/grants.fork.test.ts"], environment: "node" } });
