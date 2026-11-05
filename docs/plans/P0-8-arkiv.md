# P0-8: Arkiv home and voice records

**Goal:** a household's encrypted home record round-trips on Rabdi; voice clips use the same owner-checked storage boundary.

**Files:** `src/lib/arkiv/` schemas, record functions, unit tests and opt-in live tests; ADR 0008, `arkiv/schema.md`, `arkiv/friction.md`, this plan and the blockchain checklist. Keep shared types/constants unchanged.

**Tests first (confirmed):** four public create/read functions at the SDK RPC boundary: encrypted home/voice round trips, 182-day expiration, owner/schema rejection and safe errors. Use real sealing and schemas. Separately verify real Rabdi home/voice creates, reads, ciphertext and rejection of a 183-day expiration. Grant/history operations and browser Nox routing are outside this ticket.

**Research read:** AGENTS.md, blockchain role, tickets, glossary, all Arkiv research, schema document, ADR 0007 and TDD skill. Consult installed SDK 1.0.0 source for exact types and lifetime validation.

**Decisions:** four named schemas from ARKIV_SCHEMAS; home/voice/history have one unindexed sealed bytes column; grant has session-sealed payload and household-sealed index sharing the 128 KiB budget. All app clients come from rpc. Key-based reads must verify owner before decrypting; SDK schema validation must reject a different schema. Encrypt before sending; do not publish language metadata.

**Risks:** live verification requires funded Rabdi development wallet. Consume `.env.local` only at runtime, never read/print it or raw SDK errors. Fund only a fresh throwaway household, record public evidence. Node live-test transport is separate from app Nox. Missing funds or network failures must be recorded without claiming acceptance. Work and pushes stay on `blockchain`.

**Result:** pending.
