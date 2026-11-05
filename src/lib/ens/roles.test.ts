import { describe, expect, it } from "vitest";
import {
  GRANT_REGISTRY_ROOT_ROLES,
  GRANT_ROLES,
  HOUSEHOLD_NAME_ROLES,
  PATA_REGISTRY_OPERATOR_ROLES,
  REGISTRY_ROLES,
  RESOLVER_ROLES,
  RESOLVER_ROOT_ROLES,
} from "./roles";

describe("ENSv2 documented role bitmaps", () => {
  it("grants the household the documented full resolver root mask", () => {
    expect(RESOLVER_ROOT_ROLES).toBe(0x1111111111111111111111111111111111111111111111111111111111111111n);
  });
  it("matches the deployed registry and resolver role positions", () => {
    expect(REGISTRY_ROLES).toEqual({
      REGISTRAR: 0x1n,
      REGISTER_RESERVED: 0x10n,
      SET_PARENT: 0x100n,
      UNREGISTER: 0x1000n,
      RENEW: 0x10000n,
      SET_SUBREGISTRY: 0x100000n,
      SET_RESOLVER: 0x1000000n,
      CAN_TRANSFER_ADMIN: 0x1000000000000000000000000000000000000000n,
      SET_URI: 0x1000000000n,
      UPGRADE: 0x10000000000000000000000000000000n,
    });
    expect(RESOLVER_ROLES).toEqual({
      SET_ADDRESS: 0x1n,
      SET_TEXT: 0x10n,
      SET_DATA: 0x1000000n,
      LINK: 0x10000000n,
    });
  });

  it("keeps household ownership permanent and grants revocable only by the household", () => {
    // Literal masks transcribed from the role assignments in ens-v2.md and ADR 0003.
    expect(HOUSEHOLD_NAME_ROLES).toBe(0x1110000000000000000000000000000001100000n);
    expect(GRANT_REGISTRY_ROOT_ROLES).toBe(0x1100100000000000000000000000000011001n);
    expect(PATA_REGISTRY_OPERATOR_ROLES).toBe(0x1000100000000000000000000000000010001n);
    expect(GRANT_ROLES).toBe(0n);
  });
});
