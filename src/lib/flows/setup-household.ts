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
  HomeRecord,
} from "../../../shared/domain";
import type { RankResponse } from "../../../shared/api";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState, SetupCheckpoint } from "../keys/store";
import { LANGUAGES } from "../../../shared/domain";
import { distanceMetres } from "../../../shared/geo";
import { toHex } from "viem";
import { deriveHouseholdKeys, newRandomRoot } from "../keys";
import { loadDeviceRoot, saveDeviceRoot } from "../keys/store";
import { withDeviceLock } from "../keys/device-lock";
import {
  topup,
  registerName,
  extractAddress,
  rankLandmarks,
  speechToText,
  writeDirections,
} from "../server-client";
import { RecordingInputError } from "../server-client/recording";
import { ServerError } from "../server-client/signed";
import { ensureArkivGas } from "./arkiv-gas";
import { deployHouseholdContracts, householdLabelStatus } from "../ens/household";
import { dnsEncode, isValidHouseholdLabel } from "../ens/names";
import { universalHelperAbi } from "../ens/abis";
import { sepoliaPublicClient, arkivPublicClient } from "../rpc";
import { createHomeRecord, createVoiceRecord } from "../arkiv";
import { canonicalJson } from "../arkiv/reuse";
import { encodeDigipin, DIGIPIN_BOUNDS } from "../digipin";
import { saveHouseholdState, loadSetupCheckpoint, saveSetupCheckpoint } from "../keys/store";
import { sealJson, openJson } from "../seal";
import {
  ENS,
  PROVIDER_NAME,
  RECORD_KEYS,
  ARKIV_MAX_BYTES,
  MAX_VOICE_CLIP_BYTES,
} from "../../../shared/constants";

/** P0: load the device root or make a new one; P1-3: passkey. */
export async function signIn(): Promise<HouseholdKeys> {
  return withDeviceLock("sign-in", async () => {
    let root = await loadDeviceRoot();
    if (!root) {
      root = newRandomRoot();
      await saveDeviceRoot(root);
    }
    return deriveHouseholdKeys(root);
  });
}

/** Step 1: a default name (never derived from the address; names are public, ADR 0006). */
export { suggestHouseholdLabel, isValidHouseholdLabel } from "../ens/names";

const STEP_WORDS: Record<SetupStep, string> = {
  "topup-sepolia": "getting Sepolia gas",
  "topup-arkiv": "getting Arkiv gas",
  deploy: "deploying your home's contracts",
  register: "registering your home's name",
  resolve: "checking that your name resolves",
  "voice-records": "saving the voice clips",
  "home-record": "saving your sealed home",
  save: "saving on this phone",
  complete: "finishing",
};

/** A plain sentence for a failed createHousehold: the step it stopped at, never the raw error. */
export function createHouseholdError(failure: unknown, step: SetupStep | null): string {
  if (failure instanceof Error && failure.message === "Resume setup with the original household details")
    return "This phone already started saving a home with different details, so it can't resume. To start over, clear this site's data (Chrome: Settings → Site settings → All sites → pata) and set up again.";
  const where = step ? ` It stopped while ${STEP_WORDS[step]}.` : "";
  return `Could not finish saving your home right now.${where} Tap Retry to resume from where it stopped.`;
}

/** True when the server couldn't place "area, PIN" on the map at all: retrying can't help, editing can. */
export function isLocalityNotFound(failure: unknown): boolean {
  return failure instanceof ServerError && failure.status === 422 && failure.code === "locality_not_found";
}

/** A plain sentence for a failed describeTheWay; never the raw error, which may carry request details. */
export function describeTheWayError(failure: unknown): string {
  if (failure instanceof RecordingInputError)
    return failure.status === 422 && /30 seconds/.test(failure.message)
      ? "That recording was too long. Keep it under 28 seconds and try again."
      : "This phone's recording format isn't supported. Please type how people find your door instead.";
  if (failure instanceof ServerError && failure.code === "speech_unavailable")
    return "We couldn't hear any words in that recording. Hold the phone closer, speak clearly, and try again, or type it instead.";
  return "Could not understand the address description right now. Please tap Retry.";
}

