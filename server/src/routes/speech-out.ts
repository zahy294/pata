// POST /speech/out. Owner: AI/ML (P0-9).
// Directions text -> Sarvam bulbul:v4-flash -> audio/mpeg (MP3, 16 kHz). Called three times, at setup
// only (ADR 0007). Validate with SpeechOutRequest; reply with the MP3 bytes.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const speechOut: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /speech/out");
};
