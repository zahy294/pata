import { defineConfig } from "vitest/config";

// Explicit opt-in only: this suite spends Sepolia test ETH.
export default defineConfig({
  test: { include: ["src/lib/ens/household.fork.test.ts"], environment: "node" },
});
