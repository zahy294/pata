// Plain, tested code (CLAUDE.md invariant). Owner: AI/ML (P0-7). Write the tests first (TDD).
// Turns ranked landmarks + relations into candidate pins on the street geometry:
//   "at"       the landmark's point snapped to the nearest street;
//   "opposite" across the nearest street from the landmark;
//   "behind"   away from the nearest street, behind the landmark;
//   "near"     the landmark's point.
// Distances come from shared/geo.ts. Returns at most 3, best first.
import type { CandidatePin, OsmFeature } from "../../../shared/domain";
import type { RankedLandmark } from "../ai/rank";
import type { Street } from "./overpass";

export function placeCandidatePins(
  ranked: RankedLandmark[],
  features: OsmFeature[],
  streets: Street[],
): CandidatePin[] {
  void ranked;
  void features;
  void streets;
  throw new Error("placeCandidatePins: not implemented (P0-7)");
}
