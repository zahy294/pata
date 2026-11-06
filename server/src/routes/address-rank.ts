// POST /address/rank. Owner: AI/ML (P0-7).
// 1. ../geo: locality -> bounding box (Nominatim), then OSM features in it (Overpass), cached in KV.
//    Map search gets ONLY landmark phrases and the locality, never the way to the door.
// 2. ../ai/rank.ts: Sonnet 5.5 picks landmarks from those features only, each with a relation.
//    keepKnownLandmarks drops any osmId the model returns that isn't in the fetched set.
// 3. ../geo/place-pins.ts: plain code places up to 3 candidate pins on the street geometry.
// Validate with RankRequest; reply RankResponse.
import type { RouteHandler } from "../env";
import { error, json } from "../http";
import { RankRequest, RankResponse } from "../../../shared/api";
import { rankLandmarks } from "../ai/rank";
import { localityBBox } from "../geo/nominatim";
import { featuresInBox } from "../geo/overpass";
import { placeCandidatePins } from "../geo/place-pins";
import { chargeSpend } from "../guard";

export const addressRank: RouteHandler = async (ctx) => {
  let input;
  try {
    input = RankRequest.parse(JSON.parse(new TextDecoder().decode(ctx.body)));
  } catch {
    return error(400, "invalid_request", "Invalid address request");
  }
  let capped = false;
  try {
    const bbox = await localityBBox(ctx.env.PATA_KV, input.locality);
    if (!bbox) return error(422, "locality_not_found", "Locality not found");
    const { features, streets } = await featuresInBox(ctx.env.PATA_KV, bbox, input.landmarkPhrases);
    if (features.length === 0)
      return json(RankResponse.parse({ candidates: [], bbox, duplicateLandmarkName: false }));
    if (!(await chargeSpend(ctx.env, 0))) return error(429, "spend_limit", "Daily spend limit reached");
    const ranked = await rankLandmarks(
      ctx.env.ANTHROPIC_API_KEY,
      input.wayToTheDoor,
      features,
      async (cents) => {
        if (!(await chargeSpend(ctx.env, cents))) {
          capped = true;
          throw new Error();
        }
      },
    );
    const candidates = placeCandidatePins(ranked, features, streets);
    const normalize = (name: string) => name.normalize("NFKC").trim().toLowerCase();
    const chosenName = candidates[0] && normalize(candidates[0].landmark.name);
    const duplicateLandmarkName = Boolean(
      chosenName && features.filter((feature) => normalize(feature.name) === chosenName).length > 1,
    );
    return json(RankResponse.parse({ candidates, bbox, duplicateLandmarkName }));
  } catch {
    return capped
      ? error(429, "spend_limit", "Daily spend limit reached")
      : error(502, "address_unavailable", "Address search unavailable");
  }
};
