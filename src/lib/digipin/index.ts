// DIGIPIN encode and decode: India Post v2.0.0, no hyphens. Plain, tested code (CLAUDE.md invariant).
// Owner: AI/ML (P0-4). Read docs/research/digipin.md. Write digipin.test.ts first (TDD).
// The same vectors (vectors.json) are used by the Solidity resolver's tests (P1-1).
import type { LatLon } from "../../../shared/domain";

/** Row 0 = north, column 0 = west. */
export const DIGIPIN_GRID = [
  ["F", "C", "9", "8"],
  ["J", "3", "2", "7"],
  ["K", "4", "5", "6"],
  ["L", "M", "P", "T"],
] as const;

export const DIGIPIN_BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 } as const;

export interface DigipinCell {
  center: LatLon;
  /** South-west and north-east corners. */
  southWest: LatLon;
  northEast: LatLon;
}

/** (lat, lon) → 10-character canonical code, e.g. (28.622788, 77.213033) → "39J49LL8T4". Throws outside the bounds. */
export function encodeDigipin(point: LatLon): string {
  void point;
  throw new Error("encodeDigipin: not implemented (P0-4)");
}

/** Canonical or lowercase code → its cell. Throws on an invalid code. */
export function decodeDigipin(code: string): DigipinCell {
  void code;
  throw new Error("decodeDigipin: not implemented (P0-4)");
}

/** `^[23456789CJKLMPFT]{10}$` after uppercasing and removing spaces. */
export function isValidDigipin(code: string): boolean {
  void code;
  throw new Error("isValidDigipin: not implemented (P0-4)");
}

/** "39J49LL8T4" → "39j49ll8t4" (the grid name label, P1-1). */
export function toGridLabel(code: string): string {
  void code;
  throw new Error("toGridLabel: not implemented (P0-4)");
}

/** "39J49LL8T4" → "39J 49L L8T4" (3-4-3 with spaces; never hyphens). */
export function formatDigipin(code: string): string {
  void code;
  throw new Error("formatDigipin: not implemented (P0-4)");
}