/** Step 1: whether a household label can be registered in pata.eth. Reserved counts as taken. */
export async function checkHouseholdName(label: string): Promise<"available" | "taken" | "invalid"> {
  if (!isValidHouseholdLabel(label)) return "invalid";
  return (await householdLabelStatus(label)) === 0 ? "available" : "taken";
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

/** The setup screen's typed address fields, which replace the recorded way to the door (ADR 0010). */
export interface TypedAddress {
  /** With pinCode, the public locality. */
  localityName: string;
  pinCode: string;
  /** Optional; the only field that reaches map search, beside the locality. */
  landmark: string;
  /** Gate, lane, stairs: how to find the door once near it. */
  doorNotes: string;
}

export type TypedAddressResult =
  | { ok: true; wayToTheDoor: string; locality: Locality; landmarkPhrases: string[] }
  | { ok: false; problem: string };

/** Step 2: typed fields → the way to the door, locality and landmark phrases, with no model call. */
export function describeTypedAddress(fields: TypedAddress): TypedAddressResult {
  const localityName = fields.localityName.trim().replace(/\s+/g, " ");
  const pinCode = fields.pinCode.replace(/\s+/g, "");
  const landmark = fields.landmark.trim().replace(/\s+/g, " ");
  const doorNotes = fields.doorNotes.trim().replace(/[\s,.;]+$/, "");
  if (!localityName || localityName.length > 80)
    return { ok: false, problem: "Enter your area or neighbourhood (up to 80 letters)." };
  if (!/^\d{6}$/.test(pinCode)) return { ok: false, problem: "Enter your 6-digit PIN code." };
  if (landmark.length > 80)
    return { ok: false, problem: "Keep the landmark to one short name (up to 80 letters)." };
  if (!doorNotes) return { ok: false, problem: "Say how to find your door: the gate, the lane, the floor." };
  if (doorNotes.length > 1000)
    return { ok: false, problem: "Shorten how to find your door (up to 1000 letters)." };
  return {
    ok: true,
    wayToTheDoor: [doorNotes, landmark && `near ${landmark}`, `${localityName} ${pinCode}`]
      .filter(Boolean)
      .join(", "),
    locality: { name: localityName, pinCode },
    landmarkPhrases: landmark ? [landmark] : [],
  };
}

export interface HomeFix {
  pin: LatLon;
  accuracyMetres: number;
}

export class LocateError extends Error {
  constructor(readonly reason: "unsupported" | "denied" | "unavailable" | "timeout" | "outside") {
    super(`Location ${reason}`);
  }
}

/**
 * Step 2, optional: the phone's position as the starting pin, which the household then adjusts.
 * With a fix, setup skips the landmark search, so the position never reaches map search.
 */
export async function locateHome(
  geolocation: Geolocation | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation,
): Promise<HomeFix> {
  if (!geolocation) throw new LocateError("unsupported");
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    geolocation.getCurrentPosition(
      resolve,
      (failure) =>
        reject(
          new LocateError(failure.code === 1 ? "denied" : failure.code === 3 ? "timeout" : "unavailable"),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    ),
  );
  const pin = { lat: position.coords.latitude, lon: position.coords.longitude };
  const { minLat, maxLat, minLon, maxLon } = DIGIPIN_BOUNDS;
  if (!(pin.lat >= minLat && pin.lat <= maxLat && pin.lon >= minLon && pin.lon <= maxLon))
    throw new LocateError("outside");
  return { pin, accuracyMetres: position.coords.accuracy };
}

/** A plain sentence for a failed locateHome; the typed landmark is always the way forward. */
export function locateHomeError(failure: unknown): string {
  switch (failure instanceof LocateError ? failure.reason : "unavailable") {
    case "unsupported":
      return "This browser can't share your location. Type a nearby landmark instead.";
    case "denied":
      return "Location is blocked for this site. Allow it (tap the icon left of the address bar → Permissions → Location), or type a nearby landmark instead.";
    case "timeout":
      return "Your phone took too long to find you. Step near a window and try again, or type a nearby landmark.";
    case "outside":
      return "Your location is outside India's DIGIPIN grid. Type a nearby landmark instead.";
    default:
      return "Your phone couldn't find its location. Turn on location and try again, or type a nearby landmark.";
  }
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

/**
 * Step 5: the directions text in each language. No speech synthesis (ADR 0010): the phone's own
 * speechSynthesis reads the text, so setup makes no voice records and approval no grant audio.
 */
export async function makeDirections(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  confirmedPin: LatLon,
  landmarks: { feature: OsmFeature; relation: Relation }[],
): Promise<{ directions: DirectionsText }> {
  const { directions } = await writeDirections(keys, {
    wayToTheDoor,
    pin: confirmedPin,
    landmarks: landmarks.map(({ feature, relation }) => ({
      feature,
      relation,
      metres: distanceMetres(confirmedPin, feature.point),
    })),
  });
  return { directions };
}

export interface NewHousehold {
  label: string;
  locality: Locality;
  confirmedPin: LatLon;
  /** Typed; never leaves the device except sealed. */
  roomNumber: string;
  writtenAddress: string;
  directions: DirectionsText;
  /**
   * Setup no longer makes clips (ADR 0010), so the screen leaves this out. Any clips given are still
   * stored as voice records (ADR 0009); without them, speechSynthesis reads the text (ADR 0007).
   */
  voiceClips?: Partial<Record<Language, Uint8Array>>;
  candidates: CandidatePin[];
}

/** Steps 6–8: topup, factory deploys, /register, locality record, sealed home record. */
export type SetupStep =
  | "topup-sepolia"
  | "topup-arkiv"
  | "deploy"
  | "register"
  | "resolve"
  | "voice-records"
  | "home-record"
  | "save"
  | "complete";

async function confirmTransaction(chain: "sepolia" | "arkiv", hash: `0x${string}`): Promise<boolean> {
  try {
    const client = chain === "sepolia" ? sepoliaPublicClient() : arkivPublicClient();
    return (await client.waitForTransactionReceipt({ hash })).status === "success";
  } catch {
    throw new Error("Could not confirm household transaction");
  }
}

async function waitForHousehold(
  name: string,
  ownerAddress: `0x${string}`,
  locality: Locality,
): Promise<void> {
  const client = sepoliaPublicClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [owner, location, pinCode] = await Promise.all([
        client.readContract({
          address: ENS.universalHelper,
          abi: universalHelperAbi,
          functionName: "findExactOwner",
          args: [dnsEncode(name)],
        }),
        client.getEnsText({
          name,
          key: RECORD_KEYS.location,
          universalResolverAddress: ENS.universalResolver,
        }),
        client.getEnsText({
          name,
          key: RECORD_KEYS.pinCode,
          universalResolverAddress: ENS.universalResolver,
        }),
      ]);
      if (
        owner.toLowerCase() === ownerAddress.toLowerCase() &&
        location === `${locality.name}, ${locality.pinCode}` &&
        pinCode === locality.pinCode
      )
        return;
    } catch {
      /* RPC errors may contain request bodies: expose only the final plain message. */
    }
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Household name has not resolved yet. Retry to check again.");
}

export async function createHousehold(
  keys: HouseholdKeys,
  input: NewHousehold,
  onProgress: (step: SetupStep) => void = () => {},
): Promise<HouseholdState> {
  return withDeviceLock("household-setup", async () => {
    if (
      !isValidHouseholdLabel(input.label) ||
      !input.locality.name.trim() ||
      input.locality.name.length > 80 ||
      !/^\d{6}$/.test(input.locality.pinCode)
    )
      throw new Error("Invalid household details");
    const name = `${input.label}.${PROVIDER_NAME}`;
    const voiceClips = input.voiceClips ?? {};
    const clipLanguages = LANGUAGES.filter((language) => voiceClips[language] !== undefined);
    for (const language of clipLanguages) {
      const clip = voiceClips[language];
      if (!(clip instanceof Uint8Array) || clip.byteLength === 0 || clip.byteLength > MAX_VOICE_CLIP_BYTES)
        throw new Error("Invalid or oversized voice clip");
    }
    const homeDraft: Omit<HomeRecord, "voiceKeys"> = {
      version: 1,
      digipin: encodeDigipin(input.confirmedPin),
      pin: input.confirmedPin,
      locality: input.locality,
      roomNumber: input.roomNumber,
      writtenAddress: input.writtenAddress,
      directions: input.directions,
    };
    const placeholder = toHex(new Uint8Array(32));
    const sizedHome = { ...homeDraft, voiceKeys: { hi: placeholder, mr: placeholder, en: placeholder } };
    // Seal v1 adds one version byte, a 12-byte IV and a 16-byte authentication tag.
    if (new TextEncoder().encode(JSON.stringify(sizedHome)).byteLength + 29 > ARKIV_MAX_BYTES)
      throw new Error("Home record is too large");
    const sealedInput = {
      ...homeDraft,
      voiceClips: Object.fromEntries(
        clipLanguages.map((language) => [language, toHex(voiceClips[language]!)]),
      ),
    };
    const checkpoint: SetupCheckpoint = (await loadSetupCheckpoint(keys.address)) ?? {
      name,
      inputVersion: 2,
      sealedHome: await sealJson(keys.sealKey, sealedInput),
    };
    if (checkpoint.name !== name) throw new Error("Resume setup with the original household details");
    if (checkpoint.inputVersion === 2) {
      if (canonicalJson(await openJson(keys.sealKey, checkpoint.sealedHome)) !== canonicalJson(sealedInput))
        throw new Error("Resume setup with the original household details");
    } else {
      const { voiceKeys, ...oldDraft } = await openJson<HomeRecord>(keys.sealKey, checkpoint.sealedHome);
      if (canonicalJson(oldDraft) !== canonicalJson(homeDraft))
        throw new Error("Resume setup with the original household details");
      checkpoint.voiceKeys = voiceKeys;
      checkpoint.inputVersion = 2;
      checkpoint.sealedHome = await sealJson(keys.sealKey, sealedInput);
    }
    const save = () => saveSetupCheckpoint(keys.address, checkpoint);
    // Old journals may retain an intent after a crash. Each remaining step reconciles
    // through the server, predicted proxy code or owner-filtered record discovery.
    delete checkpoint.pending;
    await save();
    for (const chain of ["sepolia", "arkiv"] as const) {
      const field = chain === "sepolia" ? "sepoliaFunded" : "arkivFunded";
      if (checkpoint[field]) continue;
      onProgress(chain === "sepolia" ? "topup-sepolia" : "topup-arkiv");
      let fundingHash = checkpoint.fundingHashes?.[chain];
      if (!fundingHash) {
        const response = await topup(keys, { chain }).catch(async () => {
          delete checkpoint.pending;
          await save();
          throw new Error(`Could not fund household on ${chain}`);
        });
        delete checkpoint.pending;
        if (response.txHash) {
          fundingHash = response.txHash;
          checkpoint.fundingHashes = { ...checkpoint.fundingHashes, [chain]: fundingHash };
        }
        await save();
      }
      if (fundingHash && !(await confirmTransaction(chain, fundingHash))) {
        delete checkpoint.fundingHashes?.[chain];
        await save();
        throw new Error("Household funding transaction reverted. Retry to request funding again.");
      }
      checkpoint[field] = true;
      await save();
    }
    if (!checkpoint.contracts) {
      onProgress("deploy");
      checkpoint.contracts = await deployHouseholdContracts(keys, name, input.locality);
      delete checkpoint.pending;
      await save();
    }
    const contracts = checkpoint.contracts;
    if (!checkpoint.registered) {
      onProgress("register");
      if (!checkpoint.registrationHash) {
        const registration = await registerName(keys, { label: input.label, ...contracts }).catch(
          async () => {
            delete checkpoint.pending;
            await save();
            throw new Error("Could not register household name");
          },
        );
        // The relay can confirm existing ownership without a saved transaction hash.
        // Universal owner/locality resolution below remains mandatory in this case.
        checkpoint.registrationHash = registration.txHash ?? undefined;
        delete checkpoint.pending;
        await save();
      }
      if (
        checkpoint.registrationHash &&
        !(await confirmTransaction("sepolia", checkpoint.registrationHash))
      ) {
        delete checkpoint.registrationHash;
        await save();
        throw new Error("Household registration transaction reverted. Retry to register again.");
      }
      checkpoint.registered = true;
      await save();
    }
    if (!checkpoint.resolved) {
      onProgress("resolve");
      await waitForHousehold(name, keys.address, input.locality);
      checkpoint.resolved = true;
      await save();
    }
    // The first top-up is checkpointed, so a resumed setup asks again before its Arkiv writes.
    if (!checkpoint.homeRecordKey) await ensureArkivGas(keys);
    if (clipLanguages.some((language) => !checkpoint.voiceKeys?.[language])) {
      onProgress("voice-records");
      checkpoint.voiceKeys ??= {};
      for (const language of clipLanguages) {
        if (checkpoint.voiceKeys[language]) continue;
        checkpoint.voiceKeys[language] = await createVoiceRecord(keys, language, voiceClips[language]!);
        await save();
      }
    }
    const home: HomeRecord = {
      ...homeDraft,
      voiceKeys: Object.fromEntries(
        clipLanguages.map((language) => [language, checkpoint.voiceKeys![language]!]),
      ),
    };
    if (!checkpoint.homeRecordKey) {
      onProgress("home-record");
      checkpoint.homeRecordKey = await createHomeRecord(keys, home);
      delete checkpoint.pending;
      await save();
    }
    const state = { name, ...contracts, homeRecordKey: checkpoint.homeRecordKey };
    onProgress("save");
    await saveHouseholdState(state);
    onProgress("complete");
    return state;
  });
}
