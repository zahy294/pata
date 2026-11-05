import { defineConfig } from "vitest/config";

// Opt-in: transfers 0.1 Rabdi tGLM from the development wallet to a fresh throwaway household.
export default defineConfig({
  test: { include: ["src/lib/arkiv/records.fork.test.ts"], environment: "node" },
});
