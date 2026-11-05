# P0-7: address AI and candidate pins

**Goal:** implement Prompt 4's typed way-to-the-door flow using mocked external fetch; leave real model/map/deployed smoke pending owner deployment and credentials.

**Files:** owned `server/src/ai/{extract,rank}.ts`, geo pin placement, address extract/rank routes and tests; address functions in `src/lib/server-client` and `src/lib/flows/setup-household.ts`; AI/ML checklist. Preserve shared schemas, keys, guard, router, chain calls, speech and directions stubs.

**Tests first:** the role's existing public seams: extraction and ranking via real SDK with mocked HTTP; `keepKnownLandmarks`; deterministic `placeCandidatePins`; address routes via parsed request/response and model/map HTTP mocks; signed client calls and typed setup flow through fetch. Validate locality, known ids, relation/confidence, at most three candidates, ten-metre deduplication, empty-map fallback, privacy and plain errors. These seams were requested by Prompt 4; no new public test interface.

**Research read:** Claude API note, map-search note, glossary, ticket/role, shared API/domain/geometry/constants, installed SDK parsing/types and TDD skill. Follow role's bounded one-call ranking flow rather than the research note's optional tool loop.

**Decisions:** model requests contain only the way to the door (plus language for extraction and id/name/kind for ranking); no feature coordinates go to Claude. Rank at most five, reject unknown ids, order pins by confidence stably, dedupe within ten metres and cap at three. For opposite reflect the landmark across its nearest street; behind move ten metres farther away from that street; if direction cannot be determined or no street is available retain the landmark. At snaps to street; near retains landmark. All distances come from shared geometry. Keep schemas/signatures compatible; add optional usage callback to model functions only if necessary for actual token accounting. Charge model usage even if parsing/refusal fails; never expose provider errors.

**Risks:** P0-6 `chargeSpend` and guard are currently owner stubs. Use the owner spend interface without editing it, with a test substitute only at that owner boundary; production remains blocked until P0-6 lands. Spending admission/reservation semantics must be reconciled with owner implementation. No live model call or deploy; fake credentials only in tests. Typed input only; Blob input remains for Prompt 5. KV coordination, endpoint wiring, real model quality/latency and Worker CPU remain deployment checks. Room number and written address are never accepted by these request schemas.

**Result:** pending. Commit plan first, then implementation in small checked commits on `feat/ai-ml`.
