# Pitch guide: what Pata does, what's built, and where the proof is

For whoever pitches, demos or films Pata. As of 2026-11-07 morning: everything below works on the `p1-access-history-seller` branch, and the P1 screens reach `main` when the owner merges `p1`. Every claim links to the code, plan or ADR behind it. When in doubt, the [README](../../README.md) has the careful wording.

## The one line

**An address becomes a permission you grant, not text you hand out:** to one requester, for a set time, revocable, and checked without us.

"Encrypt and send" undersells it. The three things below are what plain encryption can't do, and each has a moment in the demo.

## Three things to say, and how to show each

### 1. Access ends by itself

- **What it is:** every grant is an ENS subname with an expiry on chain, such as `k3f9x2qa.sana.pata.eth`. The courier's page checks the household's registry, not our server, so when the time is up the link shows only the area, even if the household's phone is off ([ADR 0002](../adr/0002-grant-liveness-from-the-registry.md), [ADR 0004](../adr/0004-grant-identity-from-the-session-key.md)).
- **What the household sees:** **Who can find my door** lists each live link with a countdown and empties by itself. **Stop access now** ends a link early ([P1-2](../plans/P1-2.md), [P0-12](../plans/P0-12.md)). **History** keeps a record of every link and how it ended: "Ended on its own" or "Stopped by you".
- **Demo:** a 20-second grant. The courier page shows the door, then "This link has ended"; at the same moment the household's list empties by itself, and History says "Ended on its own".
- **Be honest:** expiry stops honest apps from showing the door again. It can't make a courier unsee it ([ADR 0005](../adr/0005-expiry-is-a-public-switch-not-encryption.md)).

### 2. We sit in the middle of nothing

