// "Look up a household" (P0-13). A stranger sees only the public locality, never the door.
// Screens call this instead of ../ens (CLAUDE.md: screens call src/lib/flows/* only).
import type { Locality } from "../../../shared/domain";
import { PROVIDER_NAME } from "../../../shared/constants";
import { lookupLocality } from "../ens/lookup";
import { isValidHouseholdLabel } from "../ens/names";

/** "blue-gate" or "blue-gate.pata.eth" → its locality; null if the name is malformed or unregistered. */
export async function lookupHousehold(input: string): Promise<Locality | null> {
  const suffix = `.${PROVIDER_NAME}`;
  const typed = input.trim().toLowerCase();
  const label = typed.endsWith(suffix) ? typed.slice(0, -suffix.length) : typed;
  if (!isValidHouseholdLabel(label)) return null;
  return lookupLocality(`${label}${suffix}`);
}
