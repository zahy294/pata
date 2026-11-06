// Separate from the fast npm run check gate, like the repository's other browser tests.
// Run from the repo root: npx playwright test --config src/lib/keys/store.playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "store.browser.spec.ts",
  reporter: "list",
  use: { browserName: "chromium", channel: "chrome", headless: true },
});
