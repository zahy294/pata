// Owner: AI/ML (P0-7). Plain geometry must be exact to the metre: pin distances are a judging claim.
import { describe, expect, it } from "vitest";
import { bearingDegrees, distanceMetres, nearestPointOnLine, offsetPoint, pinsDisagree } from "./geo";

describe("geo", () => {
  it("distanceMetres: 0 for the same point; ~111,195 m for 1° of latitude", () => {
    expect(distanceMetres({ lat: 19, lon: 72 }, { lat: 19, lon: 72 })).toBe(0);
    expect(distanceMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195.080234, 5);
  });
  it("distanceMetres: Dak Bhawan to a point 25 m north is 25 ± 0.1 m", () => {
    const a = { lat: 28.622788, lon: 77.213033 };
    const b = { lat: 28.62301283009, lon: 77.213033 };
    expect(distanceMetres(a, b)).toBeCloseTo(25, 1);
    expect(distanceMetres(b, a)).toBeCloseTo(25, 1);
  });
  it("returns a finite half-circumference for antipodal pins", () => {
    expect(distanceMetres({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(20015114.442036, 5);
  });
  it.each([
    { lat: NaN, lon: 72 },
    { lat: 19, lon: Infinity },
    { lat: 90.001, lon: 72 },
    { lat: -90.001, lon: 72 },
    { lat: 19, lon: 180.001 },
    { lat: 19, lon: -180.001 },
  ])("rejects an invalid distance endpoint $lat, $lon", (invalid) => {
    expect(() => distanceMetres(invalid, { lat: 19, lon: 72 })).toThrow(RangeError);
    expect(() => distanceMetres({ lat: 19, lon: 72 }, invalid)).toThrow(RangeError);
  });
  it.each([
    { lat: 1, lon: 0, bearing: 0 },
    { lat: 0, lon: 1, bearing: 90 },
    { lat: -1, lon: 0, bearing: 180 },
    { lat: 0, lon: -1, bearing: 270 },
  ])("bearingDegrees: cardinal direction $bearing", ({ lat, lon, bearing }) => {
    expect(bearingDegrees({ lat: 0, lon: 0 }, { lat, lon })).toBeCloseTo(bearing, 10);
  });
  it("offsetPoint reaches a known destination one degree north at the equator", () => {
    const destination = offsetPoint({ lat: 0, lon: 0 }, 0, 111195.080234);
    expect(destination.lat).toBeCloseTo(1, 10);
    expect(destination.lon).toBe(0);
  });
  it.each([0, 45, 90, 180, 270, 359])("offsetPoint preserves a 25 m offset at bearing %s", (bearing) => {
    const from = { lat: 28.622788, lon: 77.213033 };
    const destination = offsetPoint(from, bearing, 25);
    expect(distanceMetres(from, destination)).toBeCloseTo(25, 5);
    expect(bearingDegrees(from, destination)).toBeCloseTo(bearing, 5);
  });
  it("offsetPoint wraps longitude when crossing the antimeridian", () => {
    const destination = offsetPoint({ lat: 0, lon: 179.5 }, 90, 111195.080234);
    expect(destination.lat).toBeCloseTo(0, 10);
    expect(destination.lon).toBeCloseTo(-179.5, 10);
  });
  it("keeps a zero-offset pin exact without returning the input object", () => {
    const from = { lat: 19.045, lon: 72.855 };
    const destination = offsetPoint(from, 90, 0);
    expect(destination).toEqual(from);
    expect(destination).not.toBe(from);
  });
  it.each([
    { bearing: NaN, metres: 25 },
    { bearing: Infinity, metres: 25 },
    { bearing: 90, metres: NaN },
    { bearing: 90, metres: Infinity },
    { bearing: 90, metres: -1 },
  ])("rejects invalid offset bearing=$bearing metres=$metres", ({ bearing, metres }) => {
    expect(() => offsetPoint({ lat: 19, lon: 72 }, bearing, metres)).toThrow(RangeError);
  });
  it("nearestPointOnLine snaps to the closest segment, not the closest vertex", () => {
    const result = nearestPointOnLine({ lat: 19.001, lon: 72.001 }, [
      [72, 19],
      [72.002, 19],
    ]);
    expect(result.point.lat).toBeCloseTo(19, 10);
    expect(result.point.lon).toBeCloseTo(72.001, 10);
    expect(result.metres).toBeCloseTo(111.19508, 5);
  });
  it("accounts for longitude scale when projecting an oblique street", () => {
    const { point } = nearestPointOnLine({ lat: 60, lon: 0.002 }, [
      [0, 60],
      [0.002, 60.002],
    ]);
    expect(point.lat).toBeCloseTo(60.0004, 9);
    expect(point.lon).toBeCloseTo(0.0004, 9);
  });
  it("chooses the nearest of multiple segments", () => {
    const { point } = nearestPointOnLine({ lat: 19.001, lon: 72.003 }, [
      [72, 19],
      [72.002, 19],
      [72.002, 19.002],
    ]);
    expect(point.lat).toBeCloseTo(19.001, 10);
    expect(point.lon).toBeCloseTo(72.002, 10);
  });
  it.each([71.999, 72.003])("clamps to an endpoint beyond a segment at longitude %s", (lon) => {
    const { point } = nearestPointOnLine({ lat: 19, lon }, [
      [72, 19],
      [72.002, 19],
    ]);
    expect(point).toEqual({ lat: 19, lon: lon < 72 ? 72 : 72.002 });
  });
  it("treats single vertices and duplicate vertices as points", () => {
    const query = { lat: 19.001, lon: 72 };
    const single = nearestPointOnLine(query, [[72, 19]]);
    const duplicate = nearestPointOnLine(query, [
      [72, 19],
      [72, 19],
    ]);
    expect(single.point).toEqual({ lat: 19, lon: 72 });
    expect(single.metres).toBeCloseTo(111.19508, 5);
    expect(duplicate).toEqual(single);
  });
  it("rejects an empty street polyline", () => {
    expect(() => nearestPointOnLine({ lat: 19, lon: 72 }, [])).toThrow(RangeError);
  });
  it("rejects invalid vertices even after a usable segment", () => {
    expect(() =>
      nearestPointOnLine({ lat: 19.001, lon: 72.001 }, [
        [72, 19],
        [72.002, 19],
        [NaN, 19],
      ]),
    ).toThrow(RangeError);
  });
  it("pinsDisagree is true just above the threshold and false at it", () => {
    const a = { lat: 19, lon: 72 };
    const b = { lat: 19.001, lon: 72 };
    const threshold = distanceMetres(a, b);
    expect(pinsDisagree(a, b, threshold)).toBe(false);
    expect(pinsDisagree(a, b, threshold - 0.001)).toBe(true);
    expect(pinsDisagree(a, a, 0)).toBe(false);
    expect(pinsDisagree(a, offsetPoint(a, 0, 49.99), 50)).toBe(false);
    expect(pinsDisagree(a, offsetPoint(a, 0, 50.01), 50)).toBe(true);
  });
  it.each([NaN, Infinity, -1])("rejects invalid pin-spread threshold %s", (threshold) => {
    expect(() => pinsDisagree({ lat: 19, lon: 72 }, { lat: 19, lon: 72 }, threshold)).toThrow(RangeError);
  });
});
