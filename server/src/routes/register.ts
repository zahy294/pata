// POST /register. Owner: chain ops (P0-6).
// Registers <label>.pata.eth in pata.eth's registry with owner = ctx.household, the household's
// resolver and grant registry, the forever role bitmap and FOREVER_EXPIRY (docs/research/ens-v2.md §3).
// Check HOUSEHOLD_LABEL_PATTERN and getStatus first. Validate with RegisterRequest; reply RegisterResponse.
import type { RouteHandler } from "../env";
import { error, json } from "../http";
import { RegisterRequest } from "../../../shared/api";
import { HOUSEHOLD_LABEL_PATTERN } from "../../../shared/constants";
import { registerHouseholdName } from "../chain/relay";

export const register: RouteHandler = async (ctx) => {
  let input;
  try {
    input = RegisterRequest.parse(JSON.parse(new TextDecoder().decode(ctx.body)));
    if (!HOUSEHOLD_LABEL_PATTERN.test(input.label)) throw new Error();
  } catch {
    return error(400, "invalid_request", "Invalid registration request");
  }
  try {
    const txHash = await registerHouseholdName(
      ctx.env,
      input.label,
      ctx.household,
      input.resolver,
      input.grantRegistry,
    );
    return json({ txHash });
  } catch {
    return error(503, "relay_unavailable", "Name registration unavailable");
  }
};
