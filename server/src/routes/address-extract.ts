// POST /address/extract. Owner: AI/ML (P0-7).
// Haiku 5.5 pulls the locality (name + PIN code) and landmark phrases out of the way to the door.
// Logic lives in ../ai/extract.ts. Charge the spend cap. Never log the body.
// Validate with ExtractRequest; reply ExtractResponse.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const addressExtract: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /address/extract");
};
