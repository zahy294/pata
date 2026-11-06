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
import { bearingDegrees, distanceMetres, nearestPointOnLine, offsetPoint } from "../../../shared/geo";

export function placeCandidatePins(
  ranked: RankedLandmark[],
  features: OsmFeature[],
  streets: Street[],
): CandidatePin[] {
  const known = new Map(features.map((feature) => [feature.osmId, feature]));
  const candidates: CandidatePin[] = [];
  const priority = { high: 0, medium: 1, low: 2 };
  for (const selection of [...ranked].sort((a, b) => priority[a.confidence] - priority[b.confidence])) {
    const landmark = known.get(selection.osmId);
    if (!landmark) continue;
    let nearest: ReturnType<typeof nearestPointOnLine> | undefined;
    for (const street of streets) {
      if (street.coords.length < 2) continue;
      const next = nearestPointOnLine(landmark.point, street.coords);
      if (!nearest || next.metres < nearest.metres) nearest = next;
    }
    let point = selection.relation === "at" && nearest ? nearest.point : landmark.point;
    if (nearest && nearest.metres > 0) {
      const away = bearingDegrees(nearest.point, landmark.point);
      if (selection.relation === "opposite") point = offsetPoint(nearest.point, away + 180, nearest.metres);
      if (selection.relation === "behind") point = offsetPoint(landmark.point, away, 10);
    }
    if (candidates.some((candidate) => distanceMetres(candidate.point, point) <= 10)) continue;
    candidates.push({
      relation: selection.relation,
      confidence: selection.confidence,
      landmark,
      point,
      metresFromLandmark: distanceMetres(landmark.point, point),
    });
    if (candidates.length === 3) break;
  }
  return candidates;
}
