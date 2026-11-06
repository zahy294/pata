import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["src/lib/ens/courier-revoke.fork.test.ts"], environment: "node" },
});
