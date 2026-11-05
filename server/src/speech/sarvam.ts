// Sarvam. Owner: AI/ML. Read docs/research/speech.md. Auth header `api-subscription-key`.
// Speech in:  saaras:v4, mode codemix, at most 30 s (P0-7; Marathi is P1-7).
// Speech out: bulbul:v4-flash, mp3, 16 kHz, at most 2,500 chars (P0-9).
import type { Language } from "../../../shared/domain";

export async function transcribe(
  apiKey: string,
  audio: ArrayBuffer,
  contentType: string,
  language: Language,
): Promise<string> {
  void apiKey;
  void audio;
  void contentType;
  void language;
  throw new Error("transcribe: not implemented (P0-7)");
}

export async function synthesize(
  apiKey: string,
  text: string,
  language: Language,
): Promise<ArrayBuffer> {
  void apiKey;
  void text;
  void language;
  throw new Error("synthesize: not implemented (P0-9)");
}
