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
import type { HouseholdState } from "../keys/store";
import { deriveHouseholdKeys, newRandomRoot } from "../keys";
import { loadDeviceRoot, saveDeviceRoot } from "../keys/store";
import { withDeviceLock } from "../keys/device-lock";
import { topup, registerName } from "../server-client";
import { deployHouseholdContracts } from "../ens/household";
import { dnsEncode, isValidHouseholdLabel } from "../ens/names";
import { universalHelperAbi } from "../ens/abis";
import { sepoliaPublicClient, arkivPublicClient } from "../rpc";
import { createHomeRecord } from "../arkiv";
import { encodeDigipin } from "../digipin";
import { saveHouseholdState, loadSetupCheckpoint, saveSetupCheckpoint } from "../keys/store";
import { sealJson, openJson } from "../seal";
import { ENS, PROVIDER_NAME, RECORD_KEYS, ARKIV_MAX_BYTES } from "../../../shared/constants";

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

/** Step 2: spoken (Blob) or typed (string) way to the door → transcript, locality, landmark phrases. */
export async function describeTheWay(
  keys: HouseholdKeys,
  input: Blob | string,
  language: Language,
): Promise<{ wayToTheDoor: string; locality: Locality | null; landmarkPhrases: string[] }> {
  void keys;
  void input;
  void language;
  throw new Error("describeTheWay: not implemented (P0-7)");
}

/** Step 3–4: candidate pins from the server. Empty candidates → hand-dropped pin. */
export async function findCandidatePins(
  keys: HouseholdKeys,
  wayToTheDoor: string,
  locality: Locality,
  landmarkPhrases: string[],
): Promise<RankResponse> {
  void keys;
  void wayToTheDoor;
  void locality;
  void landmarkPhrases;
  throw new Error("findCandidatePins: not implemented (P0-7)");
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
export type SetupStep =
  "topup-sepolia" | "topup-arkiv" | "deploy" | "register" | "resolve" | "home-record" | "save" | "complete";

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
    const home: HomeRecord = {
      version: 1,
      digipin: encodeDigipin(input.confirmedPin),
      pin: input.confirmedPin,
      locality: input.locality,
      roomNumber: input.roomNumber,
      writtenAddress: input.writtenAddress,
      directions: input.directions,
      voiceKeys: input.voiceKeys,
    };
    // Seal v1 adds one version byte, a 12-byte IV and a 16-byte authentication tag.
    if (new TextEncoder().encode(JSON.stringify(home)).byteLength + 29 > ARKIV_MAX_BYTES)
      throw new Error("Home record is too large");
    const checkpoint = (await loadSetupCheckpoint(keys.address)) ?? {
      name,
      sealedHome: await sealJson(keys.sealKey, home),
    };
    if (
      checkpoint.name !== name ||
      JSON.stringify(await openJson(keys.sealKey, checkpoint.sealedHome)) !== JSON.stringify(home)
    )
      throw new Error("Resume setup with the original household details");
    const save = () => saveSetupCheckpoint(keys.address, checkpoint);
    if (checkpoint.pending)
      throw new Error(`Setup ${checkpoint.pending} needs transaction verification before retrying`);
    await save();
    for (const chain of ["sepolia", "arkiv"] as const) {
      const field = chain === "sepolia" ? "sepoliaFunded" : "arkivFunded";
      if (checkpoint[field]) continue;
      onProgress(chain === "sepolia" ? "topup-sepolia" : "topup-arkiv");
      let fundingHash = checkpoint.fundingHashes?.[chain];
      if (!fundingHash) {
        checkpoint.pending = chain === "sepolia" ? "topup-sepolia" : "topup-arkiv";
        await save();
        const response = await topup(keys, { chain }).catch(() => {
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
      checkpoint.pending = "deploy";
      await save();
      checkpoint.contracts = await deployHouseholdContracts(keys, name, input.locality);
      delete checkpoint.pending;
      await save();
    }
    const contracts = checkpoint.contracts;
    if (!checkpoint.registered) {
      onProgress("register");
      if (!checkpoint.registrationHash) {
        checkpoint.pending = "register";
        await save();
        const registration = await registerName(keys, { label: input.label, ...contracts }).catch(() => {
          throw new Error("Could not register household name");
        });
        checkpoint.registrationHash = registration.txHash;
        delete checkpoint.pending;
        await save();
      }
      if (!(await confirmTransaction("sepolia", checkpoint.registrationHash))) {
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
    if (!checkpoint.homeRecordKey) {
      onProgress("home-record");
      checkpoint.pending = "home-record";
      await save();
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
