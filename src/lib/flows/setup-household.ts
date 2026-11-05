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
import { extractAddress, rankLandmarks, speechToText } from "../server-client";

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

/** Step 5: directions in hi/mr/en from the confirmed pin, then one clip each, sealed to Arkiv. */
export async function makeDirections(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  confirmedPin: LatLon,
  landmarks: { feature: OsmFeature; relation: Relation }[],
): Promise<{ directions: DirectionsText; voiceKeys: Record<Language, `0x${string}`> }> {
  void keys;
  void wayToTheDoor;
  void confirmedPin;
  void landmarks;
  throw new Error("makeDirections: not implemented (P0-9)");
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
