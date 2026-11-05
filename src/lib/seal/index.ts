// AES-GCM encrypt and decrypt of every Arkiv value. Owner: blockchain (P0-5). Write seal.test.ts first.
// Wire format of a sealed value: version byte 0x01 || 12-byte random IV || ciphertext+tag.
// Every Arkiv record is one sealed `bytes` column (arkiv.md); nothing readable is ever written.

export async function sealBytes(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  void key;
  void plaintext;
  throw new Error("sealBytes: not implemented (P0-5)");
}

/** Throws if the key is wrong or the bytes were changed. */
export async function openBytes(key: CryptoKey, sealed: Uint8Array): Promise<Uint8Array> {
  void key;
  void sealed;
  throw new Error("openBytes: not implemented (P0-5)");
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Uint8Array> {
  return sealBytes(key, new TextEncoder().encode(JSON.stringify(value)));
}

export async function openJson<T>(key: CryptoKey, sealed: Uint8Array): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await openBytes(key, sealed))) as T;
}
