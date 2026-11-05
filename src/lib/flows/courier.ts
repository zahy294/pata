// "Open a courier link" (docs/plan.md, P0-11). Owner: blockchain builds the checks; frontend builds /c.
// 1. parseCourierFragment(location.hash); keys → sessionStorage; history.replaceState removes the "#".
// 2. Show the locality at once (lookupLocality).
// 3. ENS check: grantStatusByName(<label>.<household>) owner must equal the owner derived from the session key.
// 4. Read the payload; its Arkiv $owner must equal householdOwner(household name). Missing → ended.
// 5. Poll both every few seconds; whichever ends first → "ended", clear sessionStorage.
import type { GrantPayload, Locality } from "../../../shared/domain";

export type CourierView =
  | { state: "checking"; locality: Locality | null }
  | { state: "live"; locality: Locality; payload: GrantPayload }
  | { state: "ended"; locality: Locality | null }
  | { state: "invalid" };

/** One check of both signals. The /c page calls it on load and on a timer. */
export async function checkCourierLink(fragmentOrStored: string): Promise<CourierView> {
  void fragmentOrStored;
  throw new Error("checkCourierLink: not implemented (P0-11)");
}
