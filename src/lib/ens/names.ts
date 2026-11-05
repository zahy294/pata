// Name rules and encodings. Plain code; owner: blockchain. Tests in names.test.ts (TDD).
import { HOUSEHOLD_LABEL_PATTERN } from "../../../shared/constants";

/** ADR 0006: 3–32 chars of a-z, 0-9, hyphen; no hyphen at either end; no "--". */
export function isValidHouseholdLabel(label: string): boolean {
  return HOUSEHOLD_LABEL_PATTERN.test(label);
}

/** A two-word suggestion such as "blue-gate" (P0-8). Never derived from the address. */
export function suggestHouseholdLabel(random: () => number = Math.random): string {
  void random;
  throw new Error("suggestHouseholdLabel: not implemented (P0-8)");
}

/** DNS-encode a name for resolver calls: viem's packetToBytes, as hex. */
export function dnsEncode(name: string): `0x${string}` {
  void name;
  throw new Error("dnsEncode: not implemented (P0-8)");
}
