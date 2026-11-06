// Sarvam. Owner: AI/ML. Read docs/research/speech.md. Auth header `api-subscription-key`.
// Speech in:  saaras:v4, mode codemix, at most 30 s (P0-7; Marathi is P1-7).
// Speech out: bulbul:v4-flash, AAC (ADTS), 8 kHz, about 5 KiB a second, at most 2,500 chars (P0-9).
import type { Language } from "../../../shared/domain";
import { SARVAM_LANGUAGE_CODE } from "../../../shared/domain";
import { Language as LanguageSchema, SpeechOutRequest } from "../../../shared/api";
import { z } from "zod";
import { inspectRecording, RecordingInputError } from "../../../src/lib/server-client/recording";
import { assertAac, MAX_AUDIO_RESPONSE_BYTES } from "../../../src/lib/server-client/aac";

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
  const input = SpeechOutRequest.parse({ text, language });
  const voices = { hi: "aditya_hi_conversational", mr: "ishita_mr_conversational", en: "simran_en_customer" };
  try {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        language_code: SARVAM_LANGUAGE_CODE[input.language],
        model: "bulbul:v4-flash",
        speaker: voices[input.language],
        output_audio_codec: "aac",
        // Measured 2026-11-06: MP3 is 128 kbps even at 16 kHz (~340 KB for 20 s); AAC at 8 kHz is ~41 kbps.
        speech_sample_rate: 8000,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    const { audios } = z
      .object({ audios: z.array(z.string().min(1)).length(1) })
      .parse(await response.json());
    if (audios[0].length > 4 * Math.ceil(MAX_AUDIO_RESPONSE_BYTES / 3)) throw new Error();
    const decoded = atob(audios[0]);
    const result = new ArrayBuffer(decoded.length);
    const bytes = new Uint8Array(result);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    assertAac(bytes);
    return result;
  } catch {
    throw new Error("Speech synthesis unavailable");
  }
}
