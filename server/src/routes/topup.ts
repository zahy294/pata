// POST /topup. Owner: chain ops (P0-6).
// Sends Sepolia ETH or tGLM from the relay to ctx.household if its balance is below the target set by
// the hour-0 gas test. One top-up per household per chain per 10 minutes (KV). Direct RPC is allowed
// here (our server's own transactions). Validate with TopupRequest; reply TopupResponse.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const topup: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /topup");
};
