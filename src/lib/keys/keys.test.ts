// P0-5 (blockchain). Fixed roots in, fixed outputs out: these vectors freeze the HKDF info strings.
import { describe, expect, it } from "vitest";
import { deriveGrantIdentity, deriveHouseholdKeys, newRandomRoot, newSessionKey } from "./index";
import { openBytes, sealBytes } from "../seal";

describe("keys", () => {
  it("separates household and grant purposes even with identical input bytes", async () => {
    const root = new Uint8Array(32).fill(7);
    const snapshot = root.slice();
    const household = await deriveHouseholdKeys(root);
    const grant = await deriveGrantIdentity(root);
    expect(household.address).not.toBe(grant.owner.address);
    const sealed = await sealBytes(household.sealKey, new Uint8Array([42]));
    await expect(openBytes(grant.sealKey, sealed)).rejects.toThrow();
    expect(root).toEqual(snapshot);
  });
  it("rejects roots and session keys that are not 32 bytes", async () => {
    for (const length of [0, 31, 33]) {
      await expect(deriveHouseholdKeys(new Uint8Array(length))).rejects.toThrow("32 bytes");
      await expect(deriveGrantIdentity(new Uint8Array(length))).rejects.toThrow("32 bytes");
    }
  });
  it.each([newRandomRoot, newSessionKey])("%s returns fresh 32-byte random values", (generate) => {
    const first = generate();
    const second = generate();
    expect(first).toBeInstanceOf(Uint8Array);
    expect(first.length).toBe(32);
    expect(second.length).toBe(32);
    expect(first).not.toEqual(second);
  });
  it("the same root always gives the same household address", async () => {
    const root = Uint8Array.from({ length: 32 }, (_, i) => i);
    const first = await deriveHouseholdKeys(root);
    const second = await deriveHouseholdKeys(root);
    expect(first.address).toBe(second.address);
    expect(first.account.address).toBe(first.address);
  });
  it("two different roots give different addresses", async () => {
    const first = await deriveHouseholdKeys(new Uint8Array(32));
    const second = await deriveHouseholdKeys(new Uint8Array(32).fill(1));
    expect(first.address).not.toBe(second.address);
  });
  it("the household seal key is non-extractable AES-GCM", async () => {
    const root = new Uint8Array(32);
    const first = await deriveHouseholdKeys(root);
    const second = await deriveHouseholdKeys(root);
    expect(first.sealKey.algorithm).toEqual({ name: "AES-GCM", length: 256 });
    expect(first.sealKey.usages).toEqual(["encrypt", "decrypt"]);
    await expect(crypto.subtle.exportKey("raw", first.sealKey)).rejects.toThrow();
    const bytes = new Uint8Array([42]);
    expect(await openBytes(second.sealKey, await sealBytes(first.sealKey, bytes))).toEqual(bytes);
  });
  it("a session key gives an 8-char a-z2-7 label and an owner address, deterministically", async () => {
    const session = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
    const first = await deriveGrantIdentity(session);
    const second = await deriveGrantIdentity(session);
    expect(first.label).toMatch(/^[a-z2-7]{8}$/);
    expect(second.label).toBe(first.label);
    expect(second.owner.address).toBe(first.owner.address);
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await openBytes(second.sealKey, await sealBytes(first.sealKey, bytes))).toEqual(bytes);
    await expect(crypto.subtle.exportKey("raw", first.sealKey)).rejects.toThrow();
  });
  it("the grant label and grant owner differ between two session keys", async () => {
    const first = await deriveGrantIdentity(new Uint8Array(32));
    const second = await deriveGrantIdentity(new Uint8Array(32).fill(1));
    expect(first.label).not.toBe(second.label);
    expect(first.owner.address).not.toBe(second.owner.address);
    await expect(
      openBytes(second.sealKey, await sealBytes(first.sealKey, new Uint8Array([42]))),
    ).rejects.toThrow();
  });
  it("freezes one known root -> address vector and one session key -> label vector", async () => {
    // Independent Node/OpenSSL hkdfSync + createECDH calculation, not this module.
    const household = await deriveHouseholdKeys(Uint8Array.from({ length: 32 }, (_, i) => i));
    const grant = await deriveGrantIdentity(Uint8Array.from({ length: 32 }, (_, i) => 255 - i));
    expect(household.address).toBe("0x40F858Eb280b77fA59c94D55ff0709424879A8f5");
    expect(grant.label).toBe("cjx4kqrx");
    expect(grant.owner.address).toBe("0xd1052a92D3d7ED17C0e893aC56D9Dfce661687D9");
  });
});
