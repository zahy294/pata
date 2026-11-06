// Arkiv records: five types, sealed bytes columns only. Owner: blockchain.
// Read docs/research/arkiv.md first. SDK 1.0.0 only: older examples (and AI-written code) use the
// pre-1.0 payload API. Log every surprise in arkiv/friction.md, one line each.
//
// pata.home.v1     household-sealed HomeRecord, 182 days, patchable          (P0-8)
// pata.voice.v1    household-sealed AAC clip, one per language, 182 days     (P0-9, ADR 0007)
// pata.grant.v1    session-sealed GrantPayload, expires atDate(grantEnd)     (P0-10)
// pata.history.v1  household-sealed HistoryEntry, readonly, 182 days         (P0-10, P0-12)
// pata.grant-audio.v1  session-sealed AAC clip for one grant, its own create (P0-10)
//
// Every query filters ownedBy(household): anyone can write under our schema tags (arkiv.md Gotcha 2).
//
// ADR 0008: a pata.grant.v1 entity has TWO sealed bytes
// columns (one shared 128 KiB budget): `payload`, sealed to the session key (what the courier opens),
// and `index`, sealed to the household key ({ grantLabel, requester, purpose, grantEnd }). The payload
// key isn't known until the batch lands, so the history entry can't carry it; the index lets the
// household's own owner query build the live-access list and revoke (label + payload key) with no
// local state. Nothing readable is public either way.
//
// A ~20 s clip fills a whole 128 KiB entity, so it can't share the payload's budget: approval creates the
// grant's audio entity first, and the payload and index carry its key. Revoke deletes both.
import type { GrantPayload, HistoryEntry, HomeRecord, Language, LiveGrant } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import { ExpirationTime, NoEntityFoundError } from "@arkiv-network/sdk";
import { bytes } from "@arkiv-network/sdk/schema";
import { hexToBytes } from "viem";
import { ARKIV_MAX_DAYS, ARKIV_MAX_BYTES, MAX_VOICE_CLIP_BYTES } from "../../../shared/constants";
import { arkivPublicClient, arkivWalletClient } from "../rpc";
import { openJson, sealJson, openBytes, sealBytes } from "../seal";
import { homeSchema, voiceSchema, grantSchema, historySchema, grantAudioSchema } from "./schemas";
import { canonicalJson, findSealedRecord } from "./reuse";
import { asc } from "@arkiv-network/sdk/query";
import { loadHouseholdState } from "../keys/store";
import { grantStatusByName } from "../ens/grants";

export type EntityKey = `0x${string}`;

