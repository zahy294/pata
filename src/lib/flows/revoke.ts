// "Revoke" (docs/plan.md, P0-12). Owner: blockchain.
// End ENS access first, then reconcile Arkiv deletion and readonly history. Sealed intent survives
// a reload or lost acknowledgement. With no earlier intent, an already-ended grant needs no work.
import type { LiveGrant, HistoryEntry } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";
import { loadRevocationCheckpoint, saveRevocationCheckpoint } from "../keys/store";
import { unregisterGrant, sepoliaNow } from "../ens/grants";
import { deleteGrantPayload, deleteGrantAudio, createHistoryEntry } from "../arkiv";
import { sealJson, openJson } from "../seal";
import { sepoliaPublicClient } from "../rpc";
import { userRegistryAbi } from "../ens/abis";
import { labelhash } from "viem";

const inFlight = new Map<string, Promise<"revoked" | "already-ended">>();
export function revokeGrant(
  keys: HouseholdKeys,
  household: HouseholdState,
  grant: LiveGrant,
): Promise<"revoked" | "already-ended"> {
  const id = `${keys.address}:${grant.payloadKey}`.toLowerCase();
  const existing = inFlight.get(id);
  if (existing) return existing;
  const run = () => performRevoke(keys, household, grant);
  const operation = Promise.resolve().then(async () =>
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(`pata:revoke:${id}`, run)
      : run()
  ).finally(() => inFlight.delete(id));
  inFlight.set(id, operation);
  return operation;
}

async function performRevoke(
  keys: HouseholdKeys,
  household: HouseholdState,
  grant: LiveGrant,
): Promise<"revoked" | "already-ended"> {
  try {
    if (!/^[a-z2-7]{8}$/.test(grant.grantLabel) || !/^0x[\da-fA-F]{64}$/.test(grant.payloadKey))
      throw new Error("Invalid grant");
    let checkpoint = await loadRevocationCheckpoint(keys.address, grant.payloadKey);
    if (checkpoint?.complete) return "revoked";
    if (!checkpoint) {
      const status = await sepoliaPublicClient().readContract({
        address: household.grantRegistry,
        abi: userRegistryAbi,
        functionName: "getStatus",
        args: [BigInt(labelhash(grant.grantLabel))],
      });
      if (status !== 2) return "already-ended";
      const entry: HistoryEntry = {
        version: 1,
        kind: "revoked",
        grantLabel: grant.grantLabel,
        requester: grant.requester,
        purpose: grant.purpose,
        grantEnd: grant.grantEnd,
        at: await sepoliaNow(),
      };
      checkpoint = { sealedHistory: await sealJson(keys.sealKey, entry) };
      await saveRevocationCheckpoint(keys.address, grant.payloadKey, checkpoint);
    }
    const entry = await openJson<HistoryEntry>(keys.sealKey, checkpoint.sealedHistory);
    await unregisterGrant(keys, household, entry.grantLabel);
    await deleteGrantPayload(keys, grant.payloadKey);
    if (grant.audioKey) await deleteGrantAudio(keys, grant.audioKey);
    await createHistoryEntry(keys, entry);
    await saveRevocationCheckpoint(keys.address, grant.payloadKey, { ...checkpoint, complete: true });
    return "revoked";
  } catch {
    throw new Error("Could not revoke grant; retry to finish cleanup");
  }
}
