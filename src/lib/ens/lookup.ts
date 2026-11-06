// Public reads anyone can do. Owner: blockchain (P0-13 stranger lookup, P1-1 grid names).
// All reads go through ../rpc (Anon-RPC). viem's getEnsText through the Universal Resolver.
import type { LatLon, Locality } from "../../../shared/domain";
import { ENS } from "../../../shared/constants";
import { sepoliaPublicClient } from "../rpc";
import { universalHelperAbi } from "./abis";
import { dnsEncode } from "./names";
import { zeroAddress } from "viem";

/** What a stranger sees for a household name: the locality, nothing else. Null if the name doesn't exist. */
export async function lookupLocality(householdName: string): Promise<Locality | null> {
  try {
    const client = sepoliaPublicClient();
    const [name, pinCode] = await Promise.all(
      ["location", "eth.pata.pincode"].map((key) =>
        client.getEnsText({ name: householdName, key, universalResolverAddress: ENS.universalResolver }),
      ),
    );
    if (!name || !pinCode) return null;
    // Household setup writes "Dharavi, 400017" (household.ts localityCalls); return the name alone.
    const suffix = `, ${pinCode}`;
    return { name: name.endsWith(suffix) ? name.slice(0, -suffix.length) : name, pinCode };
  } catch {
    throw new Error("Could not read locality");
  }
}

/** Owner address of a household name (the courier view checks the payload's Arkiv $owner against it). */
export async function householdOwner(householdName: string): Promise<`0x${string}` | null> {
  try {
    const owner = await sepoliaPublicClient().readContract({
      address: ENS.universalHelper,
      abi: universalHelperAbi,
      functionName: "findExactOwner",
      args: [dnsEncode(householdName)],
    });
    return owner === zeroAddress ? null : owner;
  } catch {
    throw new Error("Could not read household owner");
  }
}

/** `39j49ll8t4.digipin.eth` → the cell centre, via the DigipinResolver (P1-1). */
export async function resolveGridName(gridName: string): Promise<LatLon | null> {
  void gridName;
  throw new Error("resolveGridName: not implemented (P1-1)");
}
