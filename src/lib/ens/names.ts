// Name rules and encodings. Plain code; owner: blockchain. Tests in names.test.ts (TDD).
import { HOUSEHOLD_LABEL_PATTERN } from "../../../shared/constants";
import { toHex } from "viem";
import { normalize, packetToBytes } from "viem/ens";

const FIRST_WORDS = [
  "blue",
  "calm",
  "clear",
  "cool",
  "green",
  "kind",
  "little",
  "quiet",
  "soft",
  "sunny",
  "warm",
  "white",
];
const SECOND_WORDS = [
  "bird",
  "brook",
  "cloud",
  "fern",
  "field",
  "gate",
  "hill",
  "leaf",
  "moon",
  "pine",
  "star",
  "tree",
];

/** ADR 0006: 3–32 chars of a-z, 0-9, hyphen; no hyphen at either end; no "--". */
export function isValidHouseholdLabel(label: string): boolean {
  return HOUSEHOLD_LABEL_PATTERN.test(label);
}

/** A two-word suggestion such as "blue-gate" (P0-8). Never derived from the address. */
export function suggestHouseholdLabel(random: () => number = Math.random): string {
  return `${FIRST_WORDS[Math.floor(random() * FIRST_WORDS.length)]}-${SECOND_WORDS[Math.floor(random() * SECOND_WORDS.length)]}`;
}

/** DNS-encode a name for resolver calls: viem's packetToBytes, as hex. */
export function dnsEncode(name: string): `0x${string}` {
  return toHex(packetToBytes(normalize(name)));
}
