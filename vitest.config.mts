// Unit tests for the app, shared code and the server. Playwright (e2e/) and Foundry (contracts/) run separately.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "shared/**/*.test.ts", "server/src/**/*.test.ts"],
    exclude: ["node_modules/**", "contracts/**", "e2e/**", "out/**", ".next/**"],
    environment: "node",
  },
});
