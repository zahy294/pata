# P0-8: ENS household contracts

**Goal:** validated household names, artifact-sourced ENSv2 ABIs and tested roles; deploy a household's resolver and grant registry, initialize only public locality records, and update locality later. Verify real Sepolia deployments and resolution after the owner's registration.

**Files:** `src/lib/ens/abis.ts`, `names.ts`, `names.test.ts`, `roles.test.ts`, `household.ts` and its tests; this plan, P0-3 gas evidence and the blockchain checklist. A throwaway smoke script may live under ignored `scripts/dev/`. No shared type or constant changes without explicit need and authorization.

**Tests first (confirmed by the user):** public name helpers for valid two-word suggestions and known DNS bytes; exported role bitmaps against literal documented values; household functions at the RPC boundary for label status, factory calldata, successful/missing deployment logs, and locality updates. One failing behavior then minimal implementation. Live Sepolia verification remains separate from the fast gate.

**Research read:** AGENTS.md, blockchain role, ENSv2 note in full, ADRs 0002/0003/0004, tickets, glossary and plan template, TDD skill. Download deployment artifacts from `ensdomains/contracts-v2@07e55a056f5b6a9c90119f501bdd05714e67dddd` and cite the source beside each ABI subset. Source wins over prose if signatures differ.

**Decisions:** DNS-encoded complete household names on resolver setters; never root/grant records. Resolver gets all resolver root roles; grant registry gets only the documented registrar/unregister/renew roles and admins, staying un-emancipated. Version 0 factory salt conventions; read actual proxy addresses from matching factory events and wait for successful receipts. Retry behavior must not blindly duplicate CREATE2 deployments. All app clients come from `src/lib/rpc`.

**Risks:** the owner's `/register` and browser registerName function are currently stubs owned by another role. Record that dependency rather than implementing someone else's service. Live testing needs a funded development wallet and parent registry; secret files must never be opened or printed. Owner scripts may consume environment variables at runtime, with plain errors and public addresses/receipts only. Do not claim end-to-end name resolution if registration is unavailable. Work and pushes stay on `blockchain`.

**Result:** ENS implementation and live Sepolia deployment/update checks pass. ABI subsets match the pinned deployment artifacts; 57 unit tests and one Foundry test pass with app/server typechecking (18 unrelated TODO tests remain). No shared constants or types changed. The opt-in fork test verifies resolver initialization, both public locality records, the grant registry's un-emancipated state, and a later locality update. Public receipts and gas are in `P0-3.md`.

The first immediate read verification failed; repeating read-only calls against those same deployed contracts returned both correct records and `isEmancipated=false`. RPC propagation lag is suspected, not proven. The live test now polls reads for at most 30 seconds after mined receipts; the complete rerun passed. Application behavior was unchanged by this test adjustment.

**Pending, explicitly deferred by the user:** owner's `/register` and subsequent universal-resolution `getEnsText` check. Direct `resolve(bytes,bytes)` verification does not establish name registration or universal resolution. Do not mark the full end-to-end acceptance criterion complete yet.

**Re-run live verification:** `node --env-file=.env.local node_modules/vitest/vitest.mjs run --config src/lib/ens/household.fork.config.mts`. Requires `DEPLOYER_PRIVATE_KEY` at runtime (never open or print `.env.local`); skips if missing. Every run funds a fresh throwaway household with 0.0001 Sepolia ETH, then sends two deployments and a locality update. Public-only results go to ignored `scripts/dev/ens-smoke-results.json`; throwaway keys are not persisted. The Node-only RPC adapter uses direct testnet transport, separate from the application's Nox clients. This is not a Nox write-latency measurement.
