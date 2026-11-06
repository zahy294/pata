# P0-11: Courier view (`/c`) and Playwright tests

**Goal:** Build `src/app/c/page.tsx` and the Playwright tests in `e2e/courier.spec.ts` so a courier opening `/c#1~<household>~<payloadKey>~<sessionKey>` has the `#fragment` saved to `sessionStorage` and stripped from the address bar via `history.replaceState`, sees the public locality immediately, sees the exact door (DIGIPIN, room number, written address, directions text, `AudioPlayer`, and `MapView` with the pin) while `checkCourierLink` returns `"live"`, and sees `sessionStorage` cleared plus only the locality and `"This link has ended"` when `checkCourierLink` transitions to `"ended"` (or `"This link doesn't work"` when `"invalid"`).

**Files:**
- `docs/plans/P0-11-screen.md` (this plan)
- `src/lib/flows/fake.ts` (add `checkCourierLink` matching `src/lib/flows/courier.ts`, returning `"live"` initially and transitioning to `"ended"` on expiry)
- `src/app/c/page.tsx` (courier view: text-first for slow 4G, map below, 3-second polling of `checkCourierLink`, `sessionStorage` persistence and cleanup)
- `e2e/courier.spec.ts` (Playwright tests for `/c` loading, stripping `#` from the address bar, and transitioning from `"live"` to `"ended"`; keep the CROPS network test `test.fixme` for the owner)

**Tests first:**
- Typecheck gate (`tsc --noEmit && tsc --noEmit -p server`).
- Unit & contract test gate (`npm run check`).
- Static export build gate (`npm run build`).
- Playwright tests in `e2e/courier.spec.ts`.

**Research read:**
- `AGENTS.md`
- `docs/team/frontend.md`
- `docs/plan.md` ("Open a courier link")
- `docs/adr/0002-grant-liveness-from-the-registry.md`
- `docs/adr/0006-courier-link-format.md`
- `src/lib/flows/courier.ts`
- `docs/research/playwright.md`

**Risks:**
- `location.hash` and `sessionStorage` do not exist during static prerender: access them strictly inside `useEffect`.
- On a slow 4G phone, MapLibre tiles take longer than text: render the locality, room number, DIGIPIN, written address, directions text, and `AudioPlayer` above/before `MapView` so the courier can read and listen immediately.
- When `checkCourierLink` returns `{ state: "ended" }`, `sessionStorage` must be cleared immediately so refreshing the page does not retain the expired keys.

**Result:** Implemented `checkCourierLink` in `src/lib/flows/fake.ts`, built `src/app/c/page.tsx` (reads `location.hash` in `useEffect`, saves to `sessionStorage`, strips `#` with `history.replaceState`, displays locality immediately, polls `checkCourierLink` every 3 seconds, renders text/audio first and `MapView` below when `"live"`, clears `sessionStorage` and shows `"This link has ended"` when `"ended"`, and shows `"This link doesn't work"` when `"invalid"`), and implemented the Playwright tests in `e2e/courier.spec.ts` (keeping the CROPS test `test.fixme`). Verified with `npm run check` and `npm run build`.
