// "Approve a grant" (docs/plan.md, P0-10). Owner: blockchain. Frontend calls it from the consent screen.
// 1. newSessionKey → deriveGrantIdentity (label, owner, seal key).
// 2. grantEnd = latest Sepolia block time + durationSeconds + GRANT_LATENCY_MARGIN_SECONDS.
// 3. Arkiv batch: payload (sealed to the session key, atDate(grantEnd)) + "issued" history entry.
// 4. Sepolia: mintGrant(label, owner, grantEnd) in the household's grant registry.
// 5. Courier link from ../link. The session key is then dropped from memory.
import type { GrantRequest } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";
import { deriveGrantIdentity, newSessionKey, type GrantIdentity } from "../keys";
import { readHomeRecord, readVoiceRecord, createGrantBatch } from "../arkiv";
import { mintGrant, sepoliaNow } from "../ens/grants";
import { calculateGrantEnd, buildGrantPayload } from "./grant-data";
import { formatCourierLink } from "../link";
import { toHex } from "viem";

export interface ApprovedGrant {
  courierLink: string;
  grantLabel: string;
  grantEnd: number;
}

export async function approveGrant(
  keys: HouseholdKeys,
  household: HouseholdState,
  request: GrantRequest,
): Promise<ApprovedGrant> {
  let sessionKey: Uint8Array | null = null;
  let identity: GrantIdentity | null = null;
  try {
    calculateGrantEnd(0, request.durationSeconds);
    if (typeof location === "undefined") throw new Error("Approval requires a browser origin");
    sessionKey = newSessionKey();
    identity = await deriveGrantIdentity(sessionKey);
    // A missing/invalid frontend formatter must fail before any paid write.
    formatCourierLink(location.origin, {
      householdName: household.name,
      payloadKey: toHex(new Uint8Array(32)),
      sessionKey,
    });
    const home = await readHomeRecord(keys, household.homeRecordKey);
    const voice = await readVoiceRecord(keys, home.voiceKeys[request.language]);
    const now = await sepoliaNow();
    let grantEnd = calculateGrantEnd(now, request.durationSeconds);
    const payload = buildGrantPayload(home, request, voice, grantEnd);
    const issued = {
      version: 1 as const,
      kind: "issued" as const,
      grantLabel: identity.label,
      requester: { ...request.requester },
      purpose: request.purpose,
      at: now,
      grantEnd,
    };
    let batch = await createGrantBatch(keys, identity.sealKey, payload, issued);
    await mintGrant(keys, household, identity.label, identity.owner.address, grantEnd, {
      refreshGrantEnd: async () => {
        const freshNow = await sepoliaNow();
        const freshEnd = Math.max(grantEnd + 1, calculateGrantEnd(freshNow, request.durationSeconds));
        const freshPayload = buildGrantPayload(home, request, voice, freshEnd);
        const freshIssued = { ...issued, at: freshNow, grantEnd: freshEnd };
        // The old payload expires at its old deadline; replace its unissued history atomically.
        batch = await createGrantBatch(keys, identity!.sealKey, freshPayload, freshIssued, batch.historyKey);
        grantEnd = freshEnd;
        return freshEnd;
      },
    });
    const courierLink = formatCourierLink(location.origin, {
      householdName: household.name,
      payloadKey: batch.payloadKey,
      sessionKey,
    });
    return { courierLink, grantLabel: identity.label, grantEnd };
  } catch {
    throw new Error("Could not approve grant");
  } finally {
    sessionKey?.fill(0);
    sessionKey = null;
    identity = null;
  }
}
