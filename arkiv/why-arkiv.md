# Why Arkiv

Draft for P0-14, 2026-11-06. The product flows below are planned in this checkout; home/voice storage is implemented on the unmerged blockchain branch. See the [implementation snapshot](../docs/plans/P0-14.md).

## What households would lose with a server-owned database

Pata's design gives the household ownership of its encrypted home, voice clips, grant payloads and history. On Arkiv Rabdi, writes are signed by that household account and editing rights and expiry are checked by the network. A courier would read a payload using the public SDK, without asking Pata's server for permission to retrieve the ciphertext.

Postgres could also hold client-encrypted records; encryption is not an Arkiv-only feature. The loss would be the independent ownership and live-data interface: a Pata-operated database would make reads, mutation authorization and expiry visibility depend on our API and its availability. Other applications would need our endpoint or a separate replication arrangement.

The planned user-visible reads are the courier's `getEntity(payloadKey, grantSchema)` and the household's `select(...).from(grantSchema/historySchema).ownedBy(household).fetch()`. These must actually drive the courier, live-access and history screens; merely installing the SDK or writing an unread log does not meet the [track requirements](../docs/research/arkiv.md#track-requirements-build-on-arkiv-from-scratch).

## What stays off Arkiv, and why

- Private keys and grant session keys stay on the device or in the bearer courier fragment, never in an entity.
- Plaintext exact addresses, room numbers, directions, requester and purpose stay inside AES-GCM ciphertext. Arkiv still exposes schema/owner/creator and creation/expiry metadata.
- Household names, grant ownership/liveness and public locality belong to ENSv2. Arkiv cannot replace the ENS grant check.
- Unsealed spoken input and model/speech requests are not records. Map-search caching belongs to Worker KV and contains only public locality/map data.

[ADR 0008 on the blockchain branch](https://github.com/zahy294/pata/blob/d242a8a3dbe42ca50f3445aac19c9162d1ce3818/docs/adr/0008-grant-entity-has-a-household-index.md) specifies two encrypted grant columns: a session-sealed `payload` and household-sealed `index`. The index lets a household reconstruct its grant list after a fresh sign-in without retaining session keys or relying on local grant state. Its operations remain planned.

## Limits we keep visible

Expiry/deletion remove an entity from live queries, not from every observer's memory or transaction history. ENS and Arkiv may expire at different blocks; the planned honest courier stops on either signal. [ADR 0005](../docs/adr/0005-expiry-is-a-public-switch-not-encryption.md) rules out promises that expiry erases a copied address.

Rabdi permits at most 182.5 days of lifetime; the design uses 182 days and planned renewal, not a one-year create. A grant's two byte columns share one 128 KiB budget. Public testnet infrastructure, funding and the stable app host remain dependencies; Arkiv does not make the whole product independent of them.

**Writing household address and working read evidence:** TODO after demo household. No production adoption or completed grant demonstration is claimed.
