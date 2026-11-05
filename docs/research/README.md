# Research notes

One note per topic, started from [_template.md](_template.md). Every fact cites a primary source with the date it was read and says how it was verified. A note records evidence; the decision it leads to goes in `docs/adr/`, and settled terms go in `GLOSSARY.md`. Raw downloads go in `sources/`, which git ignores. Event rules and prizes stay in the root `research.md`.

Status is `open`, `answered`, or `test at kick-off` (answered on paper, still to prove in code). All notes below were checked 2026-11-03.

**Batch 1: the chain stack**

| Note | What it settles | Status |
|---|---|---|
| [ens-v2.md](ens-v2.md) | Sepolia ENSv2 addresses and calls for registering, subregistries, grants, revoke, records, aliasing, the ENSIP-10 wildcard and ENSIP-26; expired grants fall through to the parent's resolver | test at kick-off |
| [arkiv.md](arkiv.md) | SDK 1.0.0 on Rabdi: entity create/extend/delete, owner queries, limits (max lifetime 182.5 days, 100 rows a page), access key locked by origin rather than secret | test at kick-off |
| [anon-rpc.md](anon-rpc.md) | Harness 0.4.0: worker types and specifier addresses, the bootstrap reads plus bundle download, Nox on Sepolia as the one worker for both chains, write retry rules | test at kick-off |
| [viem.md](viem.md) | `http(url, { fetchFn: worker.fetch })`, viem's Sepolia UR is ENSv2's, Rabdi polling and fees, DNS encoding, nonce manager; no encryption in viem | test at kick-off |
| [foundry.md](foundry.md) | 1.8.7 layout in `contracts/`, `evm_version = "osaka"`, deploy and verify from `.env.local`, cast recipes, anvil rehearsal, Windows gate | test at kick-off |

**Batch 2: the app**

| Note | What it settles | Status |
|---|---|---|
| [nextjs-pwa.md](nextjs-pwa.md) | Next 16.4 static export limits, Serwist service worker, client-only wrappers, meta-tag CSP only; gateway subpaths break asset paths | test at kick-off |
| [passkeys.md](passkeys.md) | PRF support by platform (no Windows Hello), HKDF to two keys, RP ID bound to one stable hostname, sync output unconfirmed | test at kick-off |
| [maps.md](maps.md) | MapLibre 6.16 in Next, a bundled Protomaps PMTiles extract for Dharavi and BKC, OSM's tile servers forbid offline use, attribution | test at kick-off |
| [hosting.md](hosting.md) | Public IPFS gateways and Storacha are gone; Pinata or Filebase pins plus a stable host; eth.limo serves no testnet names; Cloudflare Workers for the small server | test at kick-off |
| [playwright.md](playwright.md) | 1.64.1 on Windows, CDP virtual authenticator with PRF (Chromium only), request logging for the CROPS proof, clock and RPC mocks | test at kick-off |

**Batch 3: AI and geo**

| Note | What it settles | Status |
|---|---|---|
| [claude-api.md](claude-api.md) | Haiku/Sonnet/Opus 5.5 prices and per-address cost, `messages.parse` with Zod, tool runner, forced `tool_choice` limits, 30-day retention, key stays server-side | test at kick-off |
| [nominatim-overpass.md](nominatim-overpass.md) | 1 req/s and no personal data on Nominatim, Overpass CPU quotas, bounding boxes from the locality not the PIN, caching and ODbL | test at kick-off |
| [digipin.md](digipin.md) | India Post's v2.0.0 repo and algorithm, grid and bounds, no hyphens since May 2026, test vectors (two official ones conflict), ENS-label mapping, Solidity decoding | test at kick-off |
| [speech.md](speech.md) | Sarvam (saaras:v4, bulbul:v4-flash) recommended, Azure free tier as fallback, Web Speech API privacy; Marathi quality unproven | test at kick-off |
