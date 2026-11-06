# How Pata uses Arkiv

Draft for P0-14, 2026-11-06. SDK: `@arkiv-network/sdk@1.0.0`; Rabdi, chain 7794095. Client factories already exist in [src/lib/rpc](../src/lib/rpc/index.ts), using `rabdi({ accessKey })` and Nox for reads. Wallet writes default to direct P0 transport.

## Implementation boundary

The checked-out [record module](../src/lib/arkiv/index.ts) and product flows are still stubs. The [blockchain snapshot](https://github.com/zahy294/pata/blob/d242a8a3dbe42ca50f3445aac19c9162d1ce3818/src/lib/arkiv/index.ts) implements home/voice create/read and declares four schemas, with recorded live round-trip evidence on that branch. That code is unmerged here. Grant/history, courier reads, revoke and upkeep remain planned even in that snapshot.

The calls below are the implementation map, not a claim that every row runs in this checkout. `homeSchema`, `voiceSchema`, `grantSchema` and `historySchema` correspond to the tags in [schema.md](schema.md).

| Flow and visible result | SDK 1.0.0 call | State and constraints |
| --- | --- | --- |
| Setup: save the confirmed home | `wallet.createEntity(homeSchema, values, { expiration: ExpirationTime.fromDays(182) })` | Implemented on blockchain branch. `values.sealed` wraps household-sealed JSON with `bytes(...)`; returns the entity key after receipt. |
| Setup: save one voice clip per language | `wallet.createEntity(voiceSchema, values, { expiration: ExpirationTime.fromDays(182) })` | Implemented on blockchain branch. MP3 bytes are sealed to the household; language-to-key association is inside the home record. Audio generation/integration is planned. |
| Sign-in: reopen home/voice records | `publicClient.getEntity(key, homeSchema)` / `getEntity(key, voiceSchema)` | Implemented on blockchain branch. Check schema and `$owner` before opening `hexToBytes(row.sealed.value)`. |
| Setup retry: reuse an existing sealed home/clip | `publicClient.select({ $key: true, $owner: true, sealed: true }).from(schema).ownedBy(household).orderBy(asc("$key")).limit(100).offset(n).fetch()` | Implemented on blockchain branch. Decrypt to compare; failed discovery is not permission to create a duplicate. |
| Approval: create a payload and issued history entry together | `wallet.executeBatch({ creates: [...] })` | Planned. One create uses `grantSchema`, session-sealed `payload`, household-sealed `index`, and `ExpirationTime.atDate(new Date(grantEnd * 1000))`. The other uses `historySchema`, 182 days, `flags: { readonly: true }`. Read entity keys from `createdEntities`. |
| Courier: open one live payload | `publicClient.getEntity(payloadKey, grantSchema)` | Planned. First verify the ENS grant owner/liveness; then compare entity `$owner` with the household's ENS owner and open only `payload.value` with the session key. Missing/expired/deleted means ended. |
| Live-access list: recover grants without retained session keys | `publicClient.select({ $key: true, $expiresAt: true, index: true }).from(grantSchema).ownedBy(household).fetch()` | Planned. Open `index.value` with the household key; cross-check ENS liveness. Poll because Arkiv emits no expiry event. Page beyond 100 rows. |
| History: show issued/revoked entries | `publicClient.select({ $key: true, $createdAt: true, sealed: true }).from(historySchema).ownedBy(household).limit(100).offset(n).fetch()` | Planned. Decrypt and sort locally; no public requester/purpose index. |
| Revoke: remove the live payload and append history | `wallet.deleteEntity({ entityKey: payloadKey })`, then `wallet.createEntity(historySchema, values, { expiration, flags: { readonly: true } })` | Planned, alongside ENS status-check/`unregister`. Do not patch an old history entry. |
| Sign-in upkeep: retain home, voice and history | `wallet.extendEntity({ entityKey, expiration: ExpirationTime.fromDays(182) })` | Planned when fewer than 90 days remain. Extensions count from now, not the old expiry. |
| Household moves: update its home | `wallet.patchEntity(homeSchema, entityKey, { set: values })` | Planned P2, along with resealing only live grants. This is not implemented current-door rotation. |

## Ownership, expiry and metadata

Every collection query must include `.ownedBy(household)`: anyone can write under a schema tag. Key-based reads verify owner explicitly. The [ADR 0008 index](https://github.com/zahy294/pata/blob/d242a8a3dbe42ca50f3445aac19c9162d1ce3818/docs/adr/0008-grant-entity-has-a-household-index.md) contains `{ grantLabel, requester, purpose, grantEnd }`, encrypted to the household; its entity key identifies the session-sealed payload beside it.

Only application contents are confidential. Schema, owners/creators and timing remain public. Grant `payload` and `index` share 128 KiB and expire together; home/voice/history use 182 days, below Rabdi's 182.5-day maximum. `readonly` forbids history attribute edits, but the owner can still extend, transfer or delete it; it is not permanent archival storage.

**Demo writing household address:** TODO after demo household.<br>
**Live entity keys and receipts:** TODO after demo household.<br>
**Judge-runnable `arkiv_query`:** TODO after demo household. It must filter the actual schema tag and verified `$owner` on the public Rabdi RPC and be rerun before submission; no invented address or empty-result placeholder is presented as proof.
