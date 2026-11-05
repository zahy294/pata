// Real network smoke test. No mocked RPC responses, no developer-only route.
import { expect, test } from "@playwright/test";
import { NOX_SPECIFIER } from "../shared/constants";

test.use({ channel: "chrome", trace: "off" });

test("lookup diagnostics boots Nox and reads Sepolia and Rabdi", async ({ page }) => {
  test.setTimeout(150_000);
  const directRpcCalls: { chain: string; method: string; specifier: boolean }[] = [];
  const sepoliaHost = new URL(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  ).host;
  const arkivHost = new URL(
    process.env.NEXT_PUBLIC_ARKIV_RPC_URL ?? "https://rpc.rabdi.db-chain.testnet.arkiv.network",
  ).host;
  page.on("request", (request) => {
    const host = new URL(request.url()).host;
    if (request.method() !== "POST" || (host !== sepoliaHost && host !== arkivHost)) return;
    const calls = request.postDataJSON();
    for (const call of Array.isArray(calls) ? calls : [calls]) {
      directRpcCalls.push({
        chain: host === sepoliaHost ? "sepolia" : "arkiv",
        method: call.method,
        specifier: call.params?.[0]?.to?.toLowerCase() === NOX_SPECIFIER.toLowerCase(),
      });
    }
  });
  await page.goto("/lookup/?debug=1");
  const trigger = page.getByRole("button", { name: "Run private RPC read checks" });
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  const report = page.getByTestId("rpc-read-report");
  await expect(report).toBeVisible({ timeout: 120_000 });
  const result = JSON.parse((await report.textContent()) ?? "{}");
  result.directRpcCalls = directRpcCalls;
  await test
    .info()
    .attach("rpc-read-results", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  expect(result.checks.map((check: { name: string }) => check.name)).toEqual([
    "Nox ready",
    "Sepolia chain ID",
    "ENS registry status",
    "Rabdi chain ID",
    "Arkiv owner query",
  ]);
  expect(
    result.checks.every((check: { ok: boolean }) => check.ok),
    JSON.stringify(result),
  ).toBe(true);
  expect(directRpcCalls).toEqual([
    { chain: "sepolia", method: "eth_call", specifier: true },
    { chain: "sepolia", method: "eth_call", specifier: true },
  ]);
  expect(
    result.methods.some(
      (entry: { via: string; chain: string }) => entry.via === "nox" && entry.chain === "arkiv",
    ),
  ).toBe(true);
});

test("RPC diagnostics are hidden on ordinary lookup visits", async ({ page }) => {
  await page.goto("/lookup/");
  await expect(page.getByRole("button", { name: "Run private RPC read checks" })).toHaveCount(0);
});
