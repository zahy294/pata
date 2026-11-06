# Pata

Pata (पता, "address") gives Indian households an address name they own, like `white-gate.pata.eth`, on ENSv2.<br>
Strangers who look the name up see only the locality, for example "Dharavi, 400017".<br>
Couriers and apps get an expiring, revocable link to the exact door: pin, DIGIPIN, room number, written address and spoken directions in Hindi, Marathi or English.

Built at ETHGlobal Mumbai (Classic track, Nov 5–7, 2026).

## Try it

- **App:** https://pata.pata-ggr.workers.dev (built for phones; use mobile data, see [Known limitations](#known-limitations))
- **Server:** https://pata-server.pata-ggr.workers.dev (`/health`)

1. **Set up a home:** `/setup`. Tap **Use my current location**, or type a nearby landmark. In Mumbai, the location fills in the area and PIN code on the phone; check them, then type how to find your door. Type the room number separately; it never leaves the phone unencrypted. Move the pin onto your door on the map, check the directions in three languages, choose a name, then save (about 2 minutes).
2. **Share the door:** home → **Share a courier link**. Make a test request with a requester, purpose, language and duration (20 seconds for the stage demo), then approve. Share the link or QR code.
3. **Open it as the courier:** on another phone, open the link. You'll see the locality at once, then the door. When the grant ends, the page switches to "This link has ended" and shows only the locality.
4. **Look up a name:** `/lookup`. Any household name shows only its locality.

## How it works

```text
household phone ──signed──▶ Worker (Claude, map search, gas relay, /register)
      │                                       │
      ├─ ENSv2 Sepolia: name, resolver (public locality), grant registry
      └─ Arkiv Rabdi: sealed home, grant payload, history
courier phone ──Anon-RPC (Nox mixnet)──▶ ENS liveness check ──▶ Arkiv payload, decrypted with the link's key
```

| Piece                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Household name**    | `<label>.pata.eth` in Pata's ENSv2 UserRegistry. The household owns its own Permissioned Resolver (public `location` and PIN code records) and its own grant registry. `pata.eth`'s registry is emancipated and its subregistry pointer is locked ([ADR 0003](docs/adr/0003-grant-registry-stays-unemancipated.md)), so Pata can't take names back.                                                                                                                         |
| **Grant**             | An 8-character random label under the household name, e.g. `rjmrtr4h.test1.pata.eth`, owned by an address derived from a fresh session key. It expires on chain, and the household can unregister it early ([ADR 0002](docs/adr/0002-grant-liveness-from-the-registry.md), [ADR 0004](docs/adr/0004-grant-identity-from-the-session-key.md)).                                                                                                                               |
| **Courier link**      | `https://…/c#1~<household>~<payload key>~<session key>`. Everything after `#` stays in the browser and is never sent to any server; the page removes it from the address bar at once ([ADR 0006](docs/adr/0006-courier-link-format.md)).                                                                                                                                                                                                                                    |
| **Encrypted records** | Arkiv entities whose only contents are AES-GCM ciphertext. The home record is sealed to the household key. Each grant gets a payload sealed to its session key, plus a household-sealed index and history ([ADR 0008](docs/adr/0008-grant-entity-has-a-household-index.md)). Homes from before [ADR 0010](docs/adr/0010-setup-makes-no-voice-clips.md) keep voice clips. Entities expire on their own; grant payloads expire with the grant.                                |
| **Address AI**        | The household types the area, PIN code, a nearby landmark and how to find the door, or the phone's location places the pin ([ADR 0011](docs/adr/0011-setup-takes-a-typed-address-and-the-phone-location.md)). Without a location, **Sonnet 5.5** picks landmark pins only from real OpenStreetMap features (Nominatim and Overpass). Sonnet writes the directions in three languages. Plain, tested code places the pins and computes the DIGIPIN; the model only proposes. |
| **Speech**            | Setup records nothing and makes no Sarvam calls. The phone's own voice (`speechSynthesis`) reads the directions aloud, on setup and on the courier's page. Setup no longer makes Sarvam clips: a third ~100 KB clip write stalled setup on a phone ([ADR 0010](docs/adr/0010-setup-makes-no-voice-clips.md)).                                                                                                                                                               |
| **Courier check**     | The courier page shows the door only if the grant is live in the household's ENS registry, its owner matches the key in the link, and the payload's Arkiv owner is the household. It checks again every few seconds and ends as soon as the registry says so. A failed read never counts as expired.                                                                                                                                                                        |
| **Worker**            | One Cloudflare Worker holds the Claude, Sarvam and relay keys, checks household signatures, enforces a daily spend cap and kill switch, funds new households with test gas, and registers names. It runs in a US region (placement hint), because Anthropic refuses calls from some Cloudflare locations.                                                                                                                                                                   |

## CROPS

