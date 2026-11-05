// Constants shared by the app and the server. Every address and value here is from
// docs/research/*.md ("Values to copy" tables). Don't add a value without its source note.

// ---- Chains ----

export const SEPOLIA_CHAIN_ID = 11155111;
export const RABDI_CHAIN_ID = 7794095;

/** Sepolia block time, observed (ens-v2.md, Limits). A grant flips on the first block at or after its expiry. */
export const SEPOLIA_BLOCK_SECONDS = 12;
/** Arkiv Rabdi block time (arkiv.md, Limits). */
export const ARKIV_BLOCK_SECONDS = 2;

// ---- ENSv2 on Sepolia (ens-v2.md, Values to copy) ----

export const ENS = {
  universalResolver: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
  universalHelper: "0xd453e5bdb62cc3bea84341b1e306319c8ffd7dfe",
  rootRegistry: "0xb458d6a3a77919449d03e7a6903c26827c1ec43f",
  ethRegistry: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4",
  ethRegistrar: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
  mockUsdc: "0x240b0316df57887dbbe58b586508b19e633a14aa",
  verifiableFactory: "0xda70306c98e97ece36f997a21368e53298572991",
  userRegistryImpl: "0x9bd8a88719068d09ecee662f36c0e3856708366a",
  permissionedResolverImpl: "0x115eb53f0c60696633855f90b138178fb40b2b2c",
  labelStore: "0xed8246ff02203a4d4cb262bd78beaa7408a57cae",
} as const;

/** The provider's parent name. Fallbacks if taken at kick-off: pata-in.eth, patanet.eth (handoff). */
export const PROVIDER_NAME = "pata.eth";
/** The grid parent name. Fallbacks: digipin-grid.eth, digipin-in.eth. */
export const GRID_NAME = "digipin.eth";

/** `type(uint64).max`: a household name that never expires. */
export const FOREVER_EXPIRY = 18446744073709551615n;

/** Registry status enum (ens-v2.md). */
export const NAME_STATUS = {
  available: 0,
  reserved: 1,
  registered: 2,
} as const;

/**
 * Public text records on a household name. Only the locality, nothing exact.
 * `location` is ENSIP-5's free-text key. Pata's own keys use reverse-dot notation.
 */
export const RECORD_KEYS = {
  location: "location",
  pinCode: "eth.pata.pincode",
  /** On a grid name: "lat,lon" of the cell centre (DigipinResolver, P1-1). */
  gridLatLon: "eth.pata.latlon",
  agentContext: "agent-context",
  agentEndpointWeb: "agent-endpoint[web]",
} as const;

// ---- Arkiv (arkiv.md) ----

/** One schema per record type; each holds one sealed `bytes` column and nothing public. */
export const ARKIV_SCHEMAS = {
  home: "pata.home.v1",
  voice: "pata.voice.v1",
  grant: "pata.grant.v1",
  history: "pata.history.v1",
} as const;

/** Rabdi's lifetime cap is 182.5 days; create at 182 and extend (P1-8). */
export const ARKIV_MAX_DAYS = 182;
/** Sign-in extends home, voice and history records with less than this left (P1-8). */
export const ARKIV_EXTEND_BELOW_DAYS = 90;
/** All bytes values of one create share one 128 KiB budget. */
export const ARKIV_MAX_BYTES = 128 * 1024;

// ---- Anon-RPC (anon-rpc.md) ----

/** Nox worker specifier on Sepolia, the one worker for both chains. */
export const NOX_SPECIFIER = "0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A";

// ---- Grants ----

/** Grant labels: 8 lowercase base32 characters derived from the session key (ADR 0004). */
export const GRANT_LABEL_LENGTH = 8;
/** Added to a grant's end to cover inclusion latency. Set from the hour-0 Nox latency test (P0-3). */
export const GRANT_LATENCY_MARGIN_SECONDS = 30;
/** Courier link format version (ADR 0006). Never change the meaning of an existing version. */
export const COURIER_LINK_VERSION = "1";

// ---- Household names (ADR 0006) ----

/** 3–32 chars of a-z, 0-9 and hyphen; no hyphen at either end; no "--". */
export const HOUSEHOLD_LABEL_PATTERN =
  /^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/;

// ---- Address AI ----

export const MODELS = {
  extract: "claude-haiku-5-5",
  rank: "claude-sonnet-5-5",
  directions: "claude-sonnet-5-5",
} as const;

/** "We're not sure" fires when the top two candidate pins are further apart than this (P1-6). */
export const NOT_SURE_SPREAD_METRES = 50;
/** The accuracy test counts a pin within this distance as right (P1-9). */
export const ACCURACY_METRES = 25;
