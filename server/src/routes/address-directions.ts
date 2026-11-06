// POST /address/directions. Owner: AI/ML (P0-9).
// Writes directions in hi, mr and en from the confirmed pin and the landmarks around it
// (distances already computed by code). Logic in ../ai/directions.ts.
// Validate with DirectionsRequest; reply DirectionsResponse.
import type { RouteHandler } from "../env";
import { error, json } from "../http";
import { DirectionsRequest, DirectionsResponse } from "../../../shared/api";
import { writeDirections } from "../ai/directions";
import { chargeSpend } from "../guard";

export const addressDirections: RouteHandler = async (ctx) => {
  let input;
  try {
    input = DirectionsRequest.parse(JSON.parse(new TextDecoder().decode(ctx.body)));
  } catch {
    return error(400, "invalid_request", "Invalid directions request");
  }
  let capped = false;
  try {
    if (!(await chargeSpend(ctx.env, 0))) return error(429, "spend_limit", "Daily spend limit reached");
    const result = await writeDirections(ctx.env.ANTHROPIC_API_KEY, input, async (cents) => {
      if (!(await chargeSpend(ctx.env, cents))) {
        capped = true;
        throw new Error();
      }
    });
    return json(DirectionsResponse.parse(result), 200, { "cache-control": "no-store" });
  } catch {
    return capped
      ? error(429, "spend_limit", "Daily spend limit reached")
      : error(502, "directions_unavailable", "Directions unavailable");
  }
};
