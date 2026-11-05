// The contract between the app and the server (Cloudflare Worker).
// The app calls these through src/lib/server-client; the server validates every body with these schemas.
// Privacy rules (CLAUDE.md invariants): the model and Sarvam get only the way to the door and the
// directions written from it; map search gets only landmark names and the locality; the room number
// never appears in any of these bodies.
import { z } from "zod";
import { LANGUAGES } from "./domain";

export const Language = z.enum(LANGUAGES);

const LatLon = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
const Locality = z.object({
  name: z.string().min(1).max(80),
  pinCode: z.string().regex(/^\d{6}$/),
});
const Relation = z.enum(["at", "opposite", "behind", "near"]);
const OsmFeature = z.object({
  osmId: z.string().regex(/^(node|way|relation)\/\d+$/),
  name: z.string(),
  kind: z.string(),
  point: LatLon,
});
const CandidatePin = z.object({
  point: LatLon,
  landmark: OsmFeature,
  relation: Relation,
  confidence: z.enum(["low", "medium", "high"]),
  metresFromLandmark: z.number(),
});
const Address = z.custom<`0x${string}`>(
  (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v),
);
const Hex = z.custom<`0x${string}`>(
  (v) => typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v),
);

// ---- Signed requests ----
// Every route except GET /health needs these headers, signed by the household account
// (EIP-191 personal_sign over signedMessage(...)). The server rejects timestamps older than 120 s.

export const SIGNATURE_HEADERS = {
  address: "x-pata-address",
  timestamp: "x-pata-timestamp",
  signature: "x-pata-signature",
} as const;

/** The exact string the household signs. `bodySha256` is lowercase hex of SHA-256 over the raw body bytes. */
export function signedMessage(
  route: string,
  timestamp: number,
  bodySha256: string,
): string {
  return `pata:v1:${route}:${timestamp}:${bodySha256}`;
}

// ---- Routes ----

export const ROUTES = {
  topup: "/topup",
  register: "/register",
  addressExtract: "/address/extract",
  addressRank: "/address/rank",
  addressDirections: "/address/directions",
  speechIn: "/speech/in",
  speechOut: "/speech/out",
} as const;

/** POST /topup: the relay sends gas to the signing household if it's below target. */
export const TopupRequest = z.object({ chain: z.enum(["sepolia", "arkiv"]) });
export const TopupResponse = z.object({
  txHash: Hex.nullable(),
  balanceWei: z.string(),
});

/** POST /register: the relay registers `<label>.pata.eth` to the signing household (owner = signer). */
export const RegisterRequest = z.object({
  label: z.string(),
  resolver: Address,
  grantRegistry: Address,
});
export const RegisterResponse = z.object({ txHash: Hex });

/** POST /address/extract: Haiku pulls locality and landmark phrases out of the way to the door. */
export const ExtractRequest = z.object({
  wayToTheDoor: z.string().min(3).max(2000),
  language: Language,
});
export const ExtractResponse = z.object({
  locality: Locality.nullable(),
  landmarkPhrases: z.array(z.string()).max(8),
});

/** POST /address/rank: OSM features in the locality → Sonnet picks landmarks + relations → code places pins. */
export const RankRequest = z.object({
  wayToTheDoor: z.string().min(3).max(2000),
  locality: Locality,
  landmarkPhrases: z.array(z.string()).max(8),
});
export const RankResponse = z.object({
  /** Up to 3, best first. Empty means "no landmark found": open the map for a hand-dropped pin. */
  candidates: z.array(CandidatePin).max(3),
  /** [west, south, east, north] of the locality, to frame the map. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** True when more than one feature in the locality has the landmark's name (P1-6). */
  duplicateLandmarkName: z.boolean(),
});

/** POST /address/directions: directions in all three languages, from the confirmed pin. */
export const DirectionsRequest = z.object({
  wayToTheDoor: z.string().min(3).max(2000),
  pin: LatLon,
  landmarks: z
    .array(
      z.object({ feature: OsmFeature, relation: Relation, metres: z.number() }),
    )
    .max(5),
});
export const DirectionsResponse = z.object({
  directions: z.object({ hi: z.string(), mr: z.string(), en: z.string() }),
});

/** POST /speech/in?lang=hi: body is the raw recording (audio/webm or audio/mp4, ≤ 30 s). */
export const SpeechInResponse = z.object({ transcript: z.string() });

/** POST /speech/out: returns audio/mpeg bytes (MP3, 16 kHz). */
export const SpeechOutRequest = z.object({
  text: z.string().min(1).max(2500),
  language: Language,
});

export type TopupRequest = z.infer<typeof TopupRequest>;
export type TopupResponse = z.infer<typeof TopupResponse>;
export type RegisterRequest = z.infer<typeof RegisterRequest>;
export type RegisterResponse = z.infer<typeof RegisterResponse>;
export type ExtractRequest = z.infer<typeof ExtractRequest>;
export type ExtractResponse = z.infer<typeof ExtractResponse>;
export type RankRequest = z.infer<typeof RankRequest>;
export type RankResponse = z.infer<typeof RankResponse>;
export type DirectionsRequest = z.infer<typeof DirectionsRequest>;
export type DirectionsResponse = z.infer<typeof DirectionsResponse>;
export type SpeechInResponse = z.infer<typeof SpeechInResponse>;
export type SpeechOutRequest = z.infer<typeof SpeechOutRequest>;

/** Error body for every non-2xx response. Never echo the request body back. */
export const ErrorResponse = z.object({ error: z.string(), code: z.string() });
export type ErrorResponse = z.infer<typeof ErrorResponse>;
