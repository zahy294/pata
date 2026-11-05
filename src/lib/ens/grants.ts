// Grants as expiring subnames in the household's grant registry. Owner: blockchain (P0-10, P0-12).
// Read docs/research/ens-v2.md §4 and ADRs 0002, 0004.
// - Mint: register(label, grantOwner, 0x0, 0x0, GRANT_ROLES, grantEnd). No resolver, no records.
// - grantEnd comes from ../flows/approve-grant (latest Sepolia block time + duration + margin), never the phone clock alone.
// - Liveness comes ONLY from the registry (ADR 0002): an expired grant still resolves through the household's resolver.
// - Revoke reads the status first: unregister reverts LabelExpired on an expired grant.
import type { HouseholdContracts } from "./household";
import type { HouseholdKeys } from "../keys";

export type GrantStatus = { live: true; owner: `0x${string}`; expiry: number } | { live: false };

export async function mintGrant(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  label: string,
  grantOwner: `0x${string}`,
  grantEnd: number,
): Promise<`0x${string}`> {
  void keys;
  void contracts;
  void label;
  void grantOwner;
  void grantEnd;
  throw new Error("mintGrant: not implemented (P0-10)");
}

/** From the full grant name alone (courier view): UniversalHelper.findExactOwner; zero means not live. */
export async function grantStatusByName(grantName: string): Promise<GrantStatus> {
  void grantName;
  throw new Error("grantStatusByName: not implemented (P0-11)");
}

/** Status read, then unregister if live. Returns "already-ended" without a transaction otherwise. */
export async function unregisterGrant(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  label: string,
): Promise<"revoked" | "already-ended"> {
  void keys;
  void contracts;
  void label;
  throw new Error("unregisterGrant: not implemented (P0-12)");
}

/** Latest Sepolia block timestamp, for computing grantEnd. */
export async function sepoliaNow(): Promise<number> {
  throw new Error("sepoliaNow: not implemented (P0-10)");
}
