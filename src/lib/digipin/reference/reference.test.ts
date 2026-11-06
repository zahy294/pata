import { describe, expect, it } from "vitest";
import { decodeDigipin, encodeDigipin } from "../index";
import fixtures from "./fixtures.json";

describe("pinned India Post reference fixtures", () => {
  it("matches 1,000 independently generated interior encodes and decoded centres", () => {
    const interior = fixtures.cases.filter(({ label }) => label.startsWith("interior-"));
    expect(interior).toHaveLength(1000);
    for (const vector of interior) {
      expect(encodeDigipin({ lat: vector.lat, lon: vector.lon }), vector.label).toBe(vector.code);
      const { center } = decodeDigipin(vector.code);
      expect(center.lat.toFixed(6), vector.label).toBe(vector.latitude);
      expect(center.lon.toFixed(6), vector.label).toBe(vector.longitude);
    }
  });

  it("matches independent boundary, outer-edge and named-place fixtures", () => {
    const boundaries = fixtures.cases.filter(({ label }) => !label.startsWith("interior-"));
    expect(boundaries).toHaveLength(62);
    for (const vector of boundaries) {
      expect(encodeDigipin({ lat: vector.lat, lon: vector.lon }), vector.label).toBe(vector.code);
      const { center } = decodeDigipin(vector.code);
      expect(center.lat.toFixed(6), vector.label).toBe(vector.latitude);
      expect(center.lon.toFixed(6), vector.label).toBe(vector.longitude);
    }
  });
});
