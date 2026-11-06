// Fake flows for frontend development and offline/localhost testing (docs/team/frontend.md).
// Matches the exact signatures of setup-household.ts and ens/household.ts.
// Delete before hour 20 once all live server/chain flows are switched over.
import type {
  CandidatePin,
  DirectionsText,
  GrantPayload,
  GrantRequest,
  Language,
  LatLon,
  Locality,
  OsmFeature,
  Relation,
} from "../../../shared/domain";
import type { RankResponse } from "../../../shared/api";
import { DEMO_BBOX } from "../map/config";
import { GRANT_LATENCY_MARGIN_SECONDS, PROVIDER_NAME } from "../../../shared/constants";
import { encodeDigipin } from "../digipin";
import {
  deriveGrantIdentity,
  deriveHouseholdKeys,
  newRandomRoot,
  newSessionKey,
  type HouseholdKeys,
} from "../keys";
import {
  loadDeviceRoot,
  loadHouseholdState as loadStoredHouseholdState,
  saveDeviceRoot,
  saveHouseholdState,
  type HouseholdState,
} from "../keys/store";
import { isValidHouseholdLabel, suggestHouseholdLabel } from "../ens/names";
import { formatCourierLink, parseCourierFragment } from "../link";
import type { NewHousehold, SetupStep } from "./setup-household";
import type { ApprovedGrant } from "./approve-grant";
import type { CourierView } from "./courier";

export { isValidHouseholdLabel, suggestHouseholdLabel };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function signIn(): Promise<HouseholdKeys> {
  await delay(250);
  let root = await loadDeviceRoot().catch(() => null);
  if (!root) {
    root = newRandomRoot();
    await saveDeviceRoot(root).catch(() => {});
  }
  return deriveHouseholdKeys(root);
}

export async function describeTheWay(
  keys: HouseholdKeys,
  input: Blob | string,
  language: Language,
): Promise<{
  wayToTheDoor: string;
  locality: Locality | null;
  landmarkPhrases: string[];
}> {
  void keys;
  await delay(500);
  const text =
    typeof input === "string"
      ? input.trim()
      : language === "hi"
        ? "हनुमान मंदिर के सामने, कुंभारवाड़ा गली नंबर 4, नीला दरवाज़ा, धारावी 400017"
        : language === "mr"
          ? "हनुमान मंदिरासमोर, कुंभारवाडा गल्ली क्र. ४, निळा दरवाजा, धारावी ४०००१७"
          : "Opposite Hanuman Mandir, Kumbharwada Lane 4, blue gate, Dharavi 400017";

  const lower = text.toLowerCase();
  const hasUnknownLocality =
    lower.includes("unknown") || lower.includes("no-locality");

  const pinMatch = text.match(/\b(\d{6})\b/);
  const locality: Locality | null = hasUnknownLocality
    ? null
    : {
        name: lower.includes("bkc") ? "Bandra Kurla Complex" : "Dharavi",
        pinCode: pinMatch ? pinMatch[1] : "400017",
      };

  return {
    wayToTheDoor: text,
    locality,
    landmarkPhrases: [
      "Hanuman Mandir",
      "Kumbharwada Post Office",
      "90 Feet Road Junction",
    ],
  };
}

export async function findCandidatePins(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  locality: Locality,
  landmarkPhrases: string[],
): Promise<RankResponse> {
  void keys;
  void locality;
  void landmarkPhrases;
  await delay(600);

  if (wayToTheDoor.toLowerCase().includes("no-pins")) {
    return {
      candidates: [],
      bbox: DEMO_BBOX,
      duplicateLandmarkName: false,
    };
  }

  const candidates: CandidatePin[] = [
    {
      point: { lat: 19.0432, lon: 72.8541 },
      landmark: {
        osmId: "node/101",
        name: "Hanuman Mandir",
        kind: "amenity=place_of_worship",
        point: { lat: 19.0431, lon: 72.854 },
      },
      relation: "opposite",
      confidence: "high",
      metresFromLandmark: 12,
    },
    {
      point: { lat: 19.0441, lon: 72.8555 },
      landmark: {
        osmId: "node/102",
        name: "Kumbharwada Post Office",
        kind: "amenity=post_office",
        point: { lat: 19.044, lon: 72.8553 },
      },
      relation: "behind",
      confidence: "medium",
      metresFromLandmark: 18,
    },
    {
      point: { lat: 19.0422, lon: 72.8528 },
      landmark: {
        osmId: "way/103",
        name: "90 Feet Road Junction",
        kind: "highway=secondary",
        point: { lat: 19.042, lon: 72.8525 },
      },
      relation: "near",
      confidence: "low",
      metresFromLandmark: 42,
    },
  ];

  return {
    candidates,
    bbox: DEMO_BBOX,
    duplicateLandmarkName: false,
  };
}

export async function makeDirections(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  confirmedPin: LatLon,
  landmarks: { feature: OsmFeature; relation: Relation }[],
): Promise<{
  directions: DirectionsText;
  clips: Partial<Record<Language, Uint8Array>>;
}> {
  void keys;
  void confirmedPin;
  await delay(600);

  const primaryLandmark = landmarks[0]?.feature.name ?? "Hanuman Mandir";
  const noteSnippet = wayToTheDoor.slice(0, 90);

  const directions: DirectionsText = {
    hi: `${primaryLandmark} के पास से अंदर आएं। ${noteSnippet} — नीले गेट से दूसरी सीढ़ी चढ़ें।`,
    mr: `${primaryLandmark} जवळून आत या. निळ्या गेटमधून दुसऱ्या जिन्याने वर या.`,
    en: `Enter opposite ${primaryLandmark}. Follow the lane past the blue gate to the doorway.`,
  };

  // Minimal valid 8 kHz ADTS AAC frame bytes for fake clip storage
  const dummyAac = new Uint8Array([
    0xff, 0xf1, 0x6c, 0x40, 0x01, 0x00, 0x00, 0xde,
  ]);

  return {
    directions,
    clips: {
      hi: dummyAac,
      mr: dummyAac,
      en: dummyAac,
    },
  };
}

