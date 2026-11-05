// Public reads anyone can do. Owner: blockchain (P0-13 stranger lookup, P1-1 grid names).
// All reads go through ../rpc (Anon-RPC). viem's getEnsText through the Universal Resolver.
import type { LatLon, Locality } from "../../../shared/domain";

/** What a stranger sees for a household name: the locality, nothing else. Null if the name doesn't exist. */
export async function lookupLocality(householdName: string): Promise<Locality | null> {
  void householdName;
  throw new Error("lookupLocality: not implemented (P0-13)");
}

/** Owner address of a household name (the courier view checks the payload's Arkiv $owner against it). */
export async function householdOwner(householdName: string): Promise<`0x${string}` | null> {
  void householdName;
  throw new Error("householdOwner: not implemented (P0-11)");
}

/** `39j49ll8t4.digipin.eth` → the cell centre, via the DigipinResolver (P1-1). */
export async function resolveGridName(gridName: string): Promise<LatLon | null> {
  void gridName;
  throw new Error("resolveGridName: not implemented (P1-1)");
}
