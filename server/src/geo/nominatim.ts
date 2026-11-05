// Nominatim. Owner: AI/ML (P0-7). Read docs/research/nominatim-overpass.md:
// at most 1 request/s for the whole app, a User-Agent naming Pata (never a personal email),
// countrycodes=in, and every answer cached in KV. Sends ONLY the locality string, never the way to the door.
import type { Locality } from "../../../shared/domain";

/** [west, south, east, north] */
export type BBox = [number, number, number, number];

export async function localityBBox(
  kv: KVNamespace,
  locality: Locality,
): Promise<BBox | null> {
  void kv;
  void locality;
  throw new Error("localityBBox: not implemented (P0-7)");
}
