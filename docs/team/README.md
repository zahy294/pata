# Team guide

Four people, each with a Codex agent. Each role has its own file with the prompts to paste into Codex, in order:

| Role                              | File                                             | Owns                                                                                                                                               |
| --------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain ops + pitch (project owner) | [chain-ops-and-pitch.md](chain-ops-and-pitch.md) | the deployer and relay keys, parent names, hour-0 tests, the Worker's base (guard, `/topup`, `/register`), deploys, README, `/arkiv/` prose, video |
| Frontend                          | [frontend.md](frontend.md)                       | every screen, components, map, courier link format, PWA, Playwright                                                                                |
| AI/ML                             | [ai-ml.md](ai-ml.md)                             | DIGIPIN, geometry, the address and speech routes, the accuracy test                                                                                |
| Blockchain                        | [blockchain.md](blockchain.md)                   | keys, encryption, Anon-RPC, ENS, Arkiv, the grant flows, the DigipinResolver contract                                                              |

## Getting started (each developer, once)

1. Accept the GitHub invite, then `git clone https://github.com/zahy294/pata.git` and `cd pata`.
2. Install Foundry 1.8.7 (SETUP.md §1), then `git submodule update --init --recursive` (pulls forge-std).
3. `npm install` (installs the app and the Worker workspace).
4. Copy `.env.example` to `.env.local`. Fill in your own `ARKIV_ACCESS_KEY` and `NEXT_PUBLIC_ARKIV_ACCESS_KEY` (same value, SETUP.md §3). Never paste a key into Codex or a chat.
5. `npm run check` should pass.
6. Install the **tdd** skill in Codex if you haven't. Open Codex in the repo folder; it reads `AGENTS.md` by itself.
7. Open your role file and paste **Prompt 1**.

## How to use the prompts

- Paste one prompt at a time. Read Codex's plan file before letting it code; stop it if the plan touches files you don't own.
- After each prompt: `npm run check`, look at the diff, then let it commit and push.
- If Codex gets stuck on a library, tell it to read the research note named in the prompt, not the web.
- Post in the team chat when you finish a prompt that someone else is waiting on (the "Unblocks" line).

## File ownership

| Path                                                                                                                                                                                                                      | Owner                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/app/**`, `src/components/**`, `src/lib/link/`, `src/lib/map/`, `e2e/`, `public/`                                                                                                                                     | Frontend                                                                                                            |
| `src/lib/digipin/`, `shared/geo.ts`, `server/src/ai/`, `server/src/geo/`, `server/src/speech/`, `server/src/routes/address-*`, `server/src/routes/speech-*`, the address and speech functions in `src/lib/server-client/` | AI/ML                                                                                                               |
| `src/lib/keys/`, `src/lib/seal/`, `src/lib/rpc/`, `src/lib/ens/`, `src/lib/arkiv/`, `src/lib/flows/approve-grant.ts`, `courier.ts`, `revoke.ts`, `contracts/src/`, `contracts/test/`, `arkiv/schema.md`                   | Blockchain                                                                                                          |
| `server/src/index.ts`, `guard.ts`, `env.ts`, `http.ts`, `routes/topup.ts`, `routes/register.ts`, `server/src/chain/`, `server/wrangler.jsonc`, `scripts/`, `contracts/script/`, `README.md`, `arkiv/*.md` (except schema) | Chain ops + pitch                                                                                                   |
| `src/lib/flows/setup-household.ts`                                                                                                                                                                                        | AI/ML writes `describeTheWay`, `findCandidatePins`, `makeDirections`; Blockchain writes `signIn`, `createHousehold` |
| `shared/domain.ts`, `shared/api.ts`, `shared/constants.ts`                                                                                                                                                                | Everyone, with a heads-up in the team chat first                                                                    |

Screens call `src/lib/flows/*` and nothing lower. That's the seam: frontend can build every screen against those signatures with fake data while the real code lands underneath.

## Timeline (hour 0 = Thu 21:00 IST)

| When                              | Milestone                                                     |
| --------------------------------- | ------------------------------------------------------------- |
| Hour 0–2 (Thu 21:00–23:00)        | Repo up, parent names registered, hour-0 tests running        |
| Hour 10 (Fri 07:00)               | **First household name on Sepolia, through the app**          |
| Hour 12 (Fri 09:00)               | **Demo household on the OnePlus 11**                          |
| Hour 20 (Fri 17:00)               | **Every P0 ticket done.** P1 starts only now                  |
| Hours 20–28 (Fri 17:00–Sat 01:00) | P1 in ticket order; a ticket that slips is cut                |
| Hours 28–34 (Sat 01:00–07:00)     | Polish, README, `/arkiv/` files, offline kit, IPFS pin, video |
| Hour 34–36 (Sat 07:00–09:00)      | Submit before 09:00, rehearse the 4-minute demo               |

## Who waits on whom (P0)

```
blockchain  P0-5 keys/seal/rpc ──► P0-8 household ──► P0-10 grant ──► P0-11 courier ──► P0-12 revoke
                 │                      ▲                  ▲
owner       P0-2 names ─► P0-6 server ──┘                  │
                 │            │                            │
AI/ML       P0-4 digipin ─► P0-7 address AI ─► P0-9 directions + audio
                                   │
frontend    link + shell + map ─► setup screens ─► consent ─► courier view ─► lookup (P0-13)
```
