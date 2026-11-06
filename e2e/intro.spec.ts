import { expect, test } from "@playwright/test";

test("the minimal intro places the logo left, Hindi right and keeps only the core message", async ({
  page,
}) => {
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Welcome to Pata" });
  const logo = intro.getByRole("img", { name: "Pata app icon" });
  await expect(logo).toBeVisible();
  const logoBox = await logo.boundingBox();
  const hindiBox = await intro.getByText("पता", { exact: true }).boundingBox();
  expect(logoBox!.x).toBeLessThan(hindiBox!.x);
  await expect(intro.getByRole("heading", { name: "Your door. Your say." })).toBeVisible();
  await expect(
    intro.getByText(/A little closer|Every home|Give your home a name|Share the way|shared only by consent/),
  ).toHaveCount(0);
});

test("the styled intro fills the viewport and renders the oversized wordmark", async ({ page }) => {
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Welcome to Pata" });
  await expect(intro).toBeVisible();
  const box = await intro.boundingBox();
  expect(box?.width).toBe(page.viewportSize()!.width);
  expect(box?.height).toBe(page.viewportSize()!.height);
  const fontSize = await intro
    .getByRole("heading", { name: "Pata", exact: true })
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(fontSize).toBeGreaterThan(90);
});

test("Escape skips the transition and returns focus to the home heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Enter Pata" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeFocused();
});

test("a direct courier link bypasses the intro and preserves its normal invalid-link handling", async ({
  page,
}) => {
  await page.goto("/c/#not-a-valid-grant");
  await expect(page.getByRole("heading", { name: "Delivery directions" })).toBeVisible();
  await expect(page.getByText("This link doesn't work")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Welcome to Pata" })).toHaveCount(0);
  await expect.poll(() => page.url()).not.toContain("#");
});

test("reduced motion keeps the wordmark still and enters without an animation delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Welcome to Pata" });
  await expect(intro).toBeVisible();
  expect(await intro.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
  await intro.getByRole("button", { name: "Enter Pata" }).click();
  await expect(intro).toHaveCount(0, { timeout: 200 });
});

test("a normal-motion entry opens the doorway before releasing the home screen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const enter = page.getByRole("button", { name: "Enter Pata" });
  await enter.click();
  await expect(enter).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("blocked session storage never traps the household on the intro", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Pata" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
});

test("entering is remembered for this tab session, including a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Pata" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("keyboard focus stays in the intro and moves to home after entering", async ({ page }) => {
  await page.goto("/");
  const enter = page.getByRole("button", { name: "Enter Pata" });
  await expect(enter).toBeFocused();
  await page.keyboard.press("Tab");
  // A one-button modal cycles focus without reaching the obscured app header.
  await page.keyboard.press("Tab");
  await expect(enter).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeFocused();
});

test("a new visit opens the Pata intro and Enter reveals the existing home", async ({ page }) => {
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Welcome to Pata" });
  await expect(intro).toBeVisible();
  await expect(intro.getByRole("heading", { name: "Pata", exact: true })).toBeVisible();
  await intro.getByRole("button", { name: "Enter Pata" }).click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
});
