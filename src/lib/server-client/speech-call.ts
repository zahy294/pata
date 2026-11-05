import { z } from "zod";
import {
  Language as LanguageSchema,
  ROUTES,
  SIGNATURE_HEADERS,
  SpeechInResponse,
  signedMessage,
} from "../../../shared/api";
import type { Language } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import { env } from "../env";
import { inspectRecording, MAX_RECORDING_BYTES, RecordingInputError } from "./recording";

const transcriptSchema = SpeechInResponse.extend({ transcript: z.string().trim().min(3).max(2000) });

export async function postRecording(keys: HouseholdKeys, audio: Blob, language: Language): Promise<string> {
  const lang = LanguageSchema.parse(language);
  if (audio.size > MAX_RECORDING_BYTES) throw new RecordingInputError("Recording must be at most 2 MiB", 413);
  const bytes = await audio.arrayBuffer();
  const recording = inspectRecording(bytes);
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const signature = await keys.account.signMessage({
      message: signedMessage(ROUTES.speechIn, timestamp, hash),
    });
    const url = new URL(ROUTES.speechIn, env.serverUrl);
    url.searchParams.set("lang", lang);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "content-type": recording.contentType,
        [SIGNATURE_HEADERS.address]: keys.account.address,
        [SIGNATURE_HEADERS.timestamp]: String(timestamp),
        [SIGNATURE_HEADERS.signature]: signature,
      },
      body: bytes,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    return transcriptSchema.parse(await response.json()).transcript;
  } catch {
    throw new Error("Speech service unavailable");
  }
}
