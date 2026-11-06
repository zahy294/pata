import { z } from "zod";
import { Language as LanguageSchema, ROUTES, SpeechInResponse } from "../../../shared/api";
import type { Language } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import { ServerError, signedPost } from "./signed";
import { inspectRecording, MAX_RECORDING_BYTES, RecordingInputError } from "./recording";

const transcriptSchema = SpeechInResponse.extend({ transcript: z.string().trim().min(3).max(2000) });

export async function postRecording(keys: HouseholdKeys, audio: Blob, language: Language): Promise<string> {
  const lang = LanguageSchema.parse(language);
  if (audio.size > MAX_RECORDING_BYTES) throw new RecordingInputError("Recording must be at most 2 MiB", 413);
  const bytes = await audio.arrayBuffer();
  const recording = inspectRecording(bytes);
  try {
    const route = `${ROUTES.speechIn}?${new URLSearchParams({ lang })}`;
    const response = await signedPost(
      keys,
      route,
      new Blob([bytes], { type: recording.contentType }),
      recording.contentType,
    );
    return transcriptSchema.parse(await response.json()).transcript;
  } catch (failure) {
    if (failure instanceof ServerError) throw failure;
    throw new Error("Speech service unavailable");
  }
}
