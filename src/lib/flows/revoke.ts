// "Revoke" (docs/plan.md, P0-12). Owner: blockchain.
// Read the grant's status; if live, delete the payload on Arkiv and unregister on Sepolia, then write a
// "revoked" history entry. If it already ended, there's nothing to do.
import type { LiveGrant } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import type { HouseholdState } from "../keys/store";

export async function revokeGrant(
  keys: HouseholdKeys,
  household: HouseholdState,
  grant: LiveGrant,
): Promise<"revoked" | "already-ended"> {
  void keys;
  void household;
  void grant;
  throw new Error("revokeGrant: not implemented (P0-12)");
}
