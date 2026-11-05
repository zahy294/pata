# A grant's label and owner come from its session key; its payload key travels in the link

Each grant has a fresh 32-byte session key. HKDF derives two things from it: the grant's opaque label (8 lowercase base32 characters) and the grant's one-time owner address. The household mints the grant to that address, so whoever holds the courier link holds the grant's owner key and can prove it by signing. Requesters can supply their own owner address in P2. We considered deriving the payload's Arkiv entity key from the session key too, but Arkiv's docs say a predicted key holds only if nothing else from the same account lands first. So the link carries the payload's entity key, read from the create receipt.

## Consequences

- The courier view checks ENS first: the grant's owner must equal the address derived from the session key. Then it reads the payload, whose Arkiv `$owner` must equal the household name's ENS owner.
- Grants are minted with no roles beyond ownership. A kick-off test checks that a grant's owner can't create subnames or set records.
- Source: `docs/research/ens-v2.md` (flow 4), `docs/research/arkiv.md`.
