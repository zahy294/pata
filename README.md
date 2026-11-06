# Pata

Pata is building household-owned address names on ENSv2.<br>
Couriers and apps receive expiring, revocable grants to the exact door.<br>
Everyone else sees only the locality: the neighbourhood and PIN code.

## Live app and hosting

- [App](https://pata.pata-ggr.workers.dev)
- [Server](https://pata-server.pata-ggr.workers.dev)

The app uses a stable Cloudflare host with Workers static assets; the API is a separate Worker. [ADR 0001](docs/adr/0001-stable-host-plus-ipfs-pin.md) named Pages, but the reason is unchanged: passkeys bind to one hostname. The IPFS pin is **planned**; no CID is published here yet.

**Draft, 2026-11-06:** deployed endpoints do not establish a completed household-to-courier demo. This checkout has placeholder screens and unfinished flows. Home/voice storage and ADR 0008 exist on the unmerged blockchain branch; the [P0-14 plan](docs/plans/P0-14.md) records the snapshot reviewed.

## How it works

The design maps [DHRUVA's roles](idea.md#the-six-jury-questions) onto ENSv2; this is not an official DHRUVA integration.

| DHRUVA role or concept | Pata mapping |
| --- | --- |
| Central Mapper | The ENS hierarchy connects provider registries. Other providers could run their own; a second live provider is planned. |
| Address Information Provider | Pata operates `pata.eth`'s ENSv2 UserRegistry; its registrar relay issues household names. |
| Digital Address and household | A household owns a subname, Permissioned Resolver and separate grant registry. Public records contain locality only; exact records are encrypted on Arkiv. Setup integration is planned here. |
| Consent token | An opaque, expiring subname owned by a one-time address derived from the grant's session key, with no transfer or record-setting roles. Issuance/revocation integration is planned. |
| Address Information User / requester | A seller, courier or emergency service receives a bearer courier link. ENSIP-26 requester identity and seller proof are planned. |
| Public address grid | DIGIPIN encoding is implemented; wildcard `*.digipin.eth` resolution is planned, with no deployed grid resolver claimed. |

Planned flow: confirm a proposed pin, create the name and encrypted home record, then approve a purpose and duration. The courier link carries the payload reference and session key after `#`, which browsers do not send to the host. The courier must check ENS ownership/liveness before opening the Arkiv payload; a missing payload also ends access. Family aliasing, passkey-derived keys and updating live grants after a move are planned.

## CROPS

**Honest access boundary ([ADR 0005](docs/adr/0005-expiry-is-a-public-switch-not-encryption.md)):** only a grant holder can read the shared exact-door payload; the household retains its own home key. Expiry stops future access in honest clients; nothing can make anyone unsee an address. A holder can retain the payload/key, and transaction history may retain ciphertext. Updating only live grants after a move is planned, not a completed current-door guarantee.

- **C — Censorship resistance:** Pata controls the host, registrar, relay and AI endpoint; refusal can stop new setup. The planned courier path reads chains without our API, but the server-off proof and parent-name pointer lock remain planned.
- **O — Open source:** the project is [MIT licensed](LICENSE), with source and local commands available. `src/lib/digipin/` keeps India Post's [Apache-2.0 notice](src/lib/digipin/LICENSE.apache-2.0); OSM-derived data requires ODbL attribution.
- **P — Privacy:** the host sees visits/IPs; the Worker sees signed household addresses/IPs. Planned Claude/Sarvam calls expose the way to the door and derived directions; map search gets locality/landmarks, never typed room numbers. Nox sees requests; bootstrap/direct endpoints see their traffic. Chains expose owners, labels, schema tags and timing despite encrypted contents. No provider zero-retention approval is claimed.
- **S — Security:** HKDF identities, device storage and AES-GCM sealing are implemented. Page JavaScript can use the signing key; device storage is not a secure enclave. Passkey recovery and courier key-wiping integration are planned. Links are bearer secrets; registry state, not failed resolution, decides grant liveness.

## Real vs mocked

The seller and its WhatsApp-style message are deliberate mocks. Other rows target real protocols; **planned** means the app flow is not yet implemented here, not that a fake chain substitutes for it.

| Part | Evidence and current status |
| --- | --- |
| Seller and WhatsApp message | Mock interaction; seller screen is still a placeholder. No WhatsApp integration. |
| Names | **Real:** ENSv2 Sepolia parent registrations and implemented registration relay. Household setup integration and parent pointer lock are planned. |
| Grants | **Planned on real ENSv2:** mint/status/unregister and approval functions remain stubs; no completed live grant demo claimed. |
| Payloads | **Planned on real Arkiv Rabdi:** grant operations remain stubs. Home/voice `createEntity`/`getEntity` code exists on the unmerged blockchain branch. |
| Expiry and revocation | Real registry/entity mechanisms are the design; combined courier checks and revoke flow are **planned**, not demonstrated here. |
| Anon-RPC | **Real:** Nox read clients for Sepolia/Rabdi and recorded laptop read checks. Keyed access, phone evidence and funded write latency remain pending in [P0-5](docs/plans/P0-5-rpc.md). |
| DIGIPIN, keys and sealing | Implemented with unit tests; no model-generated codes or mocked encryption. |
| AI, audio and screens | Map adapters/geometry implemented; this checkout's model/speech routes and most product screens are planned placeholders. No accuracy or multilingual demo result claimed. |

## Anon-RPC coverage

[src/lib/rpc](src/lib/rpc/index.ts) owns the clients: one lazy Nox worker carries application reads on both chains. Writes go direct by default (`NEXT_PUBLIC_DIRECT_WRITES=1`); Nox writes can be selected, but funded acceptance remains pending. This is not an end-to-end demo claim.

The [CLAUDE.md invariants](CLAUDE.md#invariants) list these direct-call exceptions:

1. Harness bootstrap: two Sepolia specifier reads and bundle download, exposing IP/network choice to bootstrap services.
2. P0 writes before private-write acceptance lands.
3. Foundry deployment scripts.
4. The server's relay top-ups and household-name registrations.
5. Planned stalled-write retry: check for a receipt, resend the **same signed bytes** directly, and tell the household. The retry helper is still a stub.

## Deployed addresses and receipts

Sepolia values recorded in [P0-2](docs/plans/P0-2.md), not new chain reads made for this draft:

| Role | Address |
| --- | --- |
| `pata.eth` UserRegistry proxy | `0x8961FBa6e336FfC00b564d873485Cc342DD00133` |
| Deployer / parent-name owner | `0xBe92B938A99fC0844AA2e0d5CE3296D10781F37D` |
| Relay / registrar | `0x8E395a6B313698a042A781B2E2356aB3A0C1a678` |

P0-2 records `isEmancipated() = true`. The irreversible parent subregistry-pointer lock is **planned**, waiting for the first working household.

| Transaction | Sepolia hash |
| --- | --- |
| Registry `deployProxy` | `0x89f8cacf1f30dd78619ffaf740d963998ab2f5834e5dd88adee464d01b6be3bf` |
| `pata.eth` commit | `0x0306ab6fd81f80d1e23e7ec7e731fc5f5c39521913b57ca5e4ba3b35d11de94d` |
| `pata.eth` register | `0x2b6930c36c0772ab504a8bb511b365a4cfc414f0444da5dd1ef6e245badf92e5` |
| `digipin.eth` commit | `0xff4bdba41b257aaacf3597bdafe3bd0dfd46a6804d937a3ea3dc89ddcc16fbc0` |
| `digipin.eth` register | `0x2169a5c3044af773fafa07f3540cc98d504192ddf7cdb6cd41a94bb53df52d7d` |

**Arkiv writing household addresses:** TODO after demo household. The relay/deployer above are not substitutes for a verified entity writer.<br>
**Judge-runnable `arkiv_query` with live entity evidence:** TODO after demo household. See [schema](arkiv/schema.md), [why Arkiv](arkiv/why-arkiv.md), [usage](arkiv/how-you-use-arkiv.md), [reach](arkiv/reach.md) and [friction](arkiv/friction.md).

## AI use

Attribution combines reachable `git log --grep "AI:"` commit bodies and changed paths with the owner's record of early Claude Code work. Untagged work is not assumed human-written.

Commits before 2026-11-06 ~04:00 IST may lack AI trailers; this section is the complete record.

| Tool | Files and parts assisted |
| --- | --- |
| Codex | `src/lib/keys/`, `src/lib/seal/`, `src/lib/rpc/`: identities, storage, encryption, RPC and tests. `src/lib/digipin/`, `shared/geo.ts`, `server/src/geo/`: encoding, geometry, map adapters and tests. Worker guard/router/relay and topup/register routes, `src/lib/server-client/{signed,index}`, `scripts/smoke-worker*`: protected server calls and checks. Associated plans and this README/Arkiv prose are AI-written or AI-edited. |
| Claude Code | **Before kick-off, planning and research written under the owner's direction:** `idea.md`, `research.md`, `docs/research/*`, `docs/adr/0001`–`0007`, `GLOSSARY.md`, `SETUP.md`, `docs/plan.md`, `docs/tickets.md`.<br>**P0-1 scaffold and interfaces:** Next.js/Foundry/Worker setup; `shared/` domain, constants and API contract; `src/lib/` and `server/src/` module stubs and signatures; screen stubs; `contracts/` resolver stub and vendored interface; the check gate; `AGENTS.md`, `docs/team/*`, `CODEOWNERS`.<br>**Owner scripts:** `scripts/env-file.mjs`, `scripts/check-env.mjs`, `scripts/balances.mjs`, `scripts/rotate-keys.mjs`, `scripts/check-names.mjs`, `scripts/register-parent-names.mjs`, `scripts/lock-pata.mjs`, `scripts/fund-relay.mjs` (including trailer-bearing `066f311`, `5b1b6c9`, `dbfcd1f`).<br>**Reviews:** code review of every merged branch. |

Representative Codex commits: `90b2b61` (sealing), `6b66128` (keys), `28e7c1b` (RPC), `b689f3d` (DIGIPIN), `f90e32a` (map adapter), `d96b9cd` (relay), `58f4c46` (smoke). Unmerged home/voice code reviewed for this draft also has Codex trailers; it is not presented as integrated.

People supplied the product requirements and review decisions. The owner performed account/funding/hosting setup and the parent transactions recorded in P0-2. Human phone tests, consented fieldwork, rehearsal and video narration remain planned unless recorded separately. Specs and team guidance remain in [idea.md](idea.md), [research.md](research.md), [team guide](docs/team/README.md) and [ticket plans](docs/plans/README.md).

## Run locally

Prerequisites: Node 22/npm and Foundry 1.8.7 on PATH; see [SETUP.md](SETUP.md).

1. Initialize dependencies:

   ```sh
   git submodule update --init --recursive
   npm install
   ```

2. Copy `.env.example` to your own ignored `.env.local`, fill required public settings, and use `NEXT_PUBLIC_SERVER_URL=http://localhost:8787`. Put private Worker bindings in ignored `server/.dev.vars` as described in `.env.example`; never put secrets in `NEXT_PUBLIC_*`, paste them into tools or commit them.
3. Run the gate and app:

   ```sh
   npm run check
   npm run dev
   ```

4. In a second terminal:

   ```sh
   npm run server:dev
   ```

App: `http://localhost:3000`; Worker: `http://localhost:8787`. These commands run the draft and its placeholders, not the planned full demo. `npm run build` exports to `out/`; Playwright runs separately with `npm run e2e`. CLI tests: `node --test scripts/smoke-worker.test.mjs`. Only the owner deploys from an up-to-date `main`.

## Licence

The project is licensed under [MIT](LICENSE), copyright 2026 Pata contributors. India Post's DIGIPIN code in `src/lib/digipin/` retains its [Apache-2.0 licence and notice](src/lib/digipin/LICENSE.apache-2.0). Third-party code and OSM-derived data retain their respective licences.
