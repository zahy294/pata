# P0-4: review follow-up

**Goal:** make reference evidence reproducible, fix boolean runtime validation, and clarify the already agreed input normalization without changing P0-7 or Solidity.

**Files:** DIGIPIN module/tests, a reference-fixture generator and generated JSON under `src/lib/digipin/reference/`, its reproduction README, this follow-up plan, and the stale hyphen sentence in `docs/research/digipin.md`. Preserve the original P0-4 implementation/history and other owners' files.

**Tests first:** existing public seams `isValidDigipin`, `decodeDigipin`, `toGridLabel`, `formatDigipin` for runtime input and normalization; `encodeDigipin` and `decodeDigipin` against independently generated reference outputs. No new API or test seam is needed.

**Research read:** AI/ML P0-4 prompt, original plan, DIGIPIN research, TDD skill, and India Post README + source at `a15339e8fdea93b13ae0d7336e567c9ae6ceac8e` (fetched again for this review).

**Findings and minimal changes:**

- Valid: the original 1,000-case comparison was run outside the repo. Add offline fixtures generated exclusively by the pinned upstream encoder/decoder, with source SHA-256, deterministic seed, explicit edge/boundary inputs and regeneration instructions.
- Valid: boolean validation must reject non-strings rather than call `.replace` on them. Keep TypeScript signatures unchanged; consumers continue to throw `Invalid DIGIPIN` for invalid inputs.
- No space behavior change justified: Pata deliberately strips ASCII U+0020 spaces anywhere on input. Upstream canonical interchange remains ten continuous characters, and Pata output stays canonical (or 3-4-3 for display). Record this explicit convenience difference and test it.
- Valid documentation conflict: remove the stale instruction to strip hyphens. Retain v2 hyphen rejection.

**Risks:** reference generation needs a network download or an exact local copy of the pinned source; offline tests use committed fixtures. Verify source hash before executing it in a restricted VM; never import Pata code into the generator. The reference returns six-decimal centre strings, so compare at that precision, retaining existing full-precision tests separately. Per the user's explicit request, include this plan in one follow-up commit after all checks; do not push.

**Result:** completed. Added 1,062 independently generated pinned-reference fixtures and a SHA-256-verified generator; both downloaded-source and local-source regeneration matched byte for byte, and a modified source was rejected before execution. Runtime tests first exposed nine non-string failures; the single type guard fixes them while preserving string signatures. Added consumer-error and normalization regression coverage, retained ASCII-space normalization and hyphen rejection, and corrected the research note. `npm run check` passes: app/server typechecks, 164 Vitest tests (17 existing TODOs), and one Foundry test. `git diff --check` passes. P0-7, Solidity and other owners' files were preserved; no push.
