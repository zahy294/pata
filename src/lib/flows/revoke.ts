// "Revoke" (docs/plan.md, P0-12). Owner: blockchain.
// Read the grant's status; if live, delete the payload on Arkiv and unregister on Sepolia, then write a
// "revoked" history entry. If it already ended, there's nothing to do.
import type { LiveGrant, HistoryEntry } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";
import { loadRevocationCheckpoint, saveRevocationCheckpoint } from "../keys/store";
import { grantStatusByName, unregisterGrant, sepoliaNow } from "../ens/grants";
import { deleteGrantPayload, createHistoryEntry } from "../arkiv";
import { sealJson, openJson } from "../seal";

const inFlight = new Map<string, Promise<"revoked" | "already-ended">>();
export function revokeGrant(
  keys: HouseholdKeys,
  household: HouseholdState,
  grant: LiveGrant,
): Promise<"revoked" | "already-ended"> {
  const id = `${keys.address}:${grant.payloadKey}`.toLowerCase();
  const existing = inFlight.get(id);
  if (existing) return existing;
  const operation = performRevoke(keys, household, grant).finally(() => inFlight.delete(id));
  inFlight.set(id, operation);
  return operation;
}

async function performRevoke(
  keys: HouseholdKeys,
  household: HouseholdState,
  grant: LiveGrant,
): Promise<"revoked" | "already-ended"> {
  try {
    let checkpoint = await loadRevocationCheckpoint(keys.address, grant.payloadKey);
    if (checkpoint?.complete) return "revoked";
    if (!checkpoint) {
      if (!(await grantStatusByName(`${grant.grantLabel}.${household.name}`)).live) return "already-ended";
      const entry: HistoryEntry = { version: 1, kind: "revoked", grantLabel: grant.grantLabel,
        requester: grant.requester, purpose: grant.purpose, grantEnd: grant.grantEnd, at: await sepoliaNow() };
      checkpoint = { sealedHistory: await sealJson(keys.sealKey, entry) };
      await saveRevocationCheckpoint(keys.address, grant.payloadKey, checkpoint);
    }
    const entry = await openJson<HistoryEntry>(keys.sealKey, checkpoint.sealedHistory);
    await unregisterGrant(keys, household, entry.grantLabel);
    await deleteGrantPayload(keys, grant.payloadKey);
    await createHistoryEntry(keys, entry);
    await saveRevocationCheckpoint(keys.address, grant.payloadKey, { ...checkpoint, complete: true });
    return "revoked";
  } catch { throw new Error("Could not revoke grant; retry to finish cleanup"); }
}
