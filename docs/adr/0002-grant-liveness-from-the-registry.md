# A grant is live only if the household's grant registry says so

idea.md assumed an expired grant "stops resolving by itself". It doesn't. Once a grant expires, the Universal Resolver falls back to the nearest ancestor's ENSIP-10 resolver, the household's own, which still answers for the grant's name. So the courier view and the live-access list decide liveness from the registry (`getState`, or `UniversalHelper.findExactOwner` on the full name). They treat a missing Arkiv payload as expired too, whichever happens first. Grant names carry no records, so nothing outlives them on the household's resolver.

## Consequences

- Revoke reads the grant's status first, because `unregister` reverts with `LabelExpired` on a grant that has already expired.
- The payload (2-s Arkiv blocks, expiry computed from the device clock) and the ENS grant (12-s Sepolia blocks) won't flip at the same second. The UI shows whichever goes first.
- Source: `docs/research/ens-v2.md` (Gotchas 1 and 4, Contradiction 2).
