# P1 branching rules (from 2026-11-06, 17:30 IST, until the owner says otherwise)

For every teammate and every coding agent (Codex, Claude Code). `AGENTS.md` and `CLAUDE.md` point here.

## `main` is frozen

`main` is the working end-to-end demo: setup, consent, courier view and lookup, tested on phones. Nothing may break it before the deadline.

- **Never push to `main`**, never open a pull request into `main`, and never merge anything into it. That includes "small" fixes, docs and dependency bumps.
- **Only the owner moves `main`,** by merging `p1` into it once every P1 ticket works on `p1` (see "When `p1` goes to `main`").

## Work goes to `p1`

`p1` is the integration branch for P1. It starts as a copy of `main`.

1. Branch from the latest `p1`, naming the branch after the ticket: `git switch -c p1-2-access-screen origin/p1`.
2. Follow the usual ticket workflow in `AGENTS.md`: a plan file, test-first, small commits named with the ticket id (`P1-2: …`), and the `AI: Codex` trailer.
3. Before every push, run `npm run check` (typecheck, unit tests, `forge test`) and `npx next build`. Both must pass.
4. Open the pull request **into `p1`** (base: `p1`, not `main`). Say in it which P0 flow you re-tested and how.
5. Claude Code reviews it, and it's merged into `p1` only after the owner says that ticket is done. Don't merge your own pull request.
6. To pick up others' work, merge `origin/p1` into your branch. Don't rebase or force-push shared branches.

## Keep `p1` as safe as `main`

A pull request into `p1` must not break any P0 flow. Re-test what you touched on the live-style flow (mobile data, see below):

- `/setup`: describe → pin → directions → name → save.
- `/approve`: test request → approve → courier link.
- `/c`: the courier sees the door, then "This link has ended" once a 20 s grant expires.
- `/lookup`: shows the locality only.

**Fixes from today's phone runs that must not regress** (each has a commit and a test on `main`; read them before touching these files):

| Area                                                                   | Rule                                                                                                    | Why                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `server/wrangler.jsonc` `placement`                                    | Keep the Worker in a US region                                                                          | Anthropic answers 403 `forbidden` to calls from Cloudflare's Hong Kong data centre    |
| `server/src/ai/structured.ts`, `src/lib/server-client/address-call.ts` | Keep the SDK retry, the Sonnet fallback for extraction, and the app's 3 tries on model-unavailable 502s | Those 403s and unusable replies are intermittent                                      |
| `server/src/guard.ts` counters                                         | A refused KV write must not fail a request                                                              | KV allows one write per key per second across instances                               |
| `src/lib/flows/courier.ts`, `src/app/c/page.tsx`                       | One check at a time; the door shows before the audio clip loads                                         | Overlapping checks and a 115 KB clip read through the mixnet stalled the courier page |
| Audio                                                                  | Setup makes no clips (ADR 0010); older clips: 8 kHz AAC, an entity each (ADR 0009)                      | A ~100 KiB clip write stalled setup on a phone; Sarvam's MP3 is 128 kbps              |
| `server/src/geo/nominatim.ts`                                          | Keep the PIN-code fallback and the 15 km check                                                          | OpenStreetMap's Indian postcodes are patchy; "Bandra" alone matched a county in Bihar |
| `src/lib/ens/household.ts`                                             | Keep the explicit deploy nonces                                                                         | The load-balanced write RPC reused a mined nonce                                      |
| `server/src/chain/relay.ts`                                            | Keep the 0.1 tGLM Arkiv top-up                                                                          | A full-size Arkiv create costs about 0.013 tGLM                                       |

## Test on mobile data

Some Wi-Fi networks block Anon-RPC (the Nox mixnet): lookups and the courier page stall. Test phones on mobile data. `/lookup?debug=1` → **Run private RPC read checks** shows whether Anon-RPC works on a device.

## Things only the owner does

- **Deploys:** `wrangler deploy` of the Worker, and anything that changes Cloudflare. A server change on `p1` reaches the live Worker only when the owner deploys it.
- **Scripts:** the owner scripts in `scripts/` that read `.env.local`.
- **Merging `p1` into `main`.**

## When `p1` goes to `main`

Only when all of these hold:

1. Every P1 ticket the owner chose is merged into `p1`.
2. `npm run check` and `npx next build` pass on `p1`.
3. The four P0 flows above, plus the new P1 screens, work on phones on mobile data against `p1`. A server change on `p1` must be deployed by the owner before that test.

Until then, nothing from P1 goes to `main`, even if the ticket is finished.
