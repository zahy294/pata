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
import type { LocalAccount } from "viem/accounts";

export const HKDF_SALT = "pata";
export const HKDF_INFO = {
  householdAccount: "pata/v1/household-account",
  householdSeal: "pata/v1/household-seal",
  grantLabel: "pata/v1/grant-label",
  grantOwner: "pata/v1/grant-owner",
  grantSeal: "pata/v1/grant-seal",
} as const;

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
  throw new Error("newRandomRoot: not implemented (P0-5)");
}

export async function deriveHouseholdKeys(root: Uint8Array): Promise<HouseholdKeys> {
  void root;
  throw new Error("deriveHouseholdKeys: not implemented (P0-5)");
}

/** 32 random bytes for one grant. */
export function newSessionKey(): Uint8Array {
  throw new Error("newSessionKey: not implemented (P0-5)");
}

export async function deriveGrantIdentity(sessionKey: Uint8Array): Promise<GrantIdentity> {
  void sessionKey;
  throw new Error("deriveGrantIdentity: not implemented (P0-5)");
}

/** P1-3: WebAuthn PRF output as the root; two-prompt sign-up fallback when create() returns no PRF result. */
export async function rootFromPasskey(mode: "create" | "get", userName: string): Promise<Uint8Array> {
  void mode;
  void userName;
  throw new Error("rootFromPasskey: not implemented (P1-3)");
}
