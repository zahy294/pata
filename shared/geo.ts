// Plain, tested geometry (CLAUDE.md invariant: pin distances come from plain code, never the model).
// Used by the server (pin placement) and the app (spread check, map). Owner: AI/ML. Tests first (TDD):
// shared/geo.test.ts.
import type { LatLon } from "./domain";

const EARTH_RADIUS_METRES = 6_371_008.8;
const RADIANS = Math.PI / 180;

function assertPoint(point: LatLon): void {
  if (
    !Number.isFinite(point.lat) ||
    Math.abs(point.lat) > 90 ||
    !Number.isFinite(point.lon) ||
    Math.abs(point.lon) > 180
  ) {
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
export function offsetPoint(from: LatLon, bearing: number, metres: number): LatLon {
  assertPoint(from);
  if (!Number.isFinite(bearing) || !Number.isFinite(metres) || metres < 0) {
    throw new RangeError("Expected a finite bearing and non-negative distance");
  }
  if (metres === 0) return { ...from };
  const lat = from.lat * RADIANS;
  const angle = bearing * RADIANS;
  const arc = metres / EARTH_RADIUS_METRES;
  const sinLat = Math.sin(lat) * Math.cos(arc) + Math.cos(lat) * Math.sin(arc) * Math.cos(angle);
  const destinationLat = Math.asin(Math.min(1, Math.max(-1, sinLat)));
  const destinationLon =
    from.lon +
    Math.atan2(
      Math.sin(angle) * Math.sin(arc) * Math.cos(lat),
      Math.cos(arc) - Math.sin(lat) * Math.sin(destinationLat),
    ) /
      RADIANS;
  return { lat: destinationLat / RADIANS, lon: ((destinationLon + 540) % 360) - 180 };
}

/**
 * Closest point to `p` on a local street polyline in [lon, lat] order.
 * Uses an equirectangular projection about `p`; not for long-distance or
 * antimeridian-crossing lines. Empty input throws; a single vertex is a point.
 * The returned distance uses haversine metres, not projected metres.
 */
export function nearestPointOnLine(p: LatLon, line: [number, number][]): { point: LatLon; metres: number } {
  if (line.length === 0) throw new RangeError("A street polyline needs at least one point");
  assertPoint(p);
  for (const [lon, lat] of line) assertPoint({ lat, lon });
  const lonScale = Math.cos(p.lat * RADIANS);
  const project = ([lon, lat]: [number, number]) => ({
    x: (lon - p.lon) * RADIANS * EARTH_RADIUS_METRES * lonScale,
    y: (lat - p.lat) * RADIANS * EARTH_RADIUS_METRES,
  });
  let point = { lat: line[0][1], lon: line[0][0] };
  let closestSquared = Infinity;
  for (let i = 1; i < line.length; i++) {
    const start = line[i - 1];
    const end = line[i];
    const a = project(start);
    const b = project(end);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    const squared = (a.x + t * dx) ** 2 + (a.y + t * dy) ** 2;
    if (squared < closestSquared) {
      closestSquared = squared;
      point = { lon: start[0] + t * (end[0] - start[0]), lat: start[1] + t * (end[1] - start[1]) };
    }
  }
  return { point, metres: distanceMetres(p, point) };
}

/** "We're not sure" (P1-6): true when the top two pins are more than NOT_SURE_SPREAD_METRES apart. */
export function pinsDisagree(first: LatLon, second: LatLon, thresholdMetres: number): boolean {
  if (!Number.isFinite(thresholdMetres) || thresholdMetres < 0) {
    throw new RangeError("Expected a finite non-negative pin-spread threshold");
  }
  return distanceMetres(first, second) > thresholdMetres;
}
