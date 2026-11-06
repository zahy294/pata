import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("pata.intro.seen.v1", "1"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

test("reduced motion makes navigation immediate without a page reveal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  await page.getByRole("link", { name: "Lookup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  expect(
    await page.locator(".pata-app-content").evaluate((node) => node.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

test("internal navigation reveals the arriving page while the header stays anchored", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  const header = page.locator("header");
  const before = await header.boundingBox();
  // Sample in-browser before the click: a 300 ms reveal may finish before a
  // busy test runner receives the new heading's visibility acknowledgement.
  const observedReveal = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const deadline = performance.now() + 5000;
        const sample = () => {
          const main = document.querySelector("main");
          for (let node: Element | null = main; node && node !== document.body; node = node.parentElement) {
            if (node.getAnimations().some((animation) => animation.playState === "running")) {
              resolve(true);
              return;
            }
          }
          if (performance.now() >= deadline) resolve(false);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  await page.getByRole("link", { name: "Lookup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  expect(await observedReveal).toBe(true);
  expect(await header.boundingBox()).toEqual(before);
  expect(await header.evaluate((node) => node.getAnimations().length)).toBe(0);
});

test("direct loads and courier fragment handling do not replay a route reveal", async ({ page }) => {
  await page.goto("/lookup/");
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  expect(
    await page.locator(".pata-app-content").evaluate((node) => node.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.goto("/c/#not-a-valid-grant");
  await expect(page.getByText("This link doesn't work")).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("#");
  expect(
    await page.locator(".pata-app-content").evaluate((node) => node.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("rapid navigation settles on an interactive page without a stuck overlay", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("link", { name: "Lookup", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
    await page.getByRole("link", { name: "Pata home" }).click();
    await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  }
  await expect
    .poll(() =>
      page.locator(".pata-app-content").evaluate((node) => node.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
  await page.getByRole("link", { name: "Lookup", exact: true }).click();
  const input = page.getByRole("textbox").first();
  await input.fill("my-home");
  await expect(input).toHaveValue("my-home");
  await expect(input).toBeFocused();
});

test("Back and Forward retain the router's normal page history", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  await page.getByRole("link", { name: "Lookup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  await expect(page).toHaveURL(/\/lookup\/?$/);
});

test("turning on reduced motion cancels an active reveal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  // Hold motion inside the browser as soon as it starts, before runner latency
  // can consume the entire 300 ms reveal under parallel test load.
  const heldReveal = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const deadline = performance.now() + 5000;
        const sample = () => {
          const animations = document.querySelector(".pata-app-content")!.getAnimations({ subtree: true });
          if (animations.length) {
            animations.forEach((animation) => animation.pause());
            resolve(true);
          } else if (performance.now() < deadline) requestAnimationFrame(sample);
          else resolve(false);
        };
        requestAnimationFrame(sample);
      }),
  );
  await page.getByRole("link", { name: "Lookup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  expect(await heldReveal).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.locator(".pata-app-content").evaluate((node) => node.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
});

test("navigation stays usable when browser animation support is absent", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Element.prototype, "animate", { value: undefined }));
  await page.goto("/lookup/");
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  await page.getByRole("link", { name: "Pata home" }).click();
  await expect(page.getByRole("heading", { name: "Your door, shared only by consent." })).toBeVisible();
  await page.getByRole("link", { name: "Lookup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Look up a name" })).toBeVisible();
  await page.getByRole("textbox").first().fill("my-home");
  await expect(page.getByRole("textbox").first()).toHaveValue("my-home");
});
