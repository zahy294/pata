// P0-5 (blockchain).
import { describe, expect, it } from "vitest";
import { openBytes, openJson, sealBytes, sealJson } from "./index";

const makeKey = () =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

describe("seal", () => {
  it("requires 256-bit AES-GCM keys", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await expect(sealBytes(key, new Uint8Array([42]))).rejects.toThrow("AES-GCM-256");
    const iv = new Uint8Array(12);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array([42])),
    );
    const sealed = new Uint8Array(13 + ciphertext.length);
    sealed[0] = 1;
    sealed.set(iv, 1);
    sealed.set(ciphertext, 13);
    await expect(openBytes(key, sealed)).rejects.toThrow("AES-GCM-256");
  });
  it("rejects unknown versions and truncated envelopes", async () => {
    const key = await makeKey();
    const sealed = await sealBytes(key, new Uint8Array([42]));
    sealed[0] = 2;
    await expect(openBytes(key, sealed)).rejects.toThrow();
    await expect(openBytes(key, sealed.slice(0, 28))).rejects.toThrow();
  });
  it("round-trips bytes and JSON", async () => {
    const key = await makeKey();
    const bytes = new Uint8Array([0, 1, 128, 255]);
    expect(await openBytes(key, await sealBytes(key, bytes))).toEqual(bytes);
    const home = { roomNumber: "14", directions: "नीला दरवाज़ा", pin: { lat: 19.04, lon: 72.85 } };
    expect(await openJson(key, await sealJson(key, home))).toEqual(home);
    expect(await openBytes(key, await sealBytes(key, new Uint8Array()))).toEqual(new Uint8Array());
  });
  it("starts with version byte 0x01 and uses a fresh IV each time", async () => {
    const key = await makeKey();
    const bytes = new Uint8Array([42]);
    const first = await sealBytes(key, bytes);
    const second = await sealBytes(key, bytes);
    expect(first[0]).toBe(1);
    expect(first.length).toBe(1 + 12 + bytes.length + 16);
    expect(first.slice(1, 13)).not.toEqual(second.slice(1, 13));
    // Independently consume the documented wire format using WebCrypto.
    expect(
      new Uint8Array(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: first.slice(1, 13), tagLength: 128 },
          key,
          first.slice(13),
        ),
      ),
    ).toEqual(bytes);
  });
  it("fails to open with a different key", async () => {
    const sealed = await sealBytes(await makeKey(), new Uint8Array([42]));
    await expect(openBytes(await makeKey(), sealed)).rejects.toThrow();
  });
  it("fails to open when one byte of the ciphertext is flipped", async () => {
    const key = await makeKey();
    const sealed = await sealBytes(key, new Uint8Array([42]));
    sealed[13] ^= 1;
    await expect(openBytes(key, sealed)).rejects.toThrow();
  });
});
