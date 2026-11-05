// Sonnet 5.5 landmark ranking. Owner: AI/ML (P0-7).
// The model sees the way to the door and the fetched OSM features (ids, names, kinds), and returns
// [{ osmId, relation, confidence }]. It never returns coordinates: code places the pins.
import type { Confidence, OsmFeature, Relation } from "../../../shared/domain";

export interface RankedLandmark {
  osmId: string;
  relation: Relation;
  confidence: Confidence;
}

export async function rankLandmarks(
  apiKey: string,
  wayToTheDoor: string,
  features: OsmFeature[],
): Promise<RankedLandmark[]> {
  void apiKey;
  void wayToTheDoor;
  void features;
  throw new Error("rankLandmarks: not implemented (P0-7)");
}

/** Plain code: keep only landmarks whose osmId is in the fetched set. */
export function keepKnownLandmarks(
  ranked: RankedLandmark[],
  features: OsmFeature[],
): RankedLandmark[] {
  const known = new Set(features.map((f) => f.osmId));
  return ranked.filter((r) => known.has(r.osmId));
}
