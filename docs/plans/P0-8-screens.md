# P0-7 / P0-8: Set up a household (screens & components)

**Goal:** Build the step-by-step household setup flow in `src/app/setup/page.tsx` along with `Recorder.tsx`, `PinPicker.tsx`, `AudioPlayer.tsx`, and `src/lib/flows/fake.ts`, running end-to-end on localhost and mobile in our Civic Bento (Warm Ivory `#F9EBD7`, Deep Emerald `#046A38`, Antique Brass `#B8862D`) theme.

**Files:**
- `docs/plans/P0-8-screens.md` (this plan)
- `src/lib/flows/fake.ts` (fake setup flows matching `setup-household.ts` and `ens/household.ts` signatures)
- `src/components/Recorder.tsx` (`MediaRecorder` up to 30 s with countdown timer and `onRecorded(Blob)`)
- `src/components/PinPicker.tsx` (up to 3 candidate pins on `MapView` with landmark, relation, word confidence `low`/`medium`/`high`, drag support, and hand-drop fallback)
- `src/components/AudioPlayer.tsx` (plays MP3 bytes via `blob:` URL revoked on unmount, with `speechSynthesis` fallback)
- `src/app/layout.tsx` (phone-first Civic Bento shell with clean `Pata.` typographic header)
- `src/app/setup/page.tsx` (7-step household setup wizard with loading states, retry buttons, and plain-sentence error messages)

**Tests first:**
- Typecheck gate (`tsc --noEmit && tsc --noEmit -p server`).
- Unit & contract test gate (`npm run check`).
- Static export build gate (`npm run build`).
- End-to-end manual walkthrough of all 7 steps on fake data (sign-in → way to door + separate room number → candidate pin picker / hand-drop → formatted DIGIPIN → 3 language directions + audio player → name suggestion/validation/availability check → creation progress list → redirect to `/`).

**Research read:**
- `AGENTS.md`
- `docs/team/frontend.md`
- `docs/plan.md` ("Set up a household")
- `docs/tickets.md` (P0-7, P0-8, P0-9)
- `src/lib/flows/setup-household.ts`
- `docs/adr/0006-courier-link-format.md`

**Risks:**
- `MediaRecorder` / microphone permission unavailable on desktop or non-HTTPS: provide seamless toggle/fallback to typed textarea so the household can always proceed.
- Raw error objects from `viem` or `fetch` leaking request bodies: catch all errors in UI handlers and show a plain human-readable sentence with a retry button.
- Browser APIs (`MediaRecorder`, `speechSynthesis`, `URL.createObjectURL`, `indexedDB`) touched during SSR prerender: keep inside `'use client'` event handlers and `useEffect`.

**Result:** (in progress)
