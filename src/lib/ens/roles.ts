// ENSv2 role bits (docs/research/ens-v2.md, Values to copy). Admin role = role << 128.
// Owner: blockchain. Add unit tests for the bitmaps below before using them on-chain (P0-3 checks them).

const admin = (role: bigint) => role << 128n;

export const REGISTRY_ROLES = {
  REGISTRAR: 1n << 0n,
  REGISTER_RESERVED: 1n << 4n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
  SET_URI: 1n << 36n,
  UPGRADE: 1n << 124n,
} as const;

export const RESOLVER_ROLES = {
  SET_ADDRESS: 1n << 0n,
  SET_TEXT: 1n << 4n,
  SET_DATA: 1n << 24n,
  LINK: 1n << 28n,
} as const;

const R = REGISTRY_ROLES;

/** EACBaseRolesLib.ALL_ROLES, ens-v2.md Values to copy; household's own resolver only. */
export const RESOLVER_ROOT_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;

/** Roles on a household name in pata.eth's registry: "forever" (ens-v2.md §3). */
export const HOUSEHOLD_NAME_ROLES =
  R.SET_RESOLVER |
  admin(R.SET_RESOLVER) |
  R.SET_SUBREGISTRY |
  admin(R.SET_SUBREGISTRY) |
  R.CAN_TRANSFER_ADMIN;

/** Root roles the household gives itself on its own grant registry (stays un-emancipated, ADR 0003). */
export const GRANT_REGISTRY_ROOT_ROLES =
  R.REGISTRAR | admin(R.REGISTRAR) | R.UNREGISTER | admin(R.UNREGISTER) | R.RENEW | admin(R.RENEW);

/** A grant gets no roles beyond ownership: non-transferable, can't set records or subnames. */
export const GRANT_ROLES = 0n;

/** Root roles for pata.eth's registry operator. Emancipated: none of the dangerous roles (ADR 0003). */
export const PATA_REGISTRY_OPERATOR_ROLES = R.REGISTRAR | admin(R.REGISTRAR) | R.RENEW | admin(R.RENEW);