**What expiry means ([ADR 0005](docs/adr/0005-expiry-is-a-public-switch-not-encryption.md)):** only someone holding a grant's link can decrypt that grant's payload. Expiry and revocation stop honest apps from showing the door again; nothing can make a courier unsee an address they already read, or delete a copy they saved.

- **Censorship resistance:** Pata runs the host, the Worker, the gas relay and `/register`, so it can refuse to set up new homes. But a household's name, records and grants live on ENS and Arkiv. Once a link exists, the courier page reads only those chains, through Anon-RPC, and doesn't need our server.
- **Open source:** MIT ([LICENSE](LICENSE)). India Post's DIGIPIN code keeps its [Apache-2.0 notice](src/lib/digipin/LICENSE.apache-2.0). Map data is © OpenStreetMap contributors (ODbL).
- **Privacy:**
  - **Encrypted:** the exact door, DIGIPIN, written address, directions and room number are stored only encrypted.
  - **What the providers see:** Claude sees the typed way to the door (area, landmark, how to find the door) and the directions written from it. The phone's text-to-speech reads the directions, and Android may use Google's online voice if the language's voice isn't installed. Map search sees only the locality and the landmark name, and nothing when the phone's location places the pin. The area and PIN code suggested from the location come from a table bundled in the app, so the position goes nowhere ([ADR 0012](docs/adr/0012-locality-suggested-on-the-device.md)). The room number never leaves the phone unencrypted.
  - **What stays visible on chain:** label names, owners, schema tags and timing.
  - **Who sees IPs:** the Worker sees the household's signing address and IP. Map tiles come from OpenFreeMap, which sees the area being viewed.
- **Security:** keys are derived with HKDF from a device root and kept in browser storage (passkey-derived keys are P1-3). Page JavaScript can use the keys; device storage isn't a secure enclave. Courier links are bearer secrets.

## Real vs mocked

