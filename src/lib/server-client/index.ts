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
} from "../../../shared/api";
import { postAddress } from "./address-call";
import { postRecording } from "./speech-call";

export async function topup(keys: HouseholdKeys, req: TopupRequest): Promise<TopupResponse> {
  void keys;
  void req;
  throw new Error("topup: not implemented (P0-6)");
}

export async function registerName(keys: HouseholdKeys, req: RegisterRequest): Promise<RegisterResponse> {
  void keys;
  void req;
  throw new Error("registerName: not implemented (P0-6)");
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
  void keys;
  void req;
  throw new Error("writeDirections: not implemented (P0-9)");
}

export async function speechToText(keys: HouseholdKeys, audio: Blob, language: Language): Promise<string> {
  return postRecording(keys, audio, language);
}

export async function textToSpeech(
  keys: HouseholdKeys,
  text: string,
  language: Language,
): Promise<Uint8Array> {
  void keys;
  void text;
  void language;
  throw new Error("textToSpeech: not implemented (P0-9)");
}
