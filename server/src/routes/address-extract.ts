// POST /address/extract. Owner: AI/ML (P0-7).
// Haiku 5.5 pulls the locality (name + PIN code) and landmark phrases out of the way to the door.
// Logic lives in ../ai/extract.ts. Charge the spend cap. Never log the body.
// Validate with ExtractRequest; reply ExtractResponse.
import type { RouteHandler } from "../env";
import { error, json } from "../http";
import { ExtractRequest, ExtractResponse } from "../../../shared/api";
import { extractAddressParts } from "../ai/extract";
import { chargeSpend } from "../guard";

export const addressExtract: RouteHandler = async (ctx) => {
  let input;
  try {
    input = ExtractRequest.parse(JSON.parse(new TextDecoder().decode(ctx.body)));
  } catch {
    return error(400, "invalid_request", "Invalid address request");
  }
  let capped = false;
  try {
    if (!(await chargeSpend(ctx.env, 0))) return error(429, "spend_limit", "Daily spend limit reached");
    const result = await extractAddressParts(ctx.env.ANTHROPIC_API_KEY, input, async (cents) => {
      if (!(await chargeSpend(ctx.env, cents))) {
        capped = true;
        throw new Error();
      }
    });
    return json(ExtractResponse.parse(result));
  } catch {
    return capped
      ? error(429, "spend_limit", "Daily spend limit reached")
      : error(502, "address_unavailable", "Address extraction unavailable");
  }
};
