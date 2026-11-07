import { defineConfig, devices } from "@playwright/test";

// Uses installed Chrome locally. CI can use the same channel or override launch options.
export default defineConfig({
  testDir: ".",
  testMatch: ["intro.spec.ts", "loader.spec.ts", "page-transitions.spec.ts"],
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
