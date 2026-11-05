# P0-8: Arkiv home and voice records

**Goal:** a household's encrypted home record round-trips on Rabdi; voice clips use the same owner-checked storage boundary.

**Files:** `src/lib/arkiv/` schemas, record functions, unit tests and opt-in live tests; ADR 0008, `arkiv/schema.md`, `arkiv/friction.md`, this plan and the blockchain checklist. Keep shared types/constants unchanged.

**Tests first (confirmed):** four public create/read functions at the SDK RPC boundary: encrypted home/voice round trips, 182-day expiration, owner/schema rejection and safe errors. Use real sealing and schemas. Separately verify real Rabdi home/voice creates, reads, ciphertext and rejection of a 183-day expiration. Grant/history operations and browser Nox routing are outside this ticket.

**Research read:** AGENTS.md, blockchain role, tickets, glossary, all Arkiv research, schema document, ADR 0007 and TDD skill. Consult installed SDK 1.0.0 source for exact types and lifetime validation.

**Decisions:** four named schemas from ARKIV_SCHEMAS; home/voice/history have one unindexed sealed bytes column; grant has session-sealed payload and household-sealed index sharing the 128 KiB budget. All app clients come from rpc. Key-based reads must verify owner before decrypting; SDK schema validation must reject a different schema. Encrypt before sending; do not publish language metadata.

**Risks:** live verification requires funded Rabdi development wallet. Consume `.env.local` only at runtime, never read/print it or raw SDK errors. Fund only a fresh throwaway household, record public evidence. Node live-test transport is separate from app Nox. Missing funds or network failures must be recorded without claiming acceptance. Work and pushes stay on `blockchain`.

**Result:** four SDK 1.0.0 schemas defined; encrypted home JSON and voice bytes create/read functions implemented with 182-day lifetimes, named-schema validation, owner checks before decryption and plain errors. ADR 0008 records the two-column grant decision; schema documentation matches it. Grant/history operations remain outside this ticket. `npm run check` passes: app/server typechecking, 70 unit tests and one Foundry test (18 unrelated TODO tests remain). Arkiv ESLint passes.

**Live verification:** on 2026-11-06 at 04:25 IST, read-only `eth_call` simulations against Rabdi accepted an anonymous create using `ExpirationTime.fromDays(182)` and decoded `ExpiryBeyondMaxLifetime` for `fromDays(183)`. No transaction was sent for those probes. The funded smoke test stopped at preflight: development wallet `0xBe92B938A99fC0844AA2e0d5CE3296D10781F37D` still showed **0 tGLM**, including rechecks after the user reported funding. No household was funded and no records were created. A public faucet transaction hash was requested to resolve this. The live home-record round-trip acceptance criterion is still pending; mocked tests are not a substitute.

**Re-run:** `node --env-file=.env.local node_modules/vitest/vitest.mjs run --config src/lib/arkiv/records.fork.config.mts`. The opt-in suite is excluded from `npm run check`. Runtime consumes `DEPLOYER_PRIVATE_KEY` and `ARKIV_ACCESS_KEY` without printing them; missing private key skips the test. It requires at least 0.11 tGLM and transfers 0.1 tGLM to a fresh household, creates voice and home entities, reads both, inspects owner/expiry/ciphertext and verifies the decoded 183-day rejection. Synthetic address/audio byte fixtures check storage, not MP3 playback or speech quality. Public-only evidence goes to ignored `scripts/dev/arkiv-smoke-results.json`; throwaway keys are not persisted. The Node adapter uses direct Rabdi transport; browser Nox behavior is covered separately.
