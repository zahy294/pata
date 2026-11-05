# Arkiv schema

Pata keeps every exact-address record on Arkiv's Rabdi testnet (chain 7794095), owned by the household's key. Each value is AES-GCM ciphertext; nothing readable is public. Owner: blockchain; filled in as P0-8 to P0-12 land.

| Schema | Columns | Sealed to | Lifetime | Flags | Read by |
|---|---|---|---|---|---|
| `pata.home.v1` | `sealed` (bytes) | household key | 182 days, extended at sign-in | – | the household |
| `pata.voice.v1` | `sealed` (bytes): one MP3 clip | household key | 182 days | – | the household, at approval |
| `pata.grant.v1` | `payload` (bytes), `index` (bytes) | `payload`: the grant's session key; `index`: household key | `atDate(grantEnd)` | – | the courier view (`payload`); the live-access list (`index`) |
| `pata.history.v1` | `sealed` (bytes) | household key | 182 days | `readonly` | the history screen |

**Fields queried:** `arkiv.schema` and `$owner` only, plus `$key` and `$expiresAt` from the entity. No indexed column of our own: every index would be public plaintext.

**Writing addresses:** filled in when the demo household exists (README lists them too).

**A query judges can run:** filled in after P0-10.
