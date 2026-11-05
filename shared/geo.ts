// Plain, tested geometry (CLAUDE.md invariant: pin distances come from plain code, never the model).
// Used by the server (pin placement) and the app (spread check, map). Owner: AI/ML. Tests first (TDD):
// shared/geo.test.ts.
import type { LatLon } from "./domain";

const EARTH_RADIUS_METRES = 6_371_008.8;
const RADIANS = Math.PI / 180;

function assertPoint(point: LatLon): void {
  if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90 ||
      !Number.isFinite(point.lon) || Math.abs(point.lon) > 180) {
    throw new RangeError("Expected finite WGS84 coordinates");
  }
}

/** Great-circle distance in metres (haversine, R = 6,371,008.8 m). */
export function distanceMetres(a: LatLon, b: LatLon): number {
  assertPoint(a);
  assertPoint(b);
  const latA = a.lat * RADIANS;
  const latB = b.lat * RADIANS;
  const halfLat = (latB - latA) / 2;
  const halfLon = ((b.lon - a.lon) * RADIANS) / 2;
  const haversine = Math.sin(halfLat) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(halfLon) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

/** Initial bearing from a to b, degrees clockwise from north, 0 ≤ result < 360. */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  assertPoint(a);
  assertPoint(b);
  const latA = a.lat * RADIANS;
  const latB = b.lat * RADIANS;
  const deltaLon = (b.lon - a.lon) * RADIANS;
  const y = Math.sin(deltaLon) * Math.cos(latB);
  const x = Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(deltaLon);
  return (Math.atan2(y, x) / RADIANS + 360) % 360;
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
