// Fake flows for frontend development and offline/localhost testing (docs/team/frontend.md).
// Matches the exact signatures of setup-household.ts and ens/household.ts.
// Delete before hour 20 once all live server/chain flows are switched over.
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
import { DEMO_BBOX } from "../map/config";
import { PROVIDER_NAME } from "../../../shared/constants";
import { deriveHouseholdKeys, newRandomRoot, type HouseholdKeys } from "../keys";
import {
  loadDeviceRoot,
  saveDeviceRoot,
  saveHouseholdState,
  type HouseholdState,
} from "../keys/store";
import { isValidHouseholdLabel, suggestHouseholdLabel } from "../ens/names";
import type { NewHousehold, SetupStep } from "./setup-household";

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
  voiceKeys: Record<Language, `0x${string}`>;
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

  // Minimal valid MP3 frame bytes for fake clip storage
  const dummyMp3 = new Uint8Array([
    0xff, 0xf3, 0x48, 0xc4, 0x00, 0x00, 0x00, 0x03, 0x48, 0x00, 0x00, 0x00,
  ]);

  return {
    directions,
    clips: {
      hi: dummyMp3,
      mr: dummyMp3,
      en: dummyMp3,
    },
    voiceKeys: {
      hi: "0x1111111111111111111111111111111111111111111111111111111111111111",
      mr: "0x2222222222222222222222222222222222222222222222222222222222222222",
      en: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
  };
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
