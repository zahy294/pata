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
  ROUTES,
  RegisterResponse as RegisterSchema,
  TopupResponse as TopupSchema,
} from "../../../shared/api";
import { signedPost } from "./signed";

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
  void keys;
  void req;
  throw new Error("extractAddress: not implemented (P0-7)");
}

export async function rankLandmarks(keys: HouseholdKeys, req: RankRequest): Promise<RankResponse> {
  void keys;
  void req;
  throw new Error("rankLandmarks: not implemented (P0-7)");
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
  void keys;
  void audio;
  void language;
  throw new Error("speechToText: not implemented (P0-7)");
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
