// Courier view end to end (P0-11). Owner: frontend.
import { expect, test } from "@playwright/test";

test("the courier page loads", async ({ page }) => {
  await page.goto("/c/");
  await expect(page.getByRole("heading")).toBeVisible();
});

test.fixme("a live link shows the pin, then only the locality after the grant ends", async () => {});
test.fixme("the # part is gone from the address bar after load", async () => {});
test.fixme("no request goes to a host outside the connect-src list (CROPS proof)", async () => {});
