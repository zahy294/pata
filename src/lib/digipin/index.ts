// SPDX-License-Identifier: Apache-2.0
// Copyright 08.04.2025 Department of Posts.
// Adapted from India Post DIGIPIN v2.0.0 (a15339e8): TypeScript, numeric cell bounds,
// finite-coordinate validation and Pata display helpers. Licence: ./LICENSE.apache-2.0.
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

const DIGIPIN_ALPHABET = DIGIPIN_GRID.flat().join("");

export const DIGIPIN_BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 } as const;

export interface DigipinCell {
  center: LatLon;
  /** South-west and north-east corners. */
  southWest: LatLon;
  northEast: LatLon;
}

/** (lat, lon) → 10-character canonical code, e.g. (28.622788, 77.213033) → "39J49LL8T4". Throws outside the bounds. */
export function encodeDigipin(point: LatLon): string {
  if (!Number.isFinite(point.lat) || point.lat < DIGIPIN_BOUNDS.minLat || point.lat > DIGIPIN_BOUNDS.maxLat) {
    throw new RangeError("Latitude outside DIGIPIN bounds");
  }
  if (!Number.isFinite(point.lon) || point.lon < DIGIPIN_BOUNDS.minLon || point.lon > DIGIPIN_BOUNDS.maxLon) {
    throw new RangeError("Longitude outside DIGIPIN bounds");
  }
  let minLat: number = DIGIPIN_BOUNDS.minLat;
  let maxLat: number = DIGIPIN_BOUNDS.maxLat;
  let minLon: number = DIGIPIN_BOUNDS.minLon;
  let maxLon: number = DIGIPIN_BOUNDS.maxLon;
  let code = "";
  for (let level = 0; level < 10; level++) {
    const latStep = (maxLat - minLat) / 4;
    const lonStep = (maxLon - minLon) / 4;
    const row = Math.max(0, Math.min(3, 3 - Math.floor((point.lat - minLat) / latStep)));
    const col = Math.max(0, Math.min(3, Math.floor((point.lon - minLon) / lonStep)));
    code += DIGIPIN_GRID[row][col];
    minLat += (3 - row) * latStep;
    maxLat = minLat + latStep;
    minLon += col * lonStep;
    maxLon = minLon + lonStep;
  }
  return code;
}

/** Canonical, lowercase or display-spaced code → its cell. Throws on an invalid code. */
export function decodeDigipin(code: string): DigipinCell {
  if (!isValidDigipin(code)) throw new Error("Invalid DIGIPIN");
  code = code.replace(/ /g, "").toUpperCase();
  let minLat: number = DIGIPIN_BOUNDS.minLat;
  let minLon: number = DIGIPIN_BOUNDS.minLon;
  let size: number = DIGIPIN_BOUNDS.maxLat - DIGIPIN_BOUNDS.minLat;
  for (const symbol of code) {
    const index = DIGIPIN_ALPHABET.indexOf(symbol);
    const row = Math.floor(index / 4);
    const col = index % 4;
    size /= 4;
    minLat += (3 - row) * size;
    minLon += col * size;
  }
  return {
    center: { lat: minLat + size / 2, lon: minLon + size / 2 },
    southWest: { lat: minLat, lon: minLon },
    northEast: { lat: minLat + size, lon: minLon + size },
  };
}

/**
 * Pata input normalization: ignore ASCII U+0020 spaces anywhere and fold case.
 * Non-string runtime inputs return false. Hyphens and other whitespace remain invalid.
 * Canonical storage/interchange still uses ten continuous characters.
 */
export function isValidDigipin(code: string): boolean {
  return typeof code === "string" && /^[23456789CJKLMPFT]{10}$/.test(code.replace(/ /g, "").toUpperCase());
}

/** "39J49LL8T4" → "39j49ll8t4" (the grid name label, P1-1). */
export function toGridLabel(code: string): string {
  if (!isValidDigipin(code)) throw new Error("Invalid DIGIPIN");
  return code.replace(/ /g, "").toLowerCase();
}

/** "39J49LL8T4" → "39J 49LL 8T4" (3-4-3 with spaces; never hyphens). */
export function formatDigipin(code: string): string {
  if (!isValidDigipin(code)) throw new Error("Invalid DIGIPIN");
  const canonical = code.replace(/ /g, "").toUpperCase();
  return `${canonical.slice(0, 3)} ${canonical.slice(3, 7)} ${canonical.slice(7)}`;
}
