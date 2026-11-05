// POST /address/rank. Owner: AI/ML (P0-7).
// 1. ../geo: locality -> bounding box (Nominatim), then OSM features in it (Overpass), cached in KV.
//    Map search gets ONLY landmark phrases and the locality, never the way to the door.
// 2. ../ai/rank.ts: Sonnet 5.5 picks landmarks from those features only, each with a relation.
//    keepKnownLandmarks drops any osmId the model returns that isn't in the fetched set.
// 3. ../geo/place-pins.ts: plain code places up to 3 candidate pins on the street geometry.
// Validate with RankRequest; reply RankResponse.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const addressRank: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /address/rank");
};