- **No middleman for the link:** once a link exists, the courier page reads only ENS and Arkiv, through the Anon-RPC mixnet. Our server can be switched off and the link still opens ([README, CROPS](../../README.md#crops)).
- **The phone's location never leaves it:** a GPS fix places the pin, and the area and PIN code are suggested from a table bundled in the app ([ADR 0011](../adr/0011-setup-takes-a-typed-address-and-the-phone-location.md), [ADR 0012](../adr/0012-locality-suggested-on-the-device.md)).
- **Everything exact is ciphertext:** door, DIGIPIN, room number and directions are encrypted on Arkiv, to the household key or to one grant's session key ([ADR 0008](../adr/0008-grant-entity-has-a-household-index.md)). The room number never leaves the phone unencrypted.
- **No server sees the link's key:** the courier link's key travels after `#`, which browsers never send to a server ([ADR 0006](../adr/0006-courier-link-format.md)). It reaches a shop the same way ([ADR 0013](../adr/0013-requester-hand-off-through-the-fragment.md)).
- **Reads go through a mixnet:** every chain read goes through Nox, so RPC providers don't learn who looks up which home ([README, Anon-RPC coverage](../../README.md#anon-rpc-coverage)).
- **Demo:** turn off Wi-Fi and use mobile data. Open the courier link; mention that the server isn't involved. `/lookup?debug=1` shows the mixnet checks live.

### 3. The name outlives the address, and both sides are named

- **The household's name lasts:** a household owns `name.pata.eth` forever. `pata.eth`'s registry is emancipated and its pointer is locked, so Pata can't take names back ([ADR 0003](../adr/0003-grant-registry-stays-unemancipated.md)). A renter who moves keeps the name; only the pin changes.
- **Strangers see only the area:** they see "Bandra Kurla Complex, 400051" and nothing else (`/lookup`).
- **Requesters are named too ([P1-5](../plans/P1-5.md)):**
  - **The consent screen checks the asker:** a shop has its own name with ENSIP-26 records saying who it is and where links go. The consent screen reads them itself: "✓ Checked on its public name". A name with no records gets "doesn't say who it is".
  - **The link can only go to the name's own page:** a fake request claiming a real shop's name can't redirect the link, because it goes only to the page that name lists.
  - **The shop can prove consent:** it signs a challenge with the grant's key; anyone checks it against ENS ("Proof checked against the public record") without seeing the address. Once the grant ends, the proof fails.
- **Demo:** `/seller` asks → the consent screen shows the verified name → approve → **Send link to …** → the shop proves it holds the grant → the household stops it → the shop's proof now says "This grant has ended".

## A 3-minute demo, in this order

Prepare first: set up the household and the demo seller **on the live site** (`https://pata.pata-ggr.workers.dev`), on mobile data. The seller's link destination is the site it was set up on.

1. **0:00 Problem (20 s):** couriers call to ask the way; an address handed out once is out forever. About 26% of India's cash-on-delivery orders return to origin, and wrong addresses are a primary cause ([idea.md](../../idea.md), citing Amazon Shipping and Shipway FY25).
2. **0:20 The home (30 s):** show the household's home screen and `/lookup` of its name: area only. Mention that setup took a location tap and typed directions, about 70 s, and that the AI never saw the room number.
3. **0:50 A shop asks (40 s):** `/seller` → **Confirm address with Pata** → the consent screen with "✓ Checked on its public name" → choose 20 s → approve → **Send link to …**.
4. **1:30 Proof and courier (40 s):** the shop taps **Prove we hold it** → ✓. Open **what the courier sees** → the door, directions read aloud in Hindi.
5. **2:10 The key dies (30 s):** **Who can find my door** counts down and empties by itself; the courier page flips to "This link has ended"; History says "Ended on its own"; the shop's proof now fails.
6. **2:40 Close (20 s):** "Your door, shared only by consent." Names ENSv2, records Arkiv, reads Anon-RPC.

The older [video brief](video-brief.md) describes spoken setup and voice clips. Setup is now typed plus the phone's location ([ADR 0010](../adr/0010-setup-makes-no-voice-clips.md), [ADR 0011](../adr/0011-setup-takes-a-typed-address-and-the-phone-location.md)), so film from this list.

## What's built, with where it lives

| Area              | What works                                                                                                                                                                                                               | Where                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Setup             | Location button or a typed landmark. Area and PIN suggested on the phone (Mumbai). Typed way to the door; room number sealed. Pin on a map; DIGIPIN; directions in Hindi, Marathi and English, read by the phone's voice | `src/app/setup`, `src/lib/flows/setup-household.ts`, ADRs 0010–0012             |
| Household name    | `<label>.pata.eth`, the household's own resolver (public locality only) and grant registry, gas from our relay                                                                                                           | `src/lib/ens/household.ts`, [P0-8](../plans/P0-8.md)                            |
| Consent           | Consent screen with the requester's verified name, purpose, language and duration; "Anyone with this link can find your door until it ends"; QR, share, hand-off                                                         | `src/app/approve`, `src/lib/flows/approve-grant.ts`, [P0-10](../plans/P0-10.md) |
| Courier view      | Area first, then the door. Checks ENS liveness and the Arkiv owner every few seconds; flips to "ended"                                                                                                                   | `src/app/c`, `src/lib/flows/courier.ts`, [P0-11](../plans/P0-11.md)             |
| Live access, stop | Countdown, "Stop access now", empties by itself, resumes a cut-off stop                                                                                                                                                  | `src/app/access`, `src/lib/flows/access.ts`, [P1-2](../plans/P1-2.md)           |
| History           | One record per grant: still live, ended on its own, stopped by you                                                                                                                                                       | `src/app/history`, `src/lib/flows/history.ts`                                   |
| Demo seller       | Its own ENS name with ENSIP-26 records, an order chat, hand-off inbox, grant proof                                                                                                                                       | `src/app/seller`, `src/lib/flows/seller.ts`, [P1-5](../plans/P1-5.md), ADR 0013 |
| Lookup            | Area only for any household name                                                                                                                                                                                         | `src/app/lookup`, [P0-13](../plans/P0-13.md)                                    |
| Private reads     | One Nox worker for Sepolia and Arkiv, started when a page opens, with read retries                                                                                                                                       | `src/lib/rpc`, [P0-5 follow-up](../plans/P0-5-retry-and-warm-up.md)             |
| Worker            | Signed requests, a daily spend cap, a kill switch, the gas relay, `/register`, Claude calls; no request bodies logged                                                                                                    | `server/src`, [P0-6](../plans/P0-6.md)                                          |

## For each sponsor track

- **ENS, Best Use of ENSv2:**
  - **ENSv2 features used:**
    - Our own `UserRegistry` for `pata.eth`, emancipated with its pointer locked.
    - Per-household Permissioned Resolvers and grant registries from the `VerifiableFactory`.
    - Role bitmaps (Enhanced Access Control).
    - Expiring, revocable subnames as consent.
    - Universal Resolver reads and `findExactOwner` for liveness.
    - **ENSIP-26 requester records**, the track's stated bonus.
  - Everything is created by the app, nothing hard-coded. The README lists the transaction hashes.
- **Ethereum Foundation, Anon-RPC or CROPS:**
  - **Reads:** every read the app makes goes through one Nox worker, on both chains and both phones.
  - **Exceptions, stated openly:** the bootstrap, and writes that still go direct (P1-4 not done).
  - **Privacy is the lead property:** consent that is scoped and expiring. No trackers. Our server can't read an address.
- **Arkiv, build from scratch:**
  - **Entities:** every exact record is a sealed entity owned by the household's key. A grant's payload expires with the grant. History entries are read-only for 182 days.
  - **Queries:** owner-filtered queries build the live-access list and history.
  - **Atomic writes:** one batch creates the payload and its history entry together.
  - **For judges:** the README has a query they can run; [`arkiv/`](../../arkiv/) has the write-ups and friction log.

## Why it matters beyond the demo

- **Consent you can prove:** India's DPDP Act puts the burden of proving consent on the company (s. 6(10)). A Pata grant is a public, timestamped record of consent, and the grant proof lets a shop show it holds consent without showing the address ([idea.md](../../idea.md), "Can it scale?").
- **It fits the government's plan:** DHRUVA plans many Address Information Providers; Pata can be one rather than a rival.
- **Sellers already pay for this step:** they pay about ₹2.49 an order to confirm addresses on WhatsApp (Shiprocket Engage, in idea.md). Grants are per relationship, not per parcel, so a household writes a few transactions a year.

## Numbers you can quote (measured 2026-11-06/07)

- **Setup:** about 70 s from Save to home, with one Arkiv write (no audio).
- **Name check:** 0.75 s with Nox warmed up (25.8 s before).
- **Shop:** the seller's name is ready in 55 s, and the consent screen verifies it in 5 s.
- **Grants:** approval takes about 30 s, stopping access about 40 s, and the grant proof 4 s.
- **Area and PIN suggestion:** the PIN guess was right 86% of the time in a leave-one-out test.
- **Tests:** 595 unit tests, plus real-IndexedDB browser tests and `forge test`.

## What judges will ask, and the honest answer

- **"Can the courier keep the address?"** Yes, if they write it down. Pata stops honest apps from showing it again and records who had it ([ADR 0005](../adr/0005-expiry-is-a-public-switch-not-encryption.md)).
- **"Isn't the link a bearer secret?"** Yes, and the consent screen says so in plain words. Links are short-lived, scoped to one requester and revocable.
- **"Where are the keys?"** In the phone's browser storage, derived from a device root. Passkeys (P1-3) aren't done.
- **"Does every call go through Anon-RPC?"** Every read does. Writes go direct until P1-4; the README lists every exception.
- **"Why not just a database?"** Because then we could read every door and quietly change who has access. Here the household holds the keys, the expiry is public, and the history is read-only.
- **"Does it work outside Mumbai?"** Setup works anywhere in India, because DIGIPIN covers the country. Only the area and PIN suggestion is Mumbai-only, and landmark search works best in Dharavi and BKC.
- **"What's mocked?"** The shop is a labelled mock, but its name, records, grants and proofs are real chain state.

## Not built, so don't claim it

- **Grid names** such as `39j49ll8t4.digipin.eth` (P1-1): the resolver contract is a stub.
- **Passkey keys** (P1-3) and **writes through Nox** (P1-4).
- **Spoken setup:** removed. Setup takes a typed address and the phone's location ([ADR 0011](../adr/0011-setup-takes-a-typed-address-and-the-phone-location.md)).
- **Bundled map tiles:** tiles come from OpenFreeMap, which sees the area viewed.

## Decisions behind it (ADRs)

| ADR                                                                                                              | One line                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [0001](../adr/0001-stable-host-plus-ipfs-pin.md)                                                                 | One stable host, because passkeys bind to a hostname; the same build is pinned on IPFS |
| [0002](../adr/0002-grant-liveness-from-the-registry.md)                                                          | A grant is live only if the registry says so; never infer expiry from a failed lookup  |
| [0003](../adr/0003-grant-registry-stays-unemancipated.md)                                                        | `pata.eth` can't take names back; each household can still revoke its own grants       |
| [0004](../adr/0004-grant-identity-from-the-session-key.md)                                                       | A grant's label and owner come from its one-time session key                           |
| [0005](../adr/0005-expiry-is-a-public-switch-not-encryption.md)                                                  | Expiry is a public switch, not un-seeing                                               |
| [0006](../adr/0006-courier-link-format.md)                                                                       | The courier link carries its keys after `#`                                            |
| [0007](../adr/0007-directions-audio-made-once-at-setup.md), [0009](../adr/0009-grant-audio-is-its-own-entity.md) | Voice clips, now only for older homes                                                  |
| [0008](../adr/0008-grant-entity-has-a-household-index.md)                                                        | Each grant entity has a household-sealed index, which powers the live list             |
| [0010](../adr/0010-setup-makes-no-voice-clips.md)                                                                | Setup makes no clips; the phone reads the directions aloud                             |
| [0011](../adr/0011-setup-takes-a-typed-address-and-the-phone-location.md)                                        | Typed address plus the phone's location replace the recorder                           |
| [0012](../adr/0012-locality-suggested-on-the-device.md)                                                          | Area and PIN suggested on the phone from a bundled table                               |
| [0013](../adr/0013-requester-hand-off-through-the-fragment.md)                                                   | The link reaches a shop through its page's `#`, never in a request body                |

## Before going on stage

- **Phones:** both on mobile data, because some Wi-Fi networks block the mixnet. Run `/lookup?debug=1` on each first.
- **Seller:** set up on the live site the day before, so its link destination is the live site.
- **Fresh state:** clear site data on the household phone if an old setup is half-finished (Chrome → Settings → Site settings → All sites → pata).
- **Pre-made household:** keep one ready in case setup is slow on stage.
