// POST /speech/in?lang=hi|mr|en. Owner: AI/ML (P0-7).
// The raw recording is the body. Sends it to Sarvam saaras:v4 (codemix) via ../speech/sarvam.ts.
// Never store or log the audio or the transcript. Reply SpeechInResponse.
import type { RouteHandler } from "../env";
import { error, json } from "../http";
import { Language, SpeechInResponse } from "../../../shared/api";
import { transcribe } from "../speech/sarvam";
import { chargeSpend } from "../guard";
import { RecordingInputError } from "../../../src/lib/server-client/recording";

export const speechIn: RouteHandler = async (ctx) => {
  const lang = Language.safeParse(ctx.url.searchParams.get("lang"));
  if (!lang.success) return error(400, "invalid_language", "Unsupported speech language");
  let capped = false;
  try {
    // Empty declared type requests byte sniffing; RouteContext deliberately has no headers.
    const transcript = await transcribe(ctx.env.SARVAM_API_KEY, ctx.body, "", lang.data, async (seconds) => {
      // Conservative fractional US cents, rounded-up seconds. See speech research pricing.
      if (!(await chargeSpend(ctx.env, (Math.ceil(seconds) * 0.56) / 60))) {
        capped = true;
        throw new Error();
      }
    });
    return json(SpeechInResponse.parse({ transcript }));
  } catch (caught) {
    if (caught instanceof RecordingInputError) return error(caught.status, "invalid_audio", caught.message);
    return capped
      ? error(429, "spend_limit", "Daily spend limit reached")
      : error(502, "speech_unavailable", "Speech transcription unavailable");
  }
};
