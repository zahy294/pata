// Sarvam. Owner: AI/ML. Read docs/research/speech.md. Auth header `api-subscription-key`.
// Speech in:  saaras:v4, mode codemix, at most 30 s (P0-7; Marathi is P1-7).
// Speech out: bulbul:v4-flash, mp3, 16 kHz, at most 2,500 chars (P0-9).
import type { Language } from "../../../shared/domain";
import { SARVAM_LANGUAGE_CODE } from "../../../shared/domain";
import { Language as LanguageSchema } from "../../../shared/api";
import { z } from "zod";
import { inspectRecording, RecordingInputError } from "../../../src/lib/server-client/recording";

export async function transcribe(
  apiKey: string,
  audio: ArrayBuffer,
  contentType: string,
  language: Language,
  beforeUpload?: (seconds: number) => Promise<void>,
): Promise<string> {
  const lang = LanguageSchema.parse(language);
  const recording = inspectRecording(audio);
  if (contentType && contentType.split(";")[0].trim().toLowerCase() !== recording.contentType)
    throw new RecordingInputError("Recording format does not match its content type");
  await beforeUpload?.(recording.seconds);
  try {
    const form = new FormData();
    form.set("file", new Blob([audio], { type: recording.contentType }), `recording.${recording.extension}`);
    form.set("model", "saaras:v4");
    form.set("mode", "codemix");
    form.set("language_code", SARVAM_LANGUAGE_CODE[lang]);
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    return z.object({ transcript: z.string().trim().min(3).max(2000) }).parse(await response.json())
      .transcript;
  } catch {
    throw new Error("Speech transcription unavailable");
  }
}

export async function synthesize(apiKey: string, text: string, language: Language): Promise<ArrayBuffer> {
  void apiKey;
  void text;
  void language;
  throw new Error("synthesize: not implemented (P0-9)");
}
