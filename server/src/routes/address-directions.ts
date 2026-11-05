// POST /address/directions. Owner: AI/ML (P0-9).
// Writes directions in hi, mr and en from the confirmed pin and the landmarks around it
// (distances already computed by code). Logic in ../ai/directions.ts.
// Validate with DirectionsRequest; reply DirectionsResponse.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const addressDirections: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /address/directions");
};
