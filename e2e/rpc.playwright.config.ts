// Isolated live-RPC runner: starts localhost with public defaults, never loads a wallet.
import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: ".",
  testMatch: "rpc.spec.ts",
  workers: 1,
  reporter: [["list"], ["json", { outputFile: resolve("test-results/rpc-results.json") }]],
  use: { baseURL: "http://localhost:3000", channel: "chrome", trace: "off" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SEPOLIA_RPC_URL:
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
      NEXT_PUBLIC_ARKIV_RPC_URL:
        process.env.NEXT_PUBLIC_ARKIV_RPC_URL ?? "https://rpc.rabdi.db-chain.testnet.arkiv.network",
    },
  },
});
