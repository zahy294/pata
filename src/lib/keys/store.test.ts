import { describe, expect, it } from "vitest";
import { loadDeviceRoot, loadHouseholdState, saveDeviceRoot, saveHouseholdState } from "./store";

describe("device storage outside a browser", () => {
  it("refuses to silently discard writes when IndexedDB is unavailable", async () => {
    await expect(saveDeviceRoot(new Uint8Array(32))).rejects.toThrow("Device storage is unavailable");
    await expect(
      saveHouseholdState({
        name: "test.pata.eth",
        resolver: "0x01",
        grantRegistry: "0x02",
        homeRecordKey: "0x03",
      }),
    ).rejects.toThrow("Device storage is unavailable");
  });
  it("loads no household when IndexedDB is unavailable", async () => {
    expect(typeof indexedDB).toBe("undefined");
    expect(await loadDeviceRoot()).toBeNull();
    expect(await loadHouseholdState()).toBeNull();
  });
});
