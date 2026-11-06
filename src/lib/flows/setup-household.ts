// "Set up a household" (docs/plan.md, P0-7 to P0-9). Screens call these steps in order and show progress.
// Owners: AI/ML builds describeTheWay/findCandidatePins/makeDirections; blockchain builds signIn/createHousehold.
// Frontend only calls them. Each step is separately callable so the UI can retry one step.
import type {
  CandidatePin,
  DirectionsText,
  Language,
  LatLon,
  Locality,
  OsmFeature,
  Relation,
} from "../../../shared/domain";
import type { RankResponse } from "../../../shared/api";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";
import { extractAddress, rankLandmarks, speechToText, writeDirections, textToSpeech } from "../server-client";
import { LANGUAGES } from "../../../shared/domain";
import { distanceMetres } from "../../../shared/geo";
import { ARKIV_MAX_BYTES } from "../../../shared/constants";
import { shortenDirections } from "../server-client/directions-text";

/** P0: load the device root or make a new one; P1-3: passkey. */
export async function signIn(): Promise<HouseholdKeys> {
  throw new Error("signIn: not implemented (P0-5)");
}

/** Step 2: spoken (Blob) or typed (string) way to the door → transcript, locality, landmark phrases. */
export async function describeTheWay(
  keys: HouseholdKeys,
  input: Blob | string,
  language: Language,
): Promise<{ wayToTheDoor: string; locality: Locality | null; landmarkPhrases: string[] }> {
  const wayToTheDoor = typeof input === "string" ? input : await speechToText(keys, input, language);
  const parts = await extractAddress(keys, { wayToTheDoor, language });
  return { wayToTheDoor, ...parts };
}

/** Step 3–4: candidate pins from the server. Empty candidates → hand-dropped pin. */
export async function findCandidatePins(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  locality: Locality,
  landmarkPhrases: string[],
): Promise<RankResponse> {
  return rankLandmarks(keys, { wayToTheDoor, locality, landmarkPhrases });
}

/** Step 5: raw clips for createHousehold to encrypt/persist after funding; no Arkiv writes here. */
export async function makeDirections(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  confirmedPin: LatLon,
  landmarks: { feature: OsmFeature; relation: Relation }[],
): Promise<{ directions: DirectionsText; clips: Partial<Record<Language, Uint8Array>> }> {
  const { directions } = await writeDirections(keys, {
    wayToTheDoor,
    pin: confirmedPin,
    landmarks: landmarks.map(({ feature, relation }) => ({
      feature,
      relation,
      metres: distanceMetres(confirmedPin, feature.point),
    })),
  });
  const clips: Partial<Record<Language, Uint8Array>> = {};
  for (const language of LANGUAGES) {
    try {
      let text = directions[language];
      let clip = await textToSpeech(keys, text, language);
      // sealBytes v1: one version byte, 12-byte IV and 16-byte AES-GCM tag.
      // createHousehold owns encryption and persistence after funding.
      if (clip.byteLength + 29 >= ARKIV_MAX_BYTES) {
        text = shortenDirections(text, Math.max(1, Math.floor(Array.from(text).length / 2)));
        clip = await textToSpeech(keys, text, language);
      }
      if (clip.byteLength + 29 < ARKIV_MAX_BYTES) {
        directions[language] = text;
        clips[language] = clip;
      }
    } catch {
      // ADR 0007: retain directions for browser speech fallback.
    }
  }
  return { directions, clips };
}

export interface NewHousehold {
  label: string;
  locality: Locality;
  confirmedPin: LatLon;
  /** Typed; never leaves the device except sealed. */
  roomNumber: string;
  writtenAddress: string;
  directions: DirectionsText;
  voiceKeys: Record<Language, `0x${string}`>;
  candidates: CandidatePin[];
}

/** Steps 6–8: topup, factory deploys, /register, locality record, sealed home record. */
export async function createHousehold(keys: HouseholdKeys, input: NewHousehold): Promise<HouseholdState> {
  void keys;
  void input;
  throw new Error("createHousehold: not implemented (P0-8)");
}
