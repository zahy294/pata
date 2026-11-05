// Domain types shared by the app (src/) and the server (server/).
// Names follow GLOSSARY.md. Change a type here only with the owners of both sides,
// because the app, the server and the stored records all depend on it.

/** Languages Pata speaks. Directions and audio exist in all three. */
export const LANGUAGES = ["hi", "mr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** BCP-47 codes that Sarvam expects for each language. */
export const SARVAM_LANGUAGE_CODE: Record<Language, string> = {
  hi: "hi-IN",
  mr: "mr-IN",
  en: "en-IN",
};

/** A point in WGS84 degrees. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** The public part of an address. It's all a stranger sees. Example: { name: "Dharavi", pinCode: "400017" }. */
export interface Locality {
  name: string;
  pinCode: string;
}

/** How a landmark relates to the door. "third lane after" is P2 (P2-2). */
export type Relation = "at" | "opposite" | "behind" | "near";

export type Confidence = "low" | "medium" | "high";

/** One OpenStreetMap feature the server fetched for the locality. The model may only pick from these. */
export interface OsmFeature {
  /** e.g. "node/123", "way/456". Code rejects any id the model returns that isn't in the fetched set. */
  osmId: string;
  name: string;
  /** Main OSM tag, e.g. "amenity=place_of_worship". */
  kind: string;
  /** Representative point (centroid for ways). */
  point: LatLon;
}

/** The AI's proposal for the door. Placed by plain code from a landmark + relation, never by the model. */
export interface CandidatePin {
  point: LatLon;
  landmark: OsmFeature;
  relation: Relation;
  confidence: Confidence;
  /** Distance in metres from the landmark's point, computed by plain code. */
  metresFromLandmark: number;
}

/** Directions text in every language, written from the confirmed pin. */
export type DirectionsText = Record<Language, string>;

/**
 * The household's exact address. Stored only sealed to the household key (Arkiv `pata.home.v1`).
 * Never sent to our server, a model, or map search.
 */
export interface HomeRecord {
  version: 1;
  digipin: string;
  pin: LatLon;
  locality: Locality;
  /** Typed by the household; never leaves the device except inside sealed records. */
  roomNumber: string;
  writtenAddress: string;
  directions: DirectionsText;
  /** Arkiv entity keys of the three `pata.voice.v1` clips. */
  voiceKeys: Record<Language, `0x${string}`>;
}

/** What one grant unlocks. Sealed to that grant's session key (Arkiv `pata.grant.v1`). */
export interface GrantPayload {
  version: 1;
  requester: RequesterInfo;
  purpose: string;
  language: Language;
  digipin: string;
  pin: LatLon;
  locality: Locality;
  roomNumber: string;
  writtenAddress: string;
  directions: string;
  /** MP3 bytes of the directions clip in `language`, base64. Fits the 128 KiB Arkiv budget (hour-0 test). */
  audioMp3Base64: string;
  /** Unix seconds; same value as the ENS grant's expiry. */
  grantEnd: number;
}

/** Who is asking. The ENS name is optional; the mock seller has one in P1-5. */
export interface RequesterInfo {
  displayName: string;
  ensName?: string;
}

/** A request for the household's address, shown on the consent screen. */
export interface GrantRequest {
  requester: RequesterInfo;
  purpose: string;
  language: Language;
  /** Seconds. The stage grant is 20. */
  durationSeconds: number;
}

/** A read-only entry, sealed to the household (Arkiv `pata.history.v1`). */
export interface HistoryEntry {
  version: 1;
  kind: "issued" | "revoked";
  /** The grant's opaque label. */
  grantLabel: string;
  requester: RequesterInfo;
  purpose: string;
  /** Unix seconds. */
  at: number;
  grantEnd: number;
}

/** A grant as the household's live-access list shows it. */
export interface LiveGrant {
  grantLabel: string;
  payloadKey: `0x${string}`;
  requester: RequesterInfo;
  purpose: string;
  grantEnd: number;
}
