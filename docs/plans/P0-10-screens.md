# P0-10: Consent screen and QR code (`/approve`)

**Goal:** Build `src/app/approve/page.tsx` and `src/components/QrCode.tsx` so the household can inspect an incoming `GrantRequest` from `/approve#<base64url JSON>`, create a test request via an on-page form (including the 20-second stage option), approve the grant via `flows.approveGrant(keys, household, request)`, and share the resulting courier link via `navigator.share` (with clipboard fallback) or a locally drawn QR code.

**Files:**
- `docs/plans/P0-10-screens.md` (this plan)
- `src/components/QrCode.tsx` (client-side QR canvas drawn locally with `qrcode`)
- `src/lib/flows/fake.ts` (add `approveGrant` and `loadHouseholdState` fake helpers matching `src/lib/flows/approve-grant.ts`)
- `src/app/approve/page.tsx` (strict base64url JSON `GrantRequest` validator, consent view with prominent bearer-link warning, approval action, share + QR sheet, and "Make a test request" builder form)

**Tests first:**
- Typecheck gate (`tsc --noEmit && tsc --noEmit -p server`).
- Unit & contract test gate (`npm run check`).
- Static export build gate (`npm run build`).
- Verify strict rejection of malformed `#fragment` payloads and end-to-end test request → `#fragment` → approve → courier link + QR code.

**Research read:**
- `AGENTS.md`
- `docs/team/frontend.md`
- `docs/plan.md` ("Approve a grant")
- `docs/adr/0006-courier-link-format.md`
- `src/lib/flows/approve-grant.ts`

**Risks:**
- Courier link is a bearer secret: QR code must be rendered strictly on-device with the `qrcode` package (`QRCode.toCanvas`), never via an external image API.
- `navigator.share` is not supported on all desktop browsers: fall back cleanly to `navigator.clipboard.writeText` with a "Copied" confirmation state.
- Raw errors from approval calls must never be displayed directly; show a plain sentence and a retry button.

**Result:** (in progress)
