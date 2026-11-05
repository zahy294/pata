import { describe, expect, it } from "vitest";
import { isValidHouseholdLabel } from "./names";

describe("household labels (ADR 0006)", () => {
  it.each(["sana", "blue-gate", "a1b", "x".repeat(32)])("accepts %s", (label) => {
    expect(isValidHouseholdLabel(label)).toBe(true);
  });

  it.each(["ab", "x".repeat(33), "-sana", "sana-", "sa--na", "Sana", "sana.eth", "sana~1", ""])(
    "rejects %s",
    (label) => {
      expect(isValidHouseholdLabel(label)).toBe(false);
    },
  );

  it.todo("suggestHouseholdLabel returns a valid two-word label");
  it.todo("dnsEncode matches viem packetToBytes for sana.pata.eth");
});
