// "Who can find my door": the live-access list (P1-2). Screens call these; plain sentences only.
// The list is an owner query on Arkiv checked against the ENS registry (ADR 0002), so a grant leaves it
// by itself the moment it expires: the page polls, one check at a time.
import type { HistoryEntry, LiveGrant } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";
import { listUnfinishedRevocations } from "../keys/store";
import { listLiveGrants } from "../arkiv";
import { openJson } from "../seal";
import { revokeGrant } from "./revoke";

export async function loadLiveAccess(keys: HouseholdKeys, household: HouseholdState): Promise<LiveGrant[]> {
  try {
    return await listLiveGrants(keys, household.name);
  } catch {
    throw new Error("Couldn't check who can find your door right now.");
  }
}

/** "Stop access". A grant that had already expired needs no transaction and reports "already-ended". */
export async function stopAccess(
  keys: HouseholdKeys,
  household: HouseholdState,
  grant: LiveGrant,
): Promise<"stopped" | "already-ended"> {
  try {
    return (await revokeGrant(keys, household, grant)) === "revoked" ? "stopped" : "already-ended";
  } catch {
    // The revoke checkpoint keeps the intent, so the same tap later resumes rather than restarts.
    throw new Error("Access may not have stopped yet. Tap Stop again to finish.");
  }
}

/**
 * Resumes stops cut off after the ENS name was released: those grants are no longer live, so the list
 * can't show them, but their payload delete or "revoked" history entry may still be missing. Never
 * throws; whatever can't finish now is tried again on the next visit. Returns how many finished.
 */
export async function finishInterruptedStops(
  keys: HouseholdKeys,
  household: HouseholdState,
): Promise<number> {
  let finished = 0;
  try {
    for (const { payloadKey, checkpoint } of await listUnfinishedRevocations(keys.address)) {
      try {
        const entry = await openJson<HistoryEntry>(keys.sealKey, checkpoint.sealedHistory);
        await revokeGrant(keys, household, {
          grantLabel: entry.grantLabel,
          payloadKey,
          requester: entry.requester,
          purpose: entry.purpose,
          grantEnd: entry.grantEnd,
        });
        finished++;
      } catch {
        /* Left for the next visit. */
      }
    }
  } catch {
    /* Device storage unavailable: nothing to resume from. */
  }
  return finished;
}

/** Countdown words for a grant's row. Both times in Unix seconds. */
export function timeLeft(grantEnd: number, nowSeconds: number): string {
  const left = Math.floor(grantEnd - nowSeconds);
  if (left <= 0) return "Ending now";
  if (left < 600) return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  if (left < 3600) return `${Math.floor(left / 60)} min`;
  if (left < 86_400) return `${Math.floor(left / 3600)} h ${Math.floor((left % 3600) / 60)} min`;
  const days = Math.floor(left / 86_400);
  return days === 1 ? "1 day" : `${days} days`;
}
