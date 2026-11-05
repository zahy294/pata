// POST /register. Owner: chain ops (P0-6).
// Registers <label>.pata.eth in pata.eth's registry with owner = ctx.household, the household's
// resolver and grant registry, the forever role bitmap and FOREVER_EXPIRY (docs/research/ens-v2.md §3).
// Check HOUSEHOLD_LABEL_PATTERN and getStatus first. Validate with RegisterRequest; reply RegisterResponse.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const register: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /register");
};
