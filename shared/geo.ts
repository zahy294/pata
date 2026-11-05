// Plain, tested geometry (CLAUDE.md invariant: pin distances come from plain code, never the model).
// Used by the server (pin placement) and the app (spread check, map). Owner: AI/ML. Tests first (TDD):
// shared/geo.test.ts.
import type { LatLon } from "./domain";

/** Great-circle distance in metres (haversine, R = 6,371,008.8 m). */
export function distanceMetres(a: LatLon, b: LatLon): number {
  void a;
  void b;
  throw new Error("distanceMetres: not implemented");
}

/** Initial bearing from a to b, degrees clockwise from north, 0 ≤ result < 360. */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  void a;
  void b;
  throw new Error("bearingDegrees: not implemented");
}

/** The point `metres` away from `from` along `bearing`. */
export function offsetPoint(
  from: LatLon,
  bearing: number,
  metres: number,
): LatLon {
  void from;
  void bearing;
  void metres;
  throw new Error("offsetPoint: not implemented");
}

/** The closest point to `p` on a polyline given as [lon, lat] pairs (OSM/GeoJSON order). */
export function nearestPointOnLine(
  p: LatLon,
  line: [number, number][],
): { point: LatLon; metres: number } {
  void p;
  void line;
  throw new Error("nearestPointOnLine: not implemented");
}

/** "We're not sure" (P1-6): true when the top two pins are more than NOT_SURE_SPREAD_METRES apart. */
export function pinsDisagree(
  first: LatLon,
  second: LatLon,
  thresholdMetres: number,
): boolean {
  return distanceMetres(first, second) > thresholdMetres;
}
