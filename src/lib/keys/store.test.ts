import { describe, expect, it } from "vitest";
import {
  loadDeviceRoot,
  loadHouseholdState,
  saveDeviceRoot,
  saveHouseholdState,
  loadSetupCheckpoint,
  saveSetupCheckpoint,
  loadRevocationCheckpoint,
  saveRevocationCheckpoint,
} from "./store";

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
    expect(await loadSetupCheckpoint("0x01")).toBeNull();
    expect(await loadRevocationCheckpoint("0x01", "0x02")).toBeNull();
    await expect(
      saveRevocationCheckpoint("0x01", "0x02", { sealedHistory: new Uint8Array([1]) }),
    ).rejects.toThrow("Device storage is unavailable");
    await expect(
      saveSetupCheckpoint("0x01", { name: "sana.pata.eth", sealedHome: new Uint8Array([1]) }),
    ).rejects.toThrow("Device storage is unavailable");
  });
});
