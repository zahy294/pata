// Courier view end to end (P0-11). Owner: frontend.
import { expect, test } from "@playwright/test";
import { formatCourierLink } from "../src/lib/link";

const SAMPLE_LINK = formatCourierLink("http://localhost:3000", {
  householdName: "blue-gate.pata.eth",
  payloadKey:
    "0x9988776655443322110099887766554433221100998877665544332211009988",
  sessionKey: new Uint8Array(32).fill(7),
});

test("the courier page loads", async ({ page }) => {
  await page.goto("/c/");
  await expect(page.getByRole("heading", { name: "Delivery directions" })).toBeVisible();
  await expect(page.getByText("This link doesn't work")).toBeVisible();
});

test("a live link shows the pin, then only the locality after the grant ends", async ({
  page,
}) => {
  const startTime = Date.now();
  await page.clock.install({ time: startTime });

  await page.goto(SAMPLE_LINK);

  // Live state: shows locality, room number, DIGIPIN, directions text, and map
  await expect(page.getByText("Dharavi, 400017")).toBeVisible();
  await expect(page.getByText("Room 14, Chawl 3, 2nd Floor")).toBeVisible();
  await expect(page.getByText(/39J 49LL 8T4/i).or(page.getByText(/DIGIPIN/i)).first()).toBeVisible();

  // Advance clock past the 20s fake grant deadline and trigger the 3s poll interval
  await page.clock.fastForward(25_000);

  // Ended state: shows only the locality and "This link has ended", room number is gone, sessionStorage is cleared
  await expect(page.getByText("This link has ended")).toBeVisible();
  await expect(page.getByText("Dharavi, 400017")).toBeVisible();
  await expect(page.getByText("Room 14, Chawl 3, 2nd Floor")).toHaveCount(0);

  const stored = await page.evaluate(() =>
    window.sessionStorage.getItem("pata.courier.fragment"),
  );
  expect(stored).toBeNull();
});

test("the # part is gone from the address bar after load", async ({ page }) => {
  await page.goto(SAMPLE_LINK);
  await expect(page.getByText("Dharavi, 400017")).toBeVisible();

  expect(page.url()).not.toContain("#");
  const stored = await page.evaluate(() =>
    window.sessionStorage.getItem("pata.courier.fragment"),
  );
  expect(stored).toContain("blue-gate.pata.eth");
});

test.fixme("no request goes to a host outside the connect-src list (CROPS proof)", async () => {});