export async function checkHouseholdName(
  label: string,
): Promise<"available" | "taken" | "invalid"> {
  if (!isValidHouseholdLabel(label)) return "invalid";
  return (await householdLabelStatus(label)) === 0 ? "available" : "taken";
}

export async function householdLabelStatus(
  label: string,
): Promise<0 | 1 | 2> {
  await delay(300);
  if (!isValidHouseholdLabel(label)) {
    throw new Error("Invalid household label");
  }
  if (label === "taken" || label === "sana-taken") {
    return 2;
  }
  return 0;
}

export async function createHousehold(
  keys: HouseholdKeys,
  input: NewHousehold,
  onProgress: (step: SetupStep) => void = () => {},
): Promise<HouseholdState> {
  void keys;
  if (!isValidHouseholdLabel(input.label)) {
    throw new Error("Invalid household name");
  }
  onProgress("topup-sepolia");
  await delay(350);
  onProgress("deploy");
  await delay(350);
  onProgress("register");
  await delay(500);
  onProgress("voice-records");
  await delay(400);
  onProgress("home-record");
  await delay(500);
  onProgress("save");

  const state: HouseholdState = {
    name: `${input.label}.${PROVIDER_NAME}`,
    resolver: "0x1111111111111111111111111111111111111111",
    grantRegistry: "0x2222222222222222222222222222222222222222",
    homeRecordKey:
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  };
  await saveHouseholdState(state).catch(() => {});
  onProgress("complete");
  return state;
}

export async function loadOrDefaultHouseholdState(): Promise<HouseholdState> {
  const existing = await loadStoredHouseholdState().catch(() => null);
  if (existing) return existing;
  return {
    name: `blue-gate.${PROVIDER_NAME}`,
    resolver: "0x1111111111111111111111111111111111111111",
    grantRegistry: "0x2222222222222222222222222222222222222222",
    homeRecordKey:
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  };
}

export async function approveGrant(
  keys: HouseholdKeys,
  household: HouseholdState,
  request: GrantRequest,
): Promise<ApprovedGrant> {
  void keys;
  await delay(450);

  if (
    !request.requester.displayName.trim() ||
    !request.purpose.trim() ||
    !Number.isSafeInteger(request.durationSeconds) ||
    request.durationSeconds <= 0
  ) {
    throw new Error("Could not approve grant");
  }

  const sessionKey = newSessionKey();
  const identity = await deriveGrantIdentity(sessionKey);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const grantEnd =
    nowSeconds + request.durationSeconds + GRANT_LATENCY_MARGIN_SECONDS;

  const payloadKey =
    "0x9988776655443322110099887766554433221100998877665544332211009988" as const;

  const origin =
    typeof location !== "undefined" && location.origin
      ? location.origin
      : "http://localhost:3000";

  const courierLink = formatCourierLink(origin, {
    householdName: household.name,
    payloadKey,
    sessionKey,
  });

  return {
    courierLink,
    grantLabel: identity.label,
    grantEnd,
  };
}

const fakeGrantDeadlines = new Map<string, number>();

export async function checkCourierLink(
  fragmentOrStored: string,
): Promise<CourierView> {
  const link = parseCourierFragment(fragmentOrStored);
  if (!link) return { state: "invalid" };

  const suffix = `.${PROVIDER_NAME}`;
  if (
    !link.householdName.endsWith(suffix) ||
    !isValidHouseholdLabel(link.householdName.slice(0, -suffix.length)) ||
    !/^0x[\da-fA-F]{64}$/.test(link.payloadKey) ||
    link.sessionKey.length !== 32
  ) {
    link.sessionKey.fill(0);
    return { state: "invalid" };
  }

  const locality: Locality = {
    name: "Dharavi",
    pinCode: "400017",
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const key = `${link.householdName}:${link.payloadKey.toLowerCase()}`;

  // If payloadKey is all zeros, treat as already ended immediately
  if (/^0x0{64}$/.test(link.payloadKey)) {
    link.sessionKey.fill(0);
    return { state: "ended", locality };
  }

  let grantEnd = fakeGrantDeadlines.get(key);
  if (!grantEnd) {
    // Decode optional expiry encoded in the last 4 bytes of payloadKey if non-standard,
    // otherwise default to 20s from first open so live → ended transition works on phones and in tests.
    grantEnd = nowSeconds + 20;
    fakeGrantDeadlines.set(key, grantEnd);
  }

  if (nowSeconds >= grantEnd) {
    link.sessionKey.fill(0);
    return { state: "ended", locality };
  }

  const pin: LatLon = { lat: 19.0432, lon: 72.8541 };
  const payload: GrantPayload = {
    version: 1,
    requester: { displayName: "Delivery Partner" },
    purpose: "Doorstep delivery",
    language: "hi",
    digipin: encodeDigipin(pin),
    pin,
    locality,
    roomNumber: "Room 14, Chawl 3, 2nd Floor",
    writtenAddress:
      "Opposite Hanuman Mandir, Kumbharwada Lane 4, blue gate, Dharavi 400017",
    directions:
      "हनुमान मंदिर के सामने नीले गेट से अंदर आएं और दूसरी सीढ़ी चढ़ें।",
    grantEnd,
  };

  link.sessionKey.fill(0);
  return {
    state: "live",
    locality,
    payload,
    audio: null,
  };
}


