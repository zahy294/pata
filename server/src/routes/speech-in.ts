// POST /speech/in?lang=hi|mr|en. Owner: AI/ML (P0-7).
// The raw recording is the body. Sends it to Sarvam saaras:v4 (codemix) via ../speech/sarvam.ts.
// Never store or log the audio or the transcript. Reply SpeechInResponse.
import type { RouteHandler } from "../env";
import { notImplemented } from "../http";

export const speechIn: RouteHandler = async (ctx) => {
  void ctx;
  return notImplemented("POST /speech/in");
};
