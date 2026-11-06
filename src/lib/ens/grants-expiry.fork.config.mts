import { defineConfig } from "vitest/config";
// Read-only follow-up using the public evidence from grants.fork.test.ts. No wallet required.
export default defineConfig({
  test: { include: ["src/lib/ens/grants-expiry.fork.test.ts"], environment: "node" },
});
