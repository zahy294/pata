# Grant entities carry a household index beside the payload

## Context
The courier payload is sealed to a grant's session key, which the household does not retain.
The live-access list and revocation need the grant label and payload entity key after a fresh sign-in.
A batch's created entity keys are unavailable when its history entry is encrypted.

## Decision
`pata.grant.v1` has two unindexed `bytes` columns: `payload` and `index`.
Seal `payload` to the session key and `index` to the household key, containing `{ grantLabel, requester, purpose, grantEnd }`.

## Consequences
An owner-filtered query supplies each entity key and its decryptable index without local grant state.
Both ciphertext columns share one 128 KiB budget and expire together at `grantEnd`.
Only schema/ownership/timing metadata is public; source: `docs/research/arkiv.md` and `arkiv/schema.md`.
