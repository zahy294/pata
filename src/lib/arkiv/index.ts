// Arkiv records: four types, sealed bytes columns only. Owner: blockchain.
// Read docs/research/arkiv.md first. SDK 1.0.0 only: older examples (and AI-written code) use the
// pre-1.0 payload API. Log every surprise in arkiv/friction.md, one line each.
//
// pata.home.v1     household-sealed HomeRecord, 182 days, patchable          (P0-8)
// pata.voice.v1    household-sealed MP3 clip, one per language, 182 days     (P0-9, ADR 0007)
// pata.grant.v1    session-sealed GrantPayload, expires atDate(grantEnd)     (P0-10)
// pata.history.v1  household-sealed HistoryEntry, readonly, 182 days         (P0-10, P0-12)
//
// Every query filters ownedBy(household): anyone can write under our schema tags (arkiv.md Gotcha 2).
//
// ADR 0008: a pata.grant.v1 entity has TWO sealed bytes
// columns (one shared 128 KiB budget): `payload`, sealed to the session key (what the courier opens),
// and `index`, sealed to the household key ({ grantLabel, requester, purpose, grantEnd }). The payload
// key isn't known until the batch lands, so the history entry can't carry it; the index lets the
// household's own owner query build the live-access list and revoke (label + payload key) with no
// local state. Nothing readable is public either way.
import type { GrantPayload, HistoryEntry, HomeRecord, Language, LiveGrant } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import { ExpirationTime } from "@arkiv-network/sdk";
import { bytes } from "@arkiv-network/sdk/schema";
import { hexToBytes } from "viem";
import { ARKIV_MAX_DAYS } from "../../../shared/constants";
import { arkivPublicClient, arkivWalletClient } from "../rpc";
import { openJson, sealJson, openBytes, sealBytes } from "../seal";
import { homeSchema, voiceSchema } from "./schemas";

export type EntityKey = `0x${string}`;

export async function createHomeRecord(keys: HouseholdKeys, home: HomeRecord): Promise<EntityKey> {
  try {
    const result = await arkivWalletClient(keys.account).createEntity(
      homeSchema,
      { sealed: bytes(await sealJson(keys.sealKey, home)) },
      { expiration: ExpirationTime.fromDays(ARKIV_MAX_DAYS) },
    );
    return result.entityKey;
  } catch {
    throw new Error("Could not create home record");
  }
}

export async function readHomeRecord(keys: HouseholdKeys, key: EntityKey): Promise<HomeRecord> {
  try {
    const row = await arkivPublicClient().getEntity(key, homeSchema);
    if (row.$owner.toLowerCase() !== keys.address.toLowerCase())
      throw new Error("Home record belongs to another household");
    return await openJson<HomeRecord>(keys.sealKey, hexToBytes(row.sealed.value));
  } catch {
    throw new Error("Could not read home record");
  }
}

export async function createVoiceRecord(
  keys: HouseholdKeys,
  language: Language,
  mp3: Uint8Array,
): Promise<EntityKey> {
  // Language is already associated with this entity key in the sealed home record.
  void language;
  try {
    const result = await arkivWalletClient(keys.account).createEntity(
      voiceSchema,
      { sealed: bytes(await sealBytes(keys.sealKey, mp3)) },
      { expiration: ExpirationTime.fromDays(ARKIV_MAX_DAYS) },
    );
    return result.entityKey;
  } catch {
    throw new Error("Could not create voice record");
  }
}

export async function readVoiceRecord(keys: HouseholdKeys, key: EntityKey): Promise<Uint8Array> {
  try {
    const row = await arkivPublicClient().getEntity(key, voiceSchema);
    if (row.$owner.toLowerCase() !== keys.address.toLowerCase()) throw new Error("Wrong owner");
    return await openBytes(keys.sealKey, hexToBytes(row.sealed.value));
  } catch {
    throw new Error("Could not read voice record");
  }
}

/** One batch: the payload (sealed to the session key, expires at grantEnd) + an "issued" history entry. */
export async function createGrantBatch(
  keys: HouseholdKeys,
  sessionSealKey: CryptoKey,
  payload: GrantPayload,
  issued: HistoryEntry,
): Promise<{ payloadKey: EntityKey; historyKey: EntityKey }> {
  void keys;
  void sessionSealKey;
  void payload;
  void issued;
  throw new Error("createGrantBatch: not implemented (P0-10)");
}

/** Courier view. Null when missing, expired or deleted. Also returns the entity's $owner for the check. */
export async function readGrantPayload(
  payloadKey: EntityKey,
  sessionSealKey: CryptoKey,
): Promise<{ payload: GrantPayload; owner: `0x${string}` } | null> {
  void payloadKey;
  void sessionSealKey;
  throw new Error("readGrantPayload: not implemented (P0-11)");
}

export async function deleteGrantPayload(keys: HouseholdKeys, payloadKey: EntityKey): Promise<void> {
  void keys;
  void payloadKey;
  throw new Error("deleteGrantPayload: not implemented (P0-12)");
}

export async function createHistoryEntry(keys: HouseholdKeys, entry: HistoryEntry): Promise<EntityKey> {
  void keys;
  void entry;
  throw new Error("createHistoryEntry: not implemented (P0-12)");
}

/** Live-access list (P1-2): payload keys + expiry from an owner query. Details come from history entries. */
export async function listLiveGrants(keys: HouseholdKeys): Promise<LiveGrant[]> {
  void keys;
  throw new Error("listLiveGrants: not implemented (P1-2)");
}

export async function listHistory(keys: HouseholdKeys): Promise<HistoryEntry[]> {
  void keys;
  throw new Error("listHistory: not implemented (P1-2)");
}

/** Sign-in upkeep (P1-8): extend home, voice and history records with < 90 days left. */
export async function extendExpiringRecords(keys: HouseholdKeys): Promise<number> {
  void keys;
  throw new Error("extendExpiringRecords: not implemented (P1-8)");
}
