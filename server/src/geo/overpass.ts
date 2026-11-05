// Overpass. Owner: AI/ML (P0-7). Named features and streets inside the locality's box.
// One query per locality, cached in KV; back off at least 30 s after a 429.
// Sends only the box and landmark names.
import type { OsmFeature } from "../../../shared/domain";
import type { BBox } from "./nominatim";

export interface Street {
  osmId: string;
  name?: string;
  /** Polyline as [lon, lat] pairs. */
  coords: [number, number][];
}

export async function featuresInBox(
  kv: KVNamespace,
  bbox: BBox,
  landmarkPhrases: string[],
): Promise<{ features: OsmFeature[]; streets: Street[] }> {
  void kv;
  void bbox;
  void landmarkPhrases;
  throw new Error("featuresInBox: not implemented (P0-7)");
}
