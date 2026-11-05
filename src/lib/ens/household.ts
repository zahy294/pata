// Household setup on ENSv2. Owner: blockchain (P0-8). Read docs/research/ens-v2.md §3 and §5.
// Order (docs/plan.md, "Set up a household" step 7):
//   1. server /topup (Sepolia)
//   2. deployHouseholdContracts: the household's Permissioned Resolver and its grant registry
//      (VerifiableFactory.deployProxy; resolver initialize may write the locality records in the same tx)
//   3. server /register (the relay registers <label>.pata.eth to the household)
//   4. setLocality, if it wasn't written in step 2
// Never write records to the root name 0x00, and never write records for grant names (ens-v2.md Gotchas 1, 3).
import type { Locality } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";

export interface HouseholdContracts {
  resolver: `0x${string}`;
  grantRegistry: `0x${string}`;
}

/** 0 available, 1 reserved, 2 registered, read from pata.eth's registry. */
export async function householdLabelStatus(label: string): Promise<0 | 1 | 2> {
  void label;
  throw new Error("householdLabelStatus: not implemented (P0-8)");
}

export async function deployHouseholdContracts(
  keys: HouseholdKeys,
  fullName: string,
  locality: Locality,
): Promise<HouseholdContracts> {
  void keys;
  void fullName;
  void locality;
  throw new Error("deployHouseholdContracts: not implemented (P0-8)");
}

/** Writes the public locality records (`location`, `eth.pata.pincode`) on the household's resolver. */
export async function setLocality(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  fullName: string,
  locality: Locality,
): Promise<void> {
  void keys;
  void contracts;
  void fullName;
  void locality;
  throw new Error("setLocality: not implemented (P0-8)");
}
