import { describe, expect, it } from "vitest";
import { dnsEncode, isValidHouseholdLabel, suggestHouseholdLabel } from "./names";

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

  it("suggestHouseholdLabel returns a valid two-word label", () => {
    for (const random of [() => 0, () => 0.5, () => 0.999999]) {
      const label = suggestHouseholdLabel(random);
      expect(label).toMatch(/^[a-z]+-[a-z]+$/);
      expect(isValidHouseholdLabel(label)).toBe(true);
    }
  });
  it("dnsEncode matches the DNS wire format for sana.pata.eth", () => {
    // Length-prefixed ASCII labels and the root terminator, independently written.
    expect(dnsEncode("sana.pata.eth")).toBe("0x0473616e6104706174610365746800");
    expect(dnsEncode("Sana.Pata.eth")).toBe("0x0473616e6104706174610365746800");
  });
});
