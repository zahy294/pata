## P0: must ship (done by hour 20)

| Id | Ticket | Done when | Needs |
|---|---|---|---|
| P0-1 | Repo and gate | Next.js 16 static export, `npm run check` (typecheck, unit tests, `forge test`) passes, first commit | – |
| P0-2 | Parent names | `pata.eth` and `digipin.eth` registered on Sepolia; `pata.eth`'s registry emancipated, subregistry pointer locked (ADR 0003) | – |
| P0-3 | Hour-0 tests | Every row of idea.md's hour-0 table has a result written in `docs/plans/P0-3.md` | P0-1 |
| P0-4 | `digipin` | Encode and decode with Dak Bhawan `39J49LL8T4`, our own vectors, round-trip and edge tests | P0-1 |
| P0-5 | `keys`, `seal`, `rpc` | Device root → account and household key; session key → label and owner; AES-GCM round-trip; Nox clients for Sepolia and Rabdi with reads through the worker | P0-1, P0-3 |
| P0-6 | Server base | Worker deployed with limits, signatures, the KV spending cap, the kill switch, `/topup`, `/register` | P0-2, P0-3 |
| P0-7 | Address AI | Typed or spoken description → 3 candidate pins with landmark, relation and confidence → confirm or drag → DIGIPIN. Model picks only from fetched OSM ids | P0-4, P0-6 |
| P0-8 | Household name | Name rule and availability check; factory deploys; `/register`; locality record; home and voice records on Arkiv. **First household by hour 10** | P0-5, P0-6, P0-7 |
| P0-9 | Directions and audio | Directions in Hindi, Marathi and English from the confirmed pin; one clip each under 128 KiB sealed | P0-7, P0-8 |
| P0-10 | Consent and grant | Consent screen; payload and history batch; grant minted to the derived owner; courier link, share sheet and QR | P0-8, P0-9 |
| P0-11 | Courier view | `/c` parses the link, sessionStorage, ENS check first, payload owner check, map and clip, flips on expiry. **Demo household by hour 12** | P0-10 |
| P0-12 | Revoke | Status read, payload delete, `unregister`, history entry; `LabelExpired` handled | P0-10 |
| P0-13 | Stranger lookup | A household name shows only its locality | P0-8 |
| P0-14 | README base | CROPS section, `/arkiv/` files started, AI use, honest-enforcement wording (ADR 0005) | P0-11 |

## P1: should ship (hours 20–28, in this order)

| Id | Ticket | Done when | Needs |
|---|---|---|---|
| P1-1 | Grid names | `DigipinResolver` deployed, wildcard set on `digipin.eth`, `39j49ll8t4.digipin.eth` resolves in our app | P0 |
| P1-2 | Live-access and history screens | Owner queries, unsealed and sorted; history shows issued and revoked | P0 |
| P1-3 | Passkey keys | PRF root with the two-prompt sign-up fallback; demo household re-made on the OnePlus 11 | P0 |
| P1-4 | Writes through Nox | Every household write through the worker; stall retry; the stage grant's direct-write switch | P0 |
| P1-5 | Requester names and seller proof | ENSIP-26 `agent-context` and `agent-endpoint[web]` on the mock seller; link posted to the endpoint; seller signs as the grant owner | P0 |
| P1-6 | "We're not sure" | The 50 m and duplicate-name triggers, with the hand-drop path | P0 |
| P1-7 | Spoken Marathi | Marathi input through `saaras:v4`, if the hour-0 test passed | P0 |
| P1-8 | Record upkeep | Sign-in extends home, voice and history records under 90 days | P0 |
| P1-9 | Accuracy test | 20 addresses (or the fallback set): how many within 25 m before correction | P0-7 |

## P2: stretch (only after every P1 ticket)

| Id | Ticket | Done when |
|---|---|---|
| P2-1 | Sana moves | Home record patched; live payloads re-sealed with the new pin, expired and revoked ones untouched; shown in the CROPS video |
| P2-2 | "Nth lane after" | Lane counting on OSM geometry where the map has it |
| P2-3 | Family aliasing | A family member's name points at the household's records with `linkToNode` |
| P2-4 | Requester-supplied owners | A requester supplies its own owner address; the household name publishes a public encryption key |
| P2-5 | Household agent | An agent with the registrar role issues grants under its own policy |
| P2-6 | Grid names in ENS's app | `digipin.eth` names shown in ENS's own app, or on a block explorer |
