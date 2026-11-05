// POST /topup. Owner: chain ops (P0-6).
// Sends Sepolia ETH or tGLM from the relay to ctx.household if its balance is below the target set by
// the hour-0 gas test. One top-up per household per chain per 10 minutes (KV). Direct RPC is allowed
// here (our server's own transactions). Validate with TopupRequest; reply TopupResponse.
import type { RouteHandler } from "../env";
import { error, json } from "../http";
import { TopupRequest } from "../../../shared/api";
import { topUp } from "../chain/relay";

export const topup: RouteHandler = async (ctx) => {
  let input;
  try {
    input = TopupRequest.parse(JSON.parse(new TextDecoder().decode(ctx.body)));
  } catch {
    return error(400, "invalid_request", "Invalid top-up request");
  }
  try {
    const result = await topUp(ctx.env, input.chain, ctx.household);
    return json({ txHash: result.txHash, balanceWei: result.balanceWei.toString() });
  } catch {
    return error(503, "relay_unavailable", "Gas top-up unavailable");
  }
};
