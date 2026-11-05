// P0-4 (AI/ML). Red-green-refactor: replace each todo with a failing test, then make it pass.
import { describe, expect, it } from "vitest";
import { encodeDigipin } from "./index";
import vectors from "./vectors.json";

describe("digipin", () => {
  it("encodes Dak Bhawan (28.622788, 77.213033) to 39J49LL8T4", () => {
    expect(encodeDigipin({ lat: 28.622788, lon: 77.213033 })).toBe("39J49LL8T4");
  });
  it.each(vectors.encode)("encodes $name", ({ lat, lon, code }) => {
    expect(encodeDigipin({ lat, lon })).toBe(code);
  });
  it.todo("decodes a code to a cell that contains the original point");
  it.todo("round-trips random points inside the bounds");
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
  it.todo("rejects every code in vectors.json invalid");
  it.todo("toGridLabel lowercases; formatDigipin prints 3-4-3 with spaces");
});
