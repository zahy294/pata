import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  // Exercise the real lookup screen while external networking remains pending.
  const appOrigin = new URL(baseURL!).origin;
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === appOrigin) return route.continue();
    // Unhandled external requests remain pending until this isolated page closes.
  });
});

test("reduced-motion loading uses a still location pin", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/lookup/");
  await page.getByRole("textbox", { name: "Home Name or Grid Code" }).fill("blue-gate");
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  const loader = page.getByRole("button", { name: "Searching…" }).locator(".pata-morph-loader");
  const pin = loader.locator(".pata-morph-loader__pin");
  await expect(pin).toHaveCSS("opacity", "1");
  const initial = await loader.locator(".pata-morph-loader__shape").getAttribute("style");
  await page.clock.runFor(3000);
  expect(await loader.locator(".pata-morph-loader__shape").getAttribute("style")).toBe(initial);
  await expect(pin).toHaveCSS("opacity", "1");
});

test("the loader changes shape and includes the supplied location icon in its cycle", async ({ page }) => {
  await page.clock.install();
  await page.goto("/lookup/");
  await page.getByRole("textbox", { name: "Home Name or Grid Code" }).fill("blue-gate");
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  const loader = page.getByRole("button", { name: "Searching…" }).locator(".pata-morph-loader");
  const shape = loader.locator(".pata-morph-loader__shape");
  const initial = await shape.evaluate((node) => getComputedStyle(node).clipPath);
  await page.clock.runFor(850);
  await expect.poll(() => shape.evaluate((node) => getComputedStyle(node).clipPath)).not.toBe(initial);
  await page.clock.runFor(850 * 6);
  const pin = loader.locator(".pata-morph-loader__pin");
  await expect(pin).toHaveCSS("opacity", "1");
  expect(await pin.evaluate((node) => getComputedStyle(node).maskImage)).toContain("loading-location.png");
});

test("a green loading button uses the morph loader while preserving its text and disabled state", async ({
  page,
}) => {
  await page.goto("/lookup/");
  await page.getByRole("textbox", { name: "Home Name or Grid Code" }).fill("blue-gate");
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  const searching = page.getByRole("button", { name: "Searching…" });
  await expect(searching).toBeDisabled();
  await expect(searching.locator(".pata-morph-loader")).toBeVisible();
  await expect(page.getByText("Looking up public neighbourhood record…")).toBeVisible();
});
