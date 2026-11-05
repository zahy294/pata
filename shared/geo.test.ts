// Owner: AI/ML (P0-7). Plain geometry must be exact to the metre: pin distances are a judging claim.
import { describe, expect, it } from "vitest";
import { bearingDegrees, distanceMetres } from "./geo";

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
    { lat: NaN, lon: 72 }, { lat: 19, lon: Infinity },
    { lat: 90.001, lon: 72 }, { lat: -90.001, lon: 72 },
    { lat: 19, lon: 180.001 }, { lat: 19, lon: -180.001 },
  ])("rejects an invalid distance endpoint $lat, $lon", (invalid) => {
    expect(() => distanceMetres(invalid, { lat: 19, lon: 72 })).toThrow(RangeError);
    expect(() => distanceMetres({ lat: 19, lon: 72 }, invalid)).toThrow(RangeError);
  });
  it.each([
    { lat: 1, lon: 0, bearing: 0 }, { lat: 0, lon: 1, bearing: 90 },
    { lat: -1, lon: 0, bearing: 180 }, { lat: 0, lon: -1, bearing: 270 },
  ])("bearingDegrees: cardinal direction $bearing", ({ lat, lon, bearing }) => {
    expect(bearingDegrees({ lat: 0, lon: 0 }, { lat, lon })).toBeCloseTo(bearing, 10);
  });
  it.todo("offsetPoint then distanceMetres returns the offset");
  it.todo("nearestPointOnLine snaps to the closest segment, not the closest vertex");
  it.todo("pinsDisagree is true just above the threshold and false at it");
});
