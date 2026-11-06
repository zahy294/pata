# Reach

P0-14 draft, 2026-11-06. This is a proposed path to use, not measured adoption or an existing partner commitment. No completed household/courier demo, user count or delivery improvement is claimed.

## Who would use it

| Audience | What they would see | Arkiv interaction |
| --- | --- | --- |
| Households with difficult last-mile directions | Confirmed home pin, reusable directions and a list of current grants | Planned home/voice `createEntity` and `getEntity`; owner-filtered `select(...).from(grantSchema).ownedBy(household).fetch()` for live access. Home/voice code exists on the unmerged blockchain branch. |
| Couriers, delivery apps and emergency services | One consented exact door and directions, with the honest-client expiry boundary | Planned `getEntity(payloadKey, grantSchema)` after ENS verification. The service can integrate the public read path rather than require Pata's API. |
| Other address providers and app developers | A provider-owned ENS registry and a reusable encrypted record format | Planned interoperable owner/schema-filtered reads on Rabdi, with household-signed writes; no official DHRUVA API or second live provider claimed. |

The [product plan](../idea.md#the-six-jury-questions) proposes grants per relationship, not per parcel. A seller relationship could reuse consent for its duration while the household retains revocation control. This would create meaningful reads of household-owned data, rather than an unread transaction log; it is not a forecast of transaction volume.

## Proposed route to validation

1. Create the demo household through the app after setup is integrated. Record public writing address, entity keys and receipts: **TODO after demo household**.
2. Show one approved grant read by a separate courier session, then expiry and revocation, using real ENS and Arkiv rather than hard-coded payloads. Courier, grant and revoke flows remain planned in this checkout.
3. Demonstrate the live-access/history owner queries and repeat the courier read with the Pata API off. Both the screens and this proof remain planned.
4. Run the consented 20-address study, or clearly label the mapped-public-place fallback as a proxy. Accuracy, correction rate, failed reads and latency results are planned; no household addresses or personal details belong in this repository.
5. Share the integration guide and a verified public `arkiv_query` with judges/developers. **Judge-runnable query: TODO after demo household.**

Possible later users include logistics teams and address providers; no outreach, partnership, household count or willingness-to-pay result is asserted. Name continuity and updating only live grants after a move are planned extensions, not demonstrated retention or recovery guarantees.

## Evidence still needed

- A visible feature that actually reads Arkiv, with its SDK call and matching live owner/entity evidence.
- The verified writing household addresses and a judge-runnable query in the [README](../README.md#deployed-addresses-and-receipts).
- Phone playback/read timings, consented user feedback and a measured before/after result.
- A human-narrated demo and server-off proof; no AI voiceover or staged claim of erased copies.

See [how Pata uses Arkiv](how-you-use-arkiv.md), [why Arkiv](why-arkiv.md), [schema](schema.md) and [friction](friction.md). The current implementation boundary and pinned branch evidence are in [P0-14](../docs/plans/P0-14.md).
