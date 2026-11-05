# AGENTS.md: rules for coding agents (Codex) on Pata

Pata: households own `name.pata.eth` on ENSv2 (Sepolia). Couriers and apps get expiring, revocable grants to the exact door; everyone else sees only the locality. ETHGlobal Mumbai, Classic track, deadline **Sat Nov 7, 09:00 IST**.

Read before any task: this file, your role file in `docs/team/`, the ticket in `docs/tickets.md`, and the research note for the technology you touch (`docs/research/README.md` indexes them). Terms come from `GLOSSARY.md`; decisions from `docs/adr/`. When a research note and your memory disagree, the note wins: the versions here are newer than your training data.

## Workflow (every ticket)

1. Write `docs/plans/<ticket id>.md` (template in `docs/plans/README.md`). Commit it alone: `P0-4: plan`.
2. Use the **tdd** skill: red, green, refactor. One failing test, the least code to pass it, then tidy. Replace `it.todo` lines with real tests.
3. Run `npm run check` (typecheck, Vitest, `forge test`). It must pass before every commit.
4. Small commits named with the ticket id: `P0-4: encode Dak Bhawan`. Commit history is judged; never one giant commit.
5. `git pull --rebase` then `git push` to `main`. Never force-push, never rewrite pushed history.
6. When the ticket is done, fill in the plan's **Result** section and tick its "done when" in your role file's checklist.

## Ownership

Only change files your role owns (see `docs/team/README.md`). Files in `shared/` are the contract between people: change them only when your prompt says so, and say what changed in the commit message. If you need a change in someone else's file, stop and write the request in your plan's Risks section.

## Invariants (each is a judging claim; breaking one is a bug)

- Exact address data (DIGIPIN, written address, directions, room number) is stored only encrypted (`src/lib/seal`), to the household key or one grant's session key. Chains, Arkiv, logs and our server hold ciphertext only.
- Grant labels are random and opaque. Requester and purpose live only inside the encrypted payload: ENS logs every label and record value publicly.
- The model and Sarvam receive only the spoken way to the door and directions written from it. Nominatim and Overpass receive only landmark names and the locality. The typed room number never appears in any request to any server.
- All RPC goes through `src/lib/rpc` (Anon-RPC Nox worker). No other file creates a viem transport or calls `fetch` on an RPC URL. Exceptions: the harness bootstrap, P0 writes, Foundry scripts, the server's relay transactions, and the stalled-write retry (same signed bytes, after a receipt check).
- A grant is live only if the registry says so (ADR 0002). An expired grant still resolves through the household's resolver: never infer expiry from a failed lookup.
- viem errors carry request bodies and the Arkiv key: never send one to our server, a log, or the UI. Show a plain message instead.
- The server never logs or stores request bodies on `/address/*` and `/speech/*`.
- DIGIPIN encoding, expiry times and pin distances come from plain, tested code. The model only proposes candidates.
- Secrets live in `.env.local` (never read it, never print it) and Worker secrets. Code reads only names listed in `.env.example`. Anything `NEXT_PUBLIC_*` ships to every browser.
- No hard-coded demo data: households, grants and payloads are created through the app.

## Stack facts that trip agents

- **Next.js 16.4 static export** (`output: "export"`): no Server Actions, no route handlers that read the request, no cookies, headers, redirects or middleware/proxy, no dynamic routes without `generateStaticParams`. Browser APIs (`window`, `crypto.subtle`, `navigator.credentials`, `location.hash`, MapLibre, the Anon-RPC harness) only inside `useEffect` or `dynamic(..., { ssr: false })` from a `'use client'` file. Version-matched docs: `node_modules/next/dist/docs/`.
- **Arkiv SDK 1.0.0** on Rabdi (chain 7794095): `rabdi({ accessKey })` from `@arkiv-network/sdk/chains`. Never `tiramisu`, `ne`, `not`, cursors, `jsonToPayload`/`stringToPayload`/`MimeType` (pre-1.0, still in old docs). Read columns via `.value`; `bytes` come back as hex. Max lifetime 182.5 days. One 128 KiB `bytes` budget per create. Every query uses `.ownedBy(household)`.
- **ENSv2** (not v1): resolver setters take the DNS-encoded name (`toHex(packetToBytes(name))`), not a namehash, e.g. `setText(bytes,string,string)`. Reads only via `resolve(bytes,bytes)` or viem's `getEnsText`. Store labelhashes, never token IDs. Never write records to the root name `0x00` or to grant names. `unregister` reverts `LabelExpired` on an expired grant. Addresses and role bits: `shared/constants.ts`, `src/lib/ens/roles.ts`.
- **viem 2.57.14** has no encryption: use WebCrypto (AES-GCM, HKDF) and `@noble/hashes`/`@noble/curves`.
- **Claude API** (server only): `@anthropic-ai/sdk` 1.3.0, models `claude-haiku-5-5` and `claude-sonnet-5-5`, structured output with `client.messages.parse` + `zodOutputFormat`. Never call the API from the browser.
- **Sarvam:** `saaras:v4` (speech in, `codemix`), `bulbul:v4-flash` (speech out, mp3, 16 kHz), header `api-subscription-key`.
- **Foundry 1.8.7**, `contracts/`, `evm_version = "osaka"`. From the repo root always pass `--root contracts`. Name fork tests `*Fork*`.
- **Windows:** npm scripts run in cmd. No `VAR=x cmd` prefixes in scripts; no POSIX-only tools in npm scripts.
- **Pinned versions:** `.npmrc` has `save-exact=true`. Install with an exact version; never add `^`.

## Commands

| Command              | What                                                       |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | app on http://localhost:3000                               |
| `npm run server:dev` | Worker on http://localhost:8787 (needs `server/.dev.vars`) |
| `npm run check`      | the gate: typecheck (app + server), Vitest, `forge test`   |
| `npm run e2e`        | Playwright, separately                                     |
| `npm run build`      | static export to `out/`                                    |

## Arkiv friction

Anything confusing about Arkiv goes in `arkiv/friction.md` as one dated line, as it happens. It's 25% of Arkiv's judging.

## AI use

ETHGlobal requires the README to say which files and parts AI wrote. Put `AI: Codex` (or `AI: Claude Code`) as the last line of the body of every commit where an agent wrote code.
