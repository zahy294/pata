# P0-5: Anon-RPC clients and hour-0 evidence

**Goal:** one lazy browser Nox worker carries Sepolia and Rabdi reads; wallet transports honor the P0 direct-write switch. Verify the real browser path and record the Nox rows of P0-3 honestly.

**Files:** `src/lib/rpc/index.ts`, RPC unit tests, `src/lib/rpc/diagnostics.ts`, `src/app/lookup/page.tsx` (`?debug=1` trigger authorized by the user), `e2e/rpc.spec.ts`, `docs/plans/P0-3.md`, this plan and the blockchain checklist. No separate debug page ships in the app.

**Tests first:** public boundaries proposed for user confirmation: readiness and factories (lazy singleton, browser guard, clients configured for both chains), client requests (real viem/Arkiv clients with mocked harness/network boundaries, direct writes only when selected, no direct fallback for failed reads), and method-only log snapshots. One failing behavior at a time, then minimal implementation. Separately run the real Nox smoke test from Playwright.

**Research read:** AGENTS.md, blockchain role, tickets, glossary, anon-rpc.md in full, viem.md, Arkiv Install and setup, installed harness/viem/Arkiv SDK source. Versions and constants remain pinned.

**Decisions:** `NOX_SPECIFIER`, config undefined, direct Sepolia bootstrap; HTTP timeout 30 seconds and retryCount 0, CCIP-Read disabled, Rabdi polling 1 second. Preserve Arkiv's access key in the configured RPC URL path. Never store parameters, URLs, keys, errors or worker log contents in rpcLog. P0 direct writes remain explicit; no automatic direct-read fallback.

**Risks:** OnePlus 11, deployed preview URL, origin-restricted public Arkiv key and funded development household may not be accessible. Ask for those while implementing independent work; never read secret files or claim unrun checks. An unkeyed Rabdi check cannot establish keyed access. Five write measurements per chain need funded test accounts, actual receipt waits, and Nox writes selected explicitly; no zero-value or simulated measurements reported as real. If Nox cannot reach Rabdi, record evidence before considering a disclosed fallback; README ownership requires a documented request. Keep this branch `blockchain` per the user, not main.

**User confirmation:** public test boundaries confirmed. No phone or preview is available yet; implement and run localhost Playwright now, provide the query-gated lookup trigger, and leave phone/write measurements pending. Never expose a development private key through public environment variables.

**Result:** pending.
