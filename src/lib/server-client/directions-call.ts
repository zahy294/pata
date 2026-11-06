import { z } from "zod";
import { DirectionsRequest, DirectionsResponse, ROUTES, SpeechOutRequest } from "../../../shared/api";
import type { Language } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import { postAddress } from "./address-call";
import { shortenDirections } from "./directions-text";
import { ServerError, signedPost } from "./signed";
import { assertMp3, MAX_MP3_RESPONSE_BYTES } from "./mp3";

const responseSchema = DirectionsResponse.extend({
  directions: z.object({
    hi: z.string().trim().min(1),
    mr: z.string().trim().min(1),
    en: z.string().trim().min(1),
  }),
});

export async function postDirections(
  keys: HouseholdKeys,
  req: DirectionsRequest,
): Promise<DirectionsResponse> {
  const result = await postAddress(
    keys,
    ROUTES.addressDirections,
    DirectionsRequest.parse(req),
    responseSchema,
  );
  return {
    directions: {
      hi: shortenDirections(result.directions.hi),
      mr: shortenDirections(result.directions.mr),
      en: shortenDirections(result.directions.en),
    },
  };
}

export async function postMp3(keys: HouseholdKeys, text: string, language: Language): Promise<Uint8Array> {
  const input = SpeechOutRequest.parse({ text, language });
  if (!input.text.trim()) throw new Error("Invalid speech text");
  try {
    const response = await signedPost(keys, ROUTES.speechOut, JSON.stringify(input));
    if (
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "audio/mpeg" ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new Error();
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > MAX_MP3_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    assertMp3(bytes);
    return bytes;
  } catch (failure) {
    if (failure instanceof ServerError) throw failure;
    throw new Error("Speech service unavailable");
  }
}