| Part                                           | Status                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Names, resolvers, grant registries             | **Real**, ENSv2 on Sepolia, created by the app (factory deploys from the household's own account)                                              |
| Grants: mint, expiry, liveness check           | **Real**, on chain; shown end to end on phones, including the 20 s stage grant ending by itself                                                |
| Revocation                                     | Flow implemented and tested against live chains ([P0-12](docs/plans/P0-12.md)); the screen that lists live grants with a revoke button is P1-2 |
| Encrypted home, voice, payload, audio, history | **Real**, Arkiv Rabdi                                                                                                                          |
| Landmark ranking, directions                   | **Real** Claude calls through the Worker                                                                                                       |
| Map                                            | **Real** OpenStreetMap data; landmark search falls back to a hand-dropped pin when Overpass refuses                                            |
| Gas                                            | The Worker's relay tops up each household with Sepolia ETH and Rabdi tGLM                                                                      |
| Seller and its request                         | The consent screen's "Make a test request" form stands in for a seller app (the seller screen is P1-5)                                         |
| Passkeys                                       | Not yet: a device-stored key (P1-3)                                                                                                            |

## Anon-RPC coverage

[`src/lib/rpc`](src/lib/rpc/index.ts) runs one Nox worker ([`@anon-rpc/browser-harness`](https://github.com/hisoka-io/anon-rpc)) for both chains. **Every read the app makes goes through it**, on the household's phone and the courier's. The direct exceptions, as listed in [CLAUDE.md](CLAUDE.md#invariants):

1. The harness bootstrap: two Sepolia reads and the bundle download.
2. Writes, which go direct until P1-4 (`NEXT_PUBLIC_DIRECT_WRITES=1`).
3. Foundry deploy scripts.
4. The Worker's own relay top-ups and `register` calls.

`/lookup?debug=1` has a read-only diagnostic panel that runs five checks through Nox.

## Evidence on chain

| What                                                        | Value                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `pata.eth` UserRegistry (emancipated)                       | `0x8961FBa6e336FfC00b564d873485Cc342DD00133`                         |
| Deployer and parent-name owner                              | `0xBe92B938A99fC0844AA2e0d5CE3296D10781F37D`                         |
| Gas relay and registrar                                     | `0x8E395a6B313698a042A781B2E2356aB3A0C1a678`                         |
| `pata.eth` subregistry lock (`revokeRoles`, block 12075385) | `0x126932d62eb40f75f1edfa7d47459211922008cf77d87dd1c90429b0a5053d8d` |
| `pata.eth` register                                         | `0x2b6930c36c0772ab504a8bb511b365a4cfc414f0444da5dd1ef6e245badf92e5` |
| `digipin.eth` register                                      | `0x2169a5c3044af773fafa07f3540cc98d504192ddf7cdb6cd41a94bb53df52d7d` |
| Household made on a phone: `test1.pata.eth`, owner          | `0x9538bf96982D1fD3b6036A4879213fE795Fd02BB`                         |

**An Arkiv query you can run:** POST this to `https://rpc.rabdi.db-chain.testnet.arkiv.network`. It lists that household's encrypted home record: key and expiry only, with nothing readable. Swap the schema for `pata.history.v1`, or `pata.voice.v1` for a home made before ADR 0010. Other schemas, keys and receipts are in [arkiv/schema.md](arkiv/schema.md) and [P0-3](docs/plans/P0-3.md).

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "arkiv_query",
  "params": [
    "arkiv.schema = str('pata.home.v1') AND $owner = addr(0x9538bf96982D1fD3b6036A4879213fE795Fd02BB)",
    { "select": { "key": true, "expiresAt": true } }
  ]
}
```

Arkiv write-ups: [why Arkiv](arkiv/why-arkiv.md), [how we use it](arkiv/how-you-use-arkiv.md), [reach](arkiv/reach.md), [friction](arkiv/friction.md).

## Known limitations

- **Some Wi-Fi networks block Anon-RPC.** If lookups or the courier page stall, switch to mobile data. After a few failed checks, the courier page says so.
- **Landmark pins appear mostly in Dharavi and BKC.** Overpass often refuses requests from Cloudflare, so other areas usually get the hand-dropped pin, placed by a tap on the map. When "area, PIN" isn't in OpenStreetMap, the search uses the PIN code's own area.
- **Area and PIN code suggestions cover Mumbai only.** They come from OpenStreetMap (© OpenStreetMap contributors, ODbL), and about one in seven may be the neighbouring PIN code, so the screen asks you to check them.
- **No voice input:** setup takes a typed address ([ADR 0011](docs/adr/0011-setup-takes-a-typed-address-and-the-phone-location.md)). The phone reads the directions aloud in Hindi, Marathi and English, if it has the voice.
- **Map tiles** come from OpenFreeMap, not yet the bundled extract, so the tile host sees the area viewed.
- **There's no IPFS pin yet** ([ADR 0001](docs/adr/0001-stable-host-plus-ipfs-pin.md)).

## AI use

ETHGlobal asks which parts AI wrote. Commits where an agent wrote code end with `AI: Codex` or `AI: Claude Code`. List them with `git log --grep "AI:"`; on 2026-11-06 alone, over 120 commits carry `AI: Codex` and over 50 carry `AI: Claude Code`. Commits from before about 04:00 IST on 2026-11-06 may lack the trailer; the table below covers them.

| Tool                        | What it wrote                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Codex** (each teammate's) | Most ticket code: keys, sealing and Nox RPC (`src/lib/{keys,seal,rpc}`); DIGIPIN and geometry; ENS and Arkiv modules, setup, grant, courier and revoke flows (`src/lib/{ens,arkiv,flows}`); the address AI, speech and map routes (`server/src/{ai,speech,geo,routes}`); the Worker guard and relay; the screens and components (`src/app`, `src/components`); `src/lib/link`; and the tests and plan files for each.                                                                                                                                                                                                                                                                                                  |
| **Claude Code**             | **Before kick-off:** planning and research (`idea.md`, `research.md`, `docs/research/*`, ADRs 0001–0008, `GLOSSARY.md`, `docs/plan.md`, `docs/tickets.md`).<br>**P0-1:** the scaffold and interfaces (`shared/`, module stubs, the check gate, `AGENTS.md`, `docs/team/*`); the owner scripts in `scripts/`.<br>**Reviews:** reviews and merges of every branch.<br>**Fixes from the phone runs on 2026-11-06:** AAC audio and the grant audio entity (ADR 0009); the screens' switch from fake to real flows; deploy nonces; Arkiv gas; model retries, the Sonnet fallback and failure-category logs; the Worker's US placement; the PIN-code locality fallback; tap-to-place pins; courier polling; and this README. |

People set the requirements and made the review decisions. The owner did all account, funding and deploy steps and the parent-name transactions, and ran the phone tests.

## Run locally

Prerequisites: Node 22 and Foundry 1.8.7 on PATH ([SETUP.md](SETUP.md)).

```sh
git submodule update --init --recursive
npm install
npm run check          # typecheck, unit tests, forge test
npm run dev            # app on http://localhost:3000
npm run server:dev     # Worker on http://localhost:8787 (second terminal)
```

Copy `.env.example` to `.env.local` and fill in the public `NEXT_PUBLIC_*` settings (for a local Worker, `NEXT_PUBLIC_SERVER_URL=http://localhost:8787`). Worker secrets go in `server/.dev.vars`. Never commit either file.

Other commands:

- `npm run build` exports the app to `out/`.
- `npm run e2e` runs Playwright.
- `node scripts/smoke-worker.mjs` checks a deployed Worker.

## Licence

[MIT](LICENSE), copyright 2026 Pata contributors. India Post's DIGIPIN code in `src/lib/digipin/` keeps its [Apache-2.0 licence and notice](src/lib/digipin/LICENSE.apache-2.0). Third-party code and OpenStreetMap data keep their own licences.
