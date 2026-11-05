// P0-4 (AI/ML). Red-green-refactor: replace each todo with a failing test, then make it pass.
import { describe, expect, it } from "vitest";
import { decodeDigipin, encodeDigipin, isValidDigipin } from "./index";
import vectors from "./vectors.json";

describe("digipin", () => {
  it("encodes Dak Bhawan (28.622788, 77.213033) to 39J49LL8T4", () => {
    expect(encodeDigipin({ lat: 28.622788, lon: 77.213033 })).toBe("39J49LL8T4");
  });
  it.each(vectors.encode)("encodes $name", ({ lat, lon, code }) => {
    expect(encodeDigipin({ lat, lon })).toBe(code);
  });
  it("decodes a code to a numeric cell that contains the original point", () => {
    const cell = decodeDigipin("39J49LL8T4");
    expect(cell.southWest.lat).toBeLessThanOrEqual(28.622788);
    expect(cell.northEast.lat).toBeGreaterThan(28.622788);
    expect(cell.southWest.lon).toBeLessThanOrEqual(77.213033);
    expect(cell.northEast.lon).toBeGreaterThan(77.213033);
    expect(cell.center.lat).toBeGreaterThan(cell.southWest.lat);
    expect(cell.center.lat).toBeLessThan(cell.northEast.lat);
    expect(cell.center.lon).toBeGreaterThan(cell.southWest.lon);
    expect(cell.center.lon).toBeLessThan(cell.northEast.lon);
  });
  it("round-trips 1,000 seeded points inside the bounds", () => {
    let seed = 0x50415441;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 1000; i++) {
      const point = { lat: 2.5 + random() * 36, lon: 63.5 + random() * 36 };
      const code = encodeDigipin(point);
      const cell = decodeDigipin(code);
      expect(cell.southWest.lat).toBeLessThanOrEqual(point.lat);
      expect(cell.northEast.lat).toBeGreaterThan(point.lat);
      expect(cell.southWest.lon).toBeLessThanOrEqual(point.lon);
      expect(cell.northEast.lon).toBeGreaterThan(point.lon);
      expect(encodeDigipin(cell.center)).toBe(code);
    }
  });
  it.each(vectors.decode)("decodes published centre: $name", ({ code, lat, lon }) => {
    const { center } = decodeDigipin(code);
    expect(center.lat.toFixed(6)).toBe(lat.toFixed(6));
    expect(center.lon.toFixed(6)).toBe(lon.toFixed(6));
  });
  it.each([
    { lat: 2.5, lon: 63.5, code: "LLLLLLLLLL" },
    { lat: 2.5, lon: 99.5, code: "TTTTTTTTTT" },
    { lat: 38.5, lon: 63.5, code: "FFFFFFFFFF" },
    { lat: 38.5, lon: 99.5, code: "8888888888" },
  ])("includes outer corner $lat, $lon", ({ lat, lon, code }) => {
    expect(encodeDigipin({ lat, lon })).toBe(code);
    const cell = decodeDigipin(code);
    expect(cell.southWest.lat).toBeLessThanOrEqual(lat);
    expect(cell.northEast.lat).toBeGreaterThanOrEqual(lat);
    expect(cell.southWest.lon).toBeLessThanOrEqual(lon);
    expect(cell.northEast.lon).toBeGreaterThanOrEqual(lon);
  });
  it("assigns internal grid lines to the north and east cells", () => {
    // Midpoints of the entire grid, and one final-level cell away in each direction.
    const step = 0.000034332275390625;
    const cell = decodeDigipin(encodeDigipin({ lat: 20.5, lon: 81.5 }));
    expect(cell.southWest).toEqual({ lat: 20.5, lon: 81.5 });
    expect(cell.northEast).toEqual({ lat: 20.5 + step, lon: 81.5 + step });
    const southWest = decodeDigipin(encodeDigipin({ lat: 20.5 - step / 2, lon: 81.5 - step / 2 }));
    expect(southWest.northEast).toEqual({ lat: 20.5, lon: 81.5 });
  });
  it.each([
    { lat: 2.499999, lon: 77 },
    { lat: 38.500001, lon: 77 },
    { lat: 19, lon: 63.499999 },
    { lat: 19, lon: 99.500001 },
    { lat: NaN, lon: 77 },
    { lat: 19, lon: NaN },
    { lat: Infinity, lon: 77 },
    { lat: 19, lon: -Infinity },
  ])("rejects out-of-range or non-finite point $lat, $lon", (point) => {
    expect(() => encodeDigipin(point)).toThrow(RangeError);
  });
  it.each(vectors.invalid)("rejects invalid code %j", (code) => {
    expect(isValidDigipin(code)).toBe(false);
  });
  it.each(["39J49LL8T4", "39j49ll8t4", " 39J 49LL 8T4 "])("accepts valid code %j", (code) => {
    expect(isValidDigipin(code)).toBe(true);
  });
  it("decodes lowercase and display-spaced codes to the same cell", () => {
    const canonical = decodeDigipin("39J49LL8T4");
    expect(decodeDigipin("39j49ll8t4")).toEqual(canonical);
    expect(decodeDigipin("39J 49LL 8T4")).toEqual(canonical);
  });
  it.each(vectors.invalid)("refuses to decode invalid code %j", (code) => {
    expect(() => decodeDigipin(code)).toThrow("Invalid DIGIPIN");
  });
  it.todo("toGridLabel lowercases; formatDigipin prints 3-4-3 with spaces");
});
