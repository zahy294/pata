// Household and session keys. Owner: blockchain (P0-5; passkey root is P1-3).
// Read docs/research/passkeys.md and docs/research/viem.md. Write keys.test.ts first (TDD).
//
// Household root (32 bytes)
//   P0: random bytes kept in device storage (./store.ts).
//   P1: the passkey's PRF output (rootFromPasskey).
//   HKDF-SHA256(root, salt = "pata", info = HKDF_INFO.householdAccount) -> secp256k1 private key
//       -> one viem LocalAccount, the same address on Sepolia and Arkiv.
//   HKDF-SHA256(root, salt = "pata", info = HKDF_INFO.householdSeal)    -> non-extractable AES-GCM key.
//
// Session key (32 random bytes, one per grant; ADR 0004)
//   HKDF(session, info = HKDF_INFO.grantLabel) -> 8 lowercase base32 chars (a-z2-7): the grant label.
//   HKDF(session, info = HKDF_INFO.grantOwner) -> secp256k1 key: the grant's one-time owner account.
//   HKDF(session, info = HKDF_INFO.grantSeal)  -> AES-GCM key that seals the payload (../seal).
//
// These info strings are part of every courier link ever shared. Never change them; add a v2 instead.
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { toHex } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

export const HKDF_SALT = "pata";
export const HKDF_INFO = {
  householdAccount: "pata/v1/household-account",
  householdSeal: "pata/v1/household-seal",
  grantLabel: "pata/v1/grant-label",
  grantOwner: "pata/v1/grant-owner",
  grantSeal: "pata/v1/grant-seal",
} as const;

function deriveBytes(root: Uint8Array, info: string): Uint8Array<ArrayBuffer> {
  if (root.length !== 32) throw new Error("Key material must be 32 bytes");
  return new Uint8Array(hkdf(sha256, root, HKDF_SALT, info, 32));
}

function deriveAccount(root: Uint8Array, info: string): LocalAccount {
  const bytes = deriveBytes(root, info);
  // This reduction is part of v1's frozen identity format.
  const scalar = (BigInt(toHex(bytes)) % (secp256k1.CURVE.n - 1n)) + 1n;
  bytes.fill(0);
  return privateKeyToAccount(toHex(scalar, { size: 32 }));
}

async function deriveSealKey(root: Uint8Array, info: string): Promise<CryptoKey> {
  const bytes = deriveBytes(root, info);
  try {
    return await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } finally {
    bytes.fill(0);
  }
}

export interface HouseholdKeys {
  account: LocalAccount;
  address: `0x${string}`;
  /** AES-GCM, non-extractable. Seals home, voice and history records. */
  sealKey: CryptoKey;
}

export interface GrantIdentity {
  /** 8 chars of a-z2-7, e.g. "k3f9x2qa". */
  label: string;
  /** The grant's one-time owner. Whoever holds the courier link holds this key. */
  owner: LocalAccount;
  sealKey: CryptoKey;
}

/** 32 random bytes from crypto.getRandomValues. */
export function newRandomRoot(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function deriveHouseholdKeys(root: Uint8Array): Promise<HouseholdKeys> {
  const account = deriveAccount(root, HKDF_INFO.householdAccount);
  return { account, address: account.address, sealKey: await deriveSealKey(root, HKDF_INFO.householdSeal) };
}

/** 32 random bytes for one grant. */
export function newSessionKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function deriveGrantIdentity(sessionKey: Uint8Array): Promise<GrantIdentity> {
  const bytes = deriveBytes(sessionKey, HKDF_INFO.grantLabel);
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  // First 40 bits, most-significant bit first: eight RFC 4648 base32 characters.
  let bits = 0;
  let value = 0;
  let label = "";
  for (const byte of bytes.subarray(0, 5)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      label += alphabet[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  bytes.fill(0);
  return {
    label,
    owner: deriveAccount(sessionKey, HKDF_INFO.grantOwner),
    sealKey: await deriveSealKey(sessionKey, HKDF_INFO.grantSeal),
  };
}

/** P1-3: WebAuthn PRF output as the root; two-prompt sign-up fallback when create() returns no PRF result. */
export async function rootFromPasskey(mode: "create" | "get", userName: string): Promise<Uint8Array> {
  void mode;
  void userName;
  throw new Error("rootFromPasskey: not implemented (P1-3)");
}
