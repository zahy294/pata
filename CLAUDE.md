# Pata

Households own `name.pata.eth` on ENSv2. Couriers and apps get expiring, revocable grants to the exact door; everyone else sees only the locality. Built at ETHGlobal Mumbai, Classic track: hacking runs Thu Nov 5, 21:00 IST to Sat Nov 7, 09:00 IST.

Until kick-off, the repo holds research and planning only: notes, plans, ADRs, the glossary and config. App code, contracts, tests and designed assets begin at kick-off (the Classic track's prior-work rule).

- Product, sponsor tracks, scope ladder, demo, hour-0 tests: `idea.md`
- Event rules and judging: `research.md`
- Technical facts with sources: `docs/research/`, indexed in its README. Read the matching note before writing or debugging code against ENS, Arkiv, Anon-RPC, DIGIPIN, maps or speech.
- Terms: `GLOSSARY.md`; name code after them (household, grant, payload, requester, courier link). Decisions: `docs/adr/`. Plan and tickets: `docs/plan.md`, `docs/tickets.md`. Each of these files starts with its first entry.

## Stack

Next.js 16 TypeScript PWA as a static export, with a Serwist service worker. It's served from a stable free host (Cloudflare Pages), because passkeys bind to one hostname, and the same build is pinned on IPFS (Pinata, Filebase). One small server on Cloudflare Workers holds the Claude key, the Sarvam key and the gas relay, and calls Nominatim and Overpass.

- Chains: viem, ENSv2's deployed Sepolia contracts, Arkiv testnet (Rabdi) through `@arkiv-network/sdk`, and `@anon-rpc/browser-harness` with the Nox worker. Foundry builds the one custom contract, the `*.digipin.eth` wildcard resolver.
- Map: MapLibre with a bundled Protomaps extract of Dharavi and BKC.
- Address AI: Haiku 5.5 extracts the address parts, Sonnet 5.5 ranks landmarks, Nominatim and Overpass search the map. Speech: Sarvam (`saaras:v4` in, `bulbul:v4-flash` out).

`npm run check` is the gate before each commit: typecheck, unit tests, `forge test`. Playwright runs separately as `npm run e2e`.

## Invariants

Privacy is the product. Each invariant is a judging claim, so a change that breaks one is a bug.

- Exact address data (DIGIPIN, written address, directions, room number) is stored only encrypted: to the household key, or to one grant's session key. Chains, Arkiv, logs and any server of ours hold ciphertext.
- Grant labels are random and opaque. The requester and purpose live inside the encrypted payload, because ENS logs every label and record value publicly.
- The model and the speech provider receive only the spoken way to the door and the directions written from it. Map search receives only landmark names and the locality, never the spoken words. The typed room or flat number leaves the device only inside encrypted records.
- RPC goes through the one Anon-RPC worker module: reads from P0, writes from P1. Direct calls are limited to:
  - the harness's bootstrap (two specifier reads and the bundle download);
  - writes before P1 lands;
  - Foundry deploy scripts;
  - our server's own transactions: relay top-ups and `register` calls in `pata.eth`'s registry;
  - the retry of a write that stalls in the mixnet. The retry checks for a receipt first, then re-sends the same signed bytes, and the app tells the user.
- A grant is live only if the registry says so. An expired grant still resolves through the household's resolver, so never infer expiry from a failed lookup.
- viem errors carry request bodies and the Arkiv key, so they never reach our server or its logs.
- The server's address and speech routes never log or store request bodies: the spoken description is nearly exact. Workers logs stay off for those routes.
- DIGIPIN encoding, expiry times and pin distances come from plain, tested code. The model only proposes candidates.
- Secrets live in `.env.local`; code reads the `process.env` names listed in `.env.example`.
- The demo has no hard-coded values: households, grants and payloads are created through the app.

## How we work

- Scope ladder: P1 opens when every P0 ticket is done, and P2 when every P1 ticket is. When time runs short, cut the ticket.
- Small commits named with the ticket id; commit history is judged.
- ETHGlobal wants planning files in the repo: each ticket's plan goes in `docs/plans/<id>.md`.
- AI use: the README's AI-use section says which files and parts AI wrote (an ETHGlobal rule).
- Hooks in `.claude/hooks/` block destructive git and rm commands, reading `.env` files, literal secrets in edits, and prompts that contain secrets. Ask the user instead of working around a block.
- Arkiv friction goes in `arkiv/friction.md` as it happens, one line each.
- Deploys: only the owner deploys, by hand, from an up-to-date `main` (the Worker with `wrangler deploy` in `server/`; the app rebuilds itself from `main`). Agents never run `wrangler` commands that change Cloudflare resources, or the owner's transaction scripts.
- The team codes with Codex, which reads `AGENTS.md`; keep its invariants in step with this file. Roles, file ownership and per-role prompts are in `docs/team/`. Screens call `src/lib/flows/*` only; `shared/` is the app–server contract.
