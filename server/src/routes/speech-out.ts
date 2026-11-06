// POST /speech/out. Owner: AI/ML (P0-9).
// Directions text -> Sarvam bulbul:v4-flash -> audio/aac (ADTS AAC, 8 kHz). Called three times, at setup
// only (ADR 0007). Validate with SpeechOutRequest; reply with the AAC bytes.
import type { RouteHandler } from "../env";
import { error } from "../http";
import { SpeechOutRequest } from "../../../shared/api";
import { synthesize } from "../speech/sarvam";
import { chargeSpend } from "../guard";

export const speechOut: RouteHandler = async (ctx) => {
  let input;
  try {
    input = SpeechOutRequest.parse(JSON.parse(new TextDecoder().decode(ctx.body)));
    if (!input.text.trim()) throw new Error();
  } catch {
    return error(400, "invalid_request", "Invalid speech request");
  }
  try {
    // Conservative US cents from the speech research's INR/USD estimate.
    if (!(await chargeSpend(ctx.env, input.text.length * 0.0012)))
      return error(429, "spend_limit", "Daily spend limit reached");
    const bytes = await synthesize(ctx.env.SARVAM_API_KEY, input.text, input.language);
    return new Response(bytes, { headers: { "content-type": "audio/aac", "cache-control": "no-store" } });
  } catch {
    return error(502, "speech_unavailable", "Speech synthesis unavailable");
  }
};
