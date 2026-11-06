// Real IndexedDB, exercised only through the public store API. No fake database package.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

const source = transpileModule(readFileSync("src/lib/keys/store.ts", "utf8"), {
  compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
}).outputText;

test.beforeEach(async ({ page }) => {
  await page.route("https://pata.test/**", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith("store.js") ? "text/javascript" : "text/html",
      body: route.request().url().endsWith("store.js")
        ? source
        : "<!doctype html><title>Device storage test</title>",
    }),
  );
  await page.goto("https://pata.test/");
});

test("a new device has no root or household state", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    return [await store.loadDeviceRoot(), await store.loadHouseholdState()];
  });
  expect(result).toEqual([null, null]);
});

test("setup checkpoints survive reload, retain sealed bytes and are separated by household address", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    await store.saveSetupCheckpoint("0xAa", {
      name: "sana.pata.eth",
      sealedHome: new Uint8Array([1, 2, 3]),
      registrationHash: "0x99",
      pending: "register",
    });
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    const checkpoint = await store.loadSetupCheckpoint("0xaa");
    return {
      ...checkpoint,
      sealedHome: Array.from(checkpoint.sealedHome),
      other: await store.loadSetupCheckpoint("0xbb"),
      state: await store.loadHouseholdState(),
    };
  });
  expect(result).toEqual({
    name: "sana.pata.eth",
    sealedHome: [1, 2, 3],
    registrationHash: "0x99",
    pending: "register",
    other: null,
    state: null,
  });
});

test("a device root survives reload and can be replaced", async ({ page }) => {
  await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    await store.saveDeviceRoot(Uint8Array.from({ length: 32 }, (_, i) => i));
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    const original = Array.from(await store.loadDeviceRoot());
    await store.saveDeviceRoot(new Uint8Array(32).fill(7));
    return {
      original,
      replacement: Array.from(await store.loadDeviceRoot()),
      state: await store.loadHouseholdState(),
    };
  });
  expect(result).toEqual({
    original: Array.from({ length: 32 }, (_, i) => i),
    replacement: Array(32).fill(7),
    state: null,
  });
});

test("household state survives reload without overwriting the device root", async ({ page }) => {
  await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    await store.saveDeviceRoot(new Uint8Array(32).fill(9));
    await store.saveHouseholdState({
      name: "first.pata.eth",
      resolver: "0x01",
      grantRegistry: "0x02",
      homeRecordKey: "0x03",
    });
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    const original = await store.loadHouseholdState();
    await store.saveHouseholdState({ ...original, name: "second.pata.eth" });
    return {
      original,
      replacement: await store.loadHouseholdState(),
      root: Array.from(await store.loadDeviceRoot()),
    };
  });
  expect(result).toEqual({
    original: { name: "first.pata.eth", resolver: "0x01", grantRegistry: "0x02", homeRecordKey: "0x03" },
    replacement: { name: "second.pata.eth", resolver: "0x01", grantRegistry: "0x02", homeRecordKey: "0x03" },
    root: Array(32).fill(9),
  });
});

test("rejects a malformed root without replacing the saved root", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    await store.saveDeviceRoot(new Uint8Array(32).fill(7));
    let rejected = false;
    try {
      await store.saveDeviceRoot(new Uint8Array(31));
    } catch {
      rejected = true;
    }
    return { rejected, root: Array.from(await store.loadDeviceRoot()) };
  });
  expect(result).toEqual({ rejected: true, root: Array(32).fill(7) });
});

test("an aborted write rejects and leaves the previous root intact", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    await store.saveDeviceRoot(new Uint8Array(32).fill(7));
    // Inject failure at the browser database boundary, after the request succeeds.
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
    let rejected = false;
    try {
      await store.saveDeviceRoot(new Uint8Array(32).fill(9));
    } catch {
      rejected = true;
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    return { rejected, root: Array.from(await store.loadDeviceRoot()) };
  });
  expect(result).toEqual({ rejected: true, root: Array(32).fill(7) });
});

test("lists only this household's unfinished stops, so a reload can finish them", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = "/store.js";
    const store = await import(moduleUrl);
    const mine = "0xAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaaAAaa";
    const other = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const unfinished = "0x" + "12".repeat(32);
    const finished = "0x" + "34".repeat(32);
    await store.saveRevocationCheckpoint(mine, unfinished, { sealedHistory: new Uint8Array([1, 2]) });
    await store.saveRevocationCheckpoint(mine, finished, { sealedHistory: new Uint8Array([3]), complete: true });
    await store.saveRevocationCheckpoint(other, unfinished, { sealedHistory: new Uint8Array([4]) });
    const listed = await store.listUnfinishedRevocations(mine);
    return listed.map((item: { payloadKey: string; checkpoint: { sealedHistory: Uint8Array } }) => ({
      payloadKey: item.payloadKey,
      bytes: Array.from(item.checkpoint.sealedHistory),
    }));
  });
  expect(result).toEqual([{ payloadKey: "0x" + "12".repeat(32), bytes: [1, 2] }]);
});
