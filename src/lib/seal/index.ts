// AES-GCM encrypt and decrypt of every Arkiv value. Owner: blockchain (P0-5). Write seal.test.ts first.
// Wire format of a sealed value: version byte 0x01 || 12-byte random IV || ciphertext+tag.
// Every Arkiv record is one sealed `bytes` column (arkiv.md); nothing readable is ever written.

export async function sealBytes(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(plaintext));
  const sealed = new Uint8Array(13 + ciphertext.byteLength);
  sealed[0] = 1;
  sealed.set(iv, 1);
  sealed.set(new Uint8Array(ciphertext), 13);
  return sealed;
}

/** Throws if the key is wrong or the bytes were changed. */
export async function openBytes(key: CryptoKey, sealed: Uint8Array): Promise<Uint8Array> {
  if (sealed.length < 29 || sealed[0] !== 1) throw new Error("Invalid sealed value");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: sealed.slice(1, 13) },
    key,
    sealed.slice(13),
  );
  return new Uint8Array(plaintext);
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Uint8Array> {
  return sealBytes(key, new TextEncoder().encode(JSON.stringify(value)));
}

export async function openJson<T>(key: CryptoKey, sealed: Uint8Array): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await openBytes(key, sealed))) as T;
}
