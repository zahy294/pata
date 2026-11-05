# P0-5: Anon-RPC clients and hour-0 evidence

**Goal:** one lazy browser Nox worker carries Sepolia and Rabdi reads; wallet transports honor the P0 direct-write switch. Verify the real browser path and record the Nox rows of P0-3 honestly.

**Files:** `src/lib/rpc/index.ts`, RPC unit tests, `src/lib/rpc/diagnostics.ts`, `src/app/lookup/page.tsx` (`?debug=1` trigger authorized by the user), `e2e/rpc.spec.ts`, `e2e/rpc.playwright.config.ts`, `docs/plans/P0-3.md`, this plan and the blockchain checklist. No separate debug page ships in the app.

**Tests first:** public boundaries proposed for user confirmation: readiness and factories (lazy singleton, browser guard, clients configured for both chains), client requests (real viem/Arkiv clients with mocked harness/network boundaries, direct writes only when selected, no direct fallback for failed reads), and method-only log snapshots. One failing behavior at a time, then minimal implementation. Separately run the real Nox smoke test from Playwright.

**Research read:** AGENTS.md, blockchain role, tickets, glossary, anon-rpc.md in full, viem.md, Arkiv Install and setup, installed harness/viem/Arkiv SDK source. Versions and constants remain pinned.

**Decisions:** `NOX_SPECIFIER`, config undefined, direct Sepolia bootstrap; HTTP timeout 30 seconds and retryCount 0, CCIP-Read disabled, Rabdi polling 1 second. Preserve Arkiv's access key in the configured RPC URL path. Never store parameters, URLs, keys, errors or worker log contents in rpcLog. P0 direct writes remain explicit; no automatic direct-read fallback.

**Risks:** OnePlus 11, deployed preview URL, origin-restricted public Arkiv key and funded development household may not be accessible. Ask for those while implementing independent work; never read secret files or claim unrun checks. An unkeyed Rabdi check cannot establish keyed access. Five write measurements per chain need funded test accounts, actual receipt waits, and Nox writes selected explicitly; no zero-value or simulated measurements reported as real. If Nox cannot reach Rabdi, record evidence before considering a disclosed fallback; README ownership requires a documented request. Keep this branch `blockchain` per the user, not main.

**User confirmation:** public test boundaries confirmed. No phone or preview is available yet; implement and run localhost Playwright now, provide the query-gated lookup trigger, and leave phone/write measurements pending. Never expose a development private key through public environment variables.

**Result:** RPC module and localhost read verification complete; keyed access, physical phone and funded write measurements remain pending per the user's revised scope.

- One lazy Nox worker shared across both chains; direct Sepolia bootstrap, no implicit fallback. Sepolia and Arkiv SDK clients have 30-second HTTP timeouts, zero retries and CCIP-Read disabled; Rabdi polls every second. Wallets honor `NEXT_PUBLIC_DIRECT_WRITES`.
- Logs contain only method, chain, route (`nox`/`direct`) and time; snapshots cannot mutate the log. Worker log messages are claimed and discarded so the harness does not echo them to the console. No raw error is rendered by diagnostics.
- TDD: 10 RPC unit tests, 41 total unit tests passing with 20 unrelated TODOs; app and Worker typechecks and 1 Foundry test passed. Targeted lint and static export build passed. A separate real-network Playwright run passed both the read smoke test and the ordinary-lookup hidden-panel check.
- Laptop Chrome, localhost, 2026-11-06 01:54 IST: Nox boot 3,563 ms; Sepolia chain ID 1,574 ms; ENS `getStatus(pata)` 1,641 ms, returned 2; Rabdi chain ID 1,248 ms; owner-filtered Arkiv query 1,487 ms, returned zero rows. These are single read samples, not write-latency medians. Earlier smoke run also passed.
- Browser request monitoring observed exactly two direct RPC calls, both Sepolia `eth_call` bootstrap calls to `NOX_SPECIFIER`; no direct Rabdi call. rpcLog showed the four subsequent calls through Nox. WebRTC contents are not visible to Playwright; this is evidence of no direct RPC bypass, not a mixnet packet trace.
- No Arkiv access key was configured (`accessKeyConfigured: false`), so this establishes public-endpoint Rabdi reachability only. No chain write was sent. No fallback or README change is warranted by this successful run.

**Manual follow-up:**

1. Run `npx playwright test --config e2e/rpc.playwright.config.ts` from the repo root (installed Chrome). The runner supplies the two public RPC URL defaults and writes its sanitized report to ignored `test-results/rpc-results.json`. Configure `NEXT_PUBLIC_ARKIV_ACCESS_KEY` locally before starting/rebuilding to repeat with `accessKeyConfigured: true`; never print its value.
2. On the deployed preview, open `/lookup/?debug=1` on the OnePlus 11 and tap **Run private RPC read checks**. Record device, network, date and all five results in P0-3; ordinary `/lookup/` has no diagnostics panel.
3. Once a development household is funded, measure five Sepolia writes and five Arkiv creates with Nox writes selected (`NEXT_PUBLIC_DIRECT_WRITES=0`), timing from send until receipt. Record every sample, transaction hashes, median and worst per chain. Do not substitute read timing or direct-write timing. The preview panel is intentionally read-only; fund browser-held household accounts from owner tooling, never expose a `.env.local` development private key in client code.
4. Use those actual measurements to choose the latency margin later. `GRANT_LATENCY_MARGIN_SECONDS` has not been recalibrated.