export async function createHomeRecord(keys: HouseholdKeys, home: HomeRecord): Promise<EntityKey> {
  try {
    const existing = await findSealedRecord(
      keys,
      homeSchema,
      async (sealed) => canonicalJson(await openJson(keys.sealKey, sealed)) === canonicalJson(home),
    );
    if (existing) return existing;
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
  clip: Uint8Array,
): Promise<EntityKey> {
  // Language is already associated with this entity key in the sealed home record.
  void language;
  try {
    const existing = await findSealedRecord(keys, voiceSchema, async (sealed) => {
      const opened = await openBytes(keys.sealKey, sealed);
      return opened.length === clip.length && opened.every((value, index) => value === clip[index]);
    });
    if (existing) return existing;
    const result = await arkivWalletClient(keys.account).createEntity(
      voiceSchema,
      { sealed: bytes(await sealBytes(keys.sealKey, clip)) },
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

/** One grant's AAC clip, sealed to its session key; expires at `expiresAt` (Unix seconds). */
export async function createGrantAudio(
  keys: HouseholdKeys,
  sessionSealKey: CryptoKey,
  clip: Uint8Array,
  expiresAt: number,
): Promise<EntityKey> {
  try {
    if (clip.length === 0 || clip.length > MAX_VOICE_CLIP_BYTES || !Number.isSafeInteger(expiresAt))
      throw new Error("Invalid grant audio");
    const result = await arkivWalletClient(keys.account).createEntity(
      grantAudioSchema,
      { sealed: bytes(await sealBytes(sessionSealKey, clip)) },
      { expiration: ExpirationTime.atDate(new Date(expiresAt * 1000)) },
    );
    return result.entityKey;
  } catch {
    throw new Error("Could not create grant audio");
  }
}

/** Courier view. Null when missing, expired, deleted or owned by someone other than the household. */
export async function readGrantAudio(
  audioKey: EntityKey,
  sessionSealKey: CryptoKey,
  expectedOwner: `0x${string}`,
): Promise<Uint8Array | null> {
  try {
    const row = await arkivPublicClient().getEntity(audioKey, grantAudioSchema);
    if (row.$owner.toLowerCase() !== expectedOwner.toLowerCase()) return null;
    return await openBytes(sessionSealKey, hexToBytes(row.sealed.value));
  } catch (error) {
    if (error instanceof NoEntityFoundError) return null;
    throw new Error("Could not read grant audio");
  }
}

export async function deleteGrantAudio(keys: HouseholdKeys, audioKey: EntityKey): Promise<void> {
  try {
    const row = await arkivPublicClient().getEntity(audioKey, grantAudioSchema);
    if (row.$owner.toLowerCase() !== keys.address.toLowerCase()) throw new Error("Wrong owner");
    await arkivWalletClient(keys.account).deleteEntity({ entityKey: audioKey });
  } catch (error) {
    if (error instanceof NoEntityFoundError) return;
    throw new Error("Could not delete grant audio");
  }
}

/** One batch: the payload (sealed to the session key, expires at grantEnd) + an "issued" history entry. */
export async function createGrantBatch(
  keys: HouseholdKeys,
  sessionSealKey: CryptoKey,
  payload: GrantPayload,
  issued: HistoryEntry,
  supersededHistoryKey?: EntityKey,
): Promise<{ payloadKey: EntityKey; historyKey: EntityKey }> {
  try {
    if (
      issued.kind !== "issued" ||
      issued.grantEnd !== payload.grantEnd ||
      issued.purpose !== payload.purpose ||
      canonicalJson(issued.requester) !== canonicalJson(payload.requester) ||
      !/^[a-z2-7]{8}$/.test(issued.grantLabel) ||
      !Number.isSafeInteger(payload.grantEnd) ||
      payload.grantEnd <= issued.at ||
      (payload.audioKey !== undefined && !/^0x[\da-fA-F]{64}$/.test(payload.audioKey))
    )
      throw new Error("Invalid grant batch");
    const index = {
      grantLabel: issued.grantLabel,
      requester: issued.requester,
      purpose: issued.purpose,
      grantEnd: issued.grantEnd,
      ...(payload.audioKey ? { audioKey: payload.audioKey } : {}),
    };
    const [sealedPayload, sealedIndex, sealedHistory] = await Promise.all([
      sealJson(sessionSealKey, payload),
      sealJson(keys.sealKey, index),
      sealJson(keys.sealKey, issued),
    ]);
    if (sealedPayload.length + sealedIndex.length > ARKIV_MAX_BYTES || sealedHistory.length > ARKIV_MAX_BYTES)
      throw new Error("Grant batch exceeds bytes budget");
    const result = await arkivWalletClient(keys.account).executeBatch({
      creates: [
        {
          schema: grantSchema,
          values: { payload: bytes(sealedPayload), index: bytes(sealedIndex) },
          expiration: ExpirationTime.atDate(new Date(payload.grantEnd * 1000)),
        },
        {
          schema: historySchema,
          values: { sealed: bytes(sealedHistory) },
          expiration: ExpirationTime.fromDays(ARKIV_MAX_DAYS),
          flags: { readonly: true },
        },
      ],
      ...(supersededHistoryKey ? { deletes: [{ entityKey: supersededHistoryKey }] } : {}),
    });
    const [payloadKey, historyKey] = result.createdEntities;
    if (
      result.createdEntities.length !== 2 ||
      !/^0x[\da-fA-F]{64}$/.test(payloadKey) ||
      !/^0x[\da-fA-F]{64}$/.test(historyKey) ||
      payloadKey === historyKey
    )
      throw new Error("Incomplete grant batch receipt");
    return { payloadKey, historyKey };
  } catch {
    throw new Error("Could not create grant batch");
  }
}

/** Courier view. Null when missing, expired or deleted. Also returns the entity's $owner for the check. */
export async function readGrantPayload(
  payloadKey: EntityKey,
  sessionSealKey: CryptoKey,
  expectedOwner: `0x${string}`,
): Promise<{ payload: GrantPayload; owner: `0x${string}` } | null> {
  try {
    const row = await arkivPublicClient().getEntity(payloadKey, grantSchema);
    if (row.$owner.toLowerCase() !== expectedOwner.toLowerCase()) return null;
    return {
      payload: await openJson<GrantPayload>(sessionSealKey, hexToBytes(row.payload.value)),
      owner: row.$owner,
    };
  } catch (error) {
    if (error instanceof NoEntityFoundError) return null;
    throw new Error("Could not read grant payload");
  }
}

export async function deleteGrantPayload(keys: HouseholdKeys, payloadKey: EntityKey): Promise<void> {
  try {
    const row = await arkivPublicClient().getEntity(payloadKey, grantSchema);
    if (row.$owner.toLowerCase() !== keys.address.toLowerCase()) throw new Error("Wrong owner");
    await arkivWalletClient(keys.account).deleteEntity({ entityKey: payloadKey });
  } catch (error) {
    if (error instanceof NoEntityFoundError) return;
    throw new Error("Could not delete grant payload");
  }
}

export async function createHistoryEntry(keys: HouseholdKeys, entry: HistoryEntry): Promise<EntityKey> {
  try {
    const existing = await findSealedRecord(
      keys,
      historySchema,
      async (sealed) => canonicalJson(await openJson(keys.sealKey, sealed)) === canonicalJson(entry),
    );
    if (existing) return existing;
    const sealed = await sealJson(keys.sealKey, entry);
    if (sealed.length > ARKIV_MAX_BYTES) throw new Error("History too large");
    return (
      await arkivWalletClient(keys.account).createEntity(
        historySchema,
        { sealed: bytes(sealed) },
        {
          expiration: ExpirationTime.fromDays(ARKIV_MAX_DAYS),
          flags: { readonly: true },
        },
      )
    ).entityKey;
  } catch {
    throw new Error("Could not create history entry");
  }
}

/** Live-access list (P1-2): payload keys + expiry from an owner query. Details come from history entries. */
export async function listLiveGrants(keys: HouseholdKeys, householdName?: string): Promise<LiveGrant[]> {
  try {
    const name = householdName ?? (await loadHouseholdState())?.name;
    if (!name) throw new Error("Household name required");
    // A refreshed deadline (approve-grant.ts) leaves the first payload under the same label until it
    // expires: show each label once, with its later deadline, and read its ENS status once.
    const byLabel = new Map<string, LiveGrant>();
    for (let offset = 0; ; offset += 100) {
      const page = await arkivPublicClient()
        .select({ $key: true, $owner: true, index: true })
        .from(grantSchema)
        .ownedBy(keys.address)
        .orderBy(asc("$key"))
        .limit(100)
        .offset(offset)
        .fetch();
      for (const row of page.entities) {
        if (row.$owner.toLowerCase() !== keys.address.toLowerCase()) continue;
        let index: Omit<LiveGrant, "payloadKey">;
        try {
          index = await openJson(keys.sealKey, hexToBytes(row.index.value));
          if (
            !/^[a-z2-7]{8}$/.test(index.grantLabel) ||
            !Number.isSafeInteger(index.grantEnd) ||
            typeof index.purpose !== "string" ||
            typeof index.requester?.displayName !== "string" ||
            (index.audioKey !== undefined && !/^0x[\da-fA-F]{64}$/.test(index.audioKey))
          )
            continue;
        } catch {
          continue;
        }
        const seen = byLabel.get(index.grantLabel);
        if (!seen || index.grantEnd > seen.grantEnd) byLabel.set(index.grantLabel, { ...index, payloadKey: row.$key });
      }
      if (page.entities.length + page.skipped < 100) break;
    }
    const grants: LiveGrant[] = [];
    for (const grant of byLabel.values())
      if ((await grantStatusByName(`${grant.grantLabel}.${name}`)).live) grants.push(grant);
    return grants.sort((a, b) => a.grantEnd - b.grantEnd);
  } catch {
    throw new Error("Could not list live grants");
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  const entry = value as HistoryEntry | null;
  return (
    !!entry &&
    entry.version === 1 &&
    (entry.kind === "issued" || entry.kind === "revoked") &&
    typeof entry.grantLabel === "string" &&
    /^[a-z2-7]{8}$/.test(entry.grantLabel) &&
    typeof entry.requester?.displayName === "string" &&
    (entry.requester.ensName === undefined || typeof entry.requester.ensName === "string") &&
    typeof entry.purpose === "string" &&
    Number.isSafeInteger(entry.at) &&
    Number.isSafeInteger(entry.grantEnd)
  );
}

/** The household's history entries (P1-2), in query order. Only its own rows that open with its key. */
export async function listHistory(keys: HouseholdKeys): Promise<HistoryEntry[]> {
  try {
    const entries: HistoryEntry[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await arkivPublicClient()
        .select({ $key: true, $owner: true, sealed: true })
        .from(historySchema)
        .ownedBy(keys.address)
        .orderBy(asc("$key"))
        .limit(100)
        .offset(offset)
        .fetch();
      for (const row of page.entities) {
        if (row.$owner.toLowerCase() !== keys.address.toLowerCase()) continue;
        try {
          const entry = await openJson<unknown>(keys.sealKey, hexToBytes(row.sealed.value));
          if (isHistoryEntry(entry)) entries.push(entry);
        } catch {
          /* Anyone can write under our schema tag; a row that won't open isn't ours. */
        }
      }
      if (page.entities.length + page.skipped < 100) break;
    }
    return entries;
  } catch {
    // Never an empty list on failure: "no history" and "couldn't read it" must look different.
    throw new Error("Could not read history");
  }
}

/** Sign-in upkeep (P1-8): extend home, voice and history records with < 90 days left. */
export async function extendExpiringRecords(keys: HouseholdKeys): Promise<number> {
  void keys;
  throw new Error("extendExpiringRecords: not implemented (P1-8)");
}
