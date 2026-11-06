# P0-10: Courier link format (link part)

**Goal:** Implement `toBase64Url`, `fromBase64Url`, `formatCourierLink`, and `parseCourierFragment` in `src/lib/link/index.ts` following ADR 0006, tested via TDD in Node without browser globals.

**Files:**
- `docs/plans/P0-10-link.md` (this plan)
- `src/lib/link/index.ts` (pure TS implementation)
- `src/lib/link/link.test.ts` (unit tests)

**Tests first:**
- `formatCourierLink`: formats `https://<origin>/c#1~<household name>~<payload key>~<session key>` with unpadded base64url keys.
- `parseCourierFragment`: roundtrip parsing of formatted URLs.
- Fragment parsing with or without leading `#` (e.g. `#1~...` and `1~...`).
- Base64url encoding contains no `+`, `/`, or `=` characters.
- Household names with hyphens (e.g. `sana-home.pata.eth`).
- Rejection of non-"1" versions (e.g. version "2" returns `null`).
- Rejection of invalid token counts (missing fields or extra `~` tokens).
- Rejection of incorrect key lengths (e.g. 31-byte payload key or 31-byte session key).
- Rejection of malformed base64url data.

**Research read:**
- `AGENTS.md`
- `docs/team/frontend.md`
- `docs/adr/0006-courier-link-format.md`
- `docs/adr/0004-grant-identity-from-the-session-key.md`
- `shared/constants.ts`

**Risks:**
- Browser globals (`btoa`, `atob`, `window`) leaking into tests: write pure TypeScript base64url functions operating directly on `Uint8Array` byte values.
- Key type representation: `payloadKey` is `0x`-prefixed hex string in memory (32 bytes = 64 hex chars + `0x`), whereas `sessionKey` is `Uint8Array` (32 bytes). Both must encode to unpadded base64url and parse back to their expected types.
- Trailing slashes on origin URLs: ensure clean URL joining without double slashes.

**Result:** (in progress)
