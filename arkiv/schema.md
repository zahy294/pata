# Arkiv schema

Pata keeps every exact-address record on Arkiv's Rabdi testnet (chain 7794095), owned by the household's key. All application column values are AES-GCM ciphertext; schema tags, owner/creator addresses and creation/expiry metadata remain public. Owner: blockchain; filled in as P0-8 to P0-12 land.

| Schema | Columns | Sealed to | Lifetime | Flags | Read by |
|---|---|---|---|---|---|
| `pata.home.v1` | `sealed` (bytes) | household key | 182 days, extended at sign-in | – | the household |
| `pata.voice.v1` | `sealed` (bytes): one MP3 clip | household key | 182 days | – | the household, at approval |
| `pata.grant.v1` | `payload` (bytes), `index` (bytes) | `payload`: the grant's session key; `index`: household key | `atDate(grantEnd)` | – | the courier view (`payload`); the live-access list (`index`) |
| `pata.history.v1` | `sealed` (bytes) | household key | 182 days | `readonly` | the history screen |

**Fields queried:** `arkiv.schema` and `$owner` only, plus `$key` and `$expiresAt` from the entity. No indexed column of our own: every index would be public plaintext.

Schemas are declared in `src/lib/arkiv/schemas.ts`. Home and voice key-based reads check the SDK's schema tag and `$owner` before opening ciphertext. Voice language is associated with the entity key inside the sealed home record, never a public column. Each sealed value is `0x01 || 12-byte IV || AES-GCM ciphertext+tag`.

The grant's two columns share one 128 KiB budget. Its household-sealed `index` contains `{ grantLabel, requester, purpose, grantEnd }`; an owner-filtered query supplies the payload entity key. See [ADR 0008](../docs/adr/0008-grant-entity-has-a-household-index.md). This ticket declares the grant/history schemas; their operations land with P0-10 to P0-12.

**Writing addresses:** filled in when the demo household exists (README lists them too).

P0-8 live smoke-test writer (2026-11-06, throwaway rather than demo): `0xd9b8a786d6D662b3e0fB3F12D5d0688fE5876175`, verified home and voice round trips. Public entity keys and receipts are in `docs/plans/P0-8-arkiv.md` and `docs/plans/P0-3.md`. The throwaway key was not persisted.

**A query judges can run:** filled in after P0-10.
