// "Approve a grant" (docs/plan.md, P0-10). Owner: blockchain. Frontend calls it from the consent screen.
// 1. newSessionKey → deriveGrantIdentity (label, owner, seal key).
// 2. grantEnd = latest Sepolia block time + durationSeconds + GRANT_LATENCY_MARGIN_SECONDS.
// 3. Arkiv batch: payload (sealed to the session key, atDate(grantEnd)) + "issued" history entry.
// 4. Sepolia: mintGrant(label, owner, grantEnd) in the household's grant registry.
// 5. Courier link from ../link. The session key is then dropped from memory.
import type { GrantRequest } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";

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
  void keys;
  void household;
  void request;
  throw new Error("approveGrant: not implemented (P0-10)");
}
