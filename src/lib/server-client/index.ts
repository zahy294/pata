// Typed, signed calls to our Worker. Owner: AI/ML writes the address and speech calls; chain ops writes
// topup and register. Every call signs with the household account (shared/api.ts SIGNATURE_HEADERS)
// and parses the response with the matching zod schema.
// Privacy: never put the room number in any body here (CLAUDE.md invariant).
import type {
  DirectionsRequest,
  DirectionsResponse,
  ExtractRequest,
  ExtractResponse,
  RankRequest,
  RankResponse,
  RegisterRequest,
  RegisterResponse,
  TopupRequest,
  TopupResponse,
} from "../../../shared/api";
import type { Language } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import {
  ExtractRequest as ExtractRequestSchema,
  ExtractResponse as ExtractResponseSchema,
  RankRequest as RankRequestSchema,
  RankResponse as RankResponseSchema,
  ROUTES,
  RegisterResponse as RegisterSchema,
  TopupResponse as TopupSchema,
} from "../../../shared/api";
import { postAddress } from "./address-call";
import { postRecording } from "./speech-call";
import { signedPost } from "./signed";
import { postDirections, postAudio } from "./directions-call";
export { ServerError } from "./signed";

export async function topup(keys: HouseholdKeys, req: TopupRequest): Promise<TopupResponse> {
  const response = await signedPost(keys, ROUTES.topup, JSON.stringify(req));
  try {
    return TopupSchema.parse(await response.json());
  } catch {
    throw new Error("Invalid server response");
  }
}

export async function registerName(keys: HouseholdKeys, req: RegisterRequest): Promise<RegisterResponse> {
  const response = await signedPost(keys, ROUTES.register, JSON.stringify(req));
  try {
    return RegisterSchema.parse(await response.json());
  } catch {
    throw new Error("Invalid server response");
  }
}

export async function extractAddress(keys: HouseholdKeys, req: ExtractRequest): Promise<ExtractResponse> {
  return postAddress(keys, ROUTES.addressExtract, ExtractRequestSchema.parse(req), ExtractResponseSchema);
}

export async function rankLandmarks(keys: HouseholdKeys, req: RankRequest): Promise<RankResponse> {
  return postAddress(keys, ROUTES.addressRank, RankRequestSchema.parse(req), RankResponseSchema);
}

export async function writeDirections(
  keys: HouseholdKeys,
  req: DirectionsRequest,
): Promise<DirectionsResponse> {
  return postDirections(keys, req);
}

export async function speechToText(keys: HouseholdKeys, audio: Blob, language: Language): Promise<string> {
  return postRecording(keys, audio, language);
}

export async function textToSpeech(
  keys: HouseholdKeys,
  text: string,
  language: Language,
): Promise<Uint8Array> {
  return postAudio(keys, text, language);
}
