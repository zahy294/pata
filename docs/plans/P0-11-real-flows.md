# Screens on the real flows (P0-7, P0-8, P0-10, P0-11 integration)

**Goal:** the merged frontend's setup, consent and courier screens called `src/lib/flows/fake.ts`, so no real household or grant could be made. Switch them to the real flows, and fix what the 2026-11-06 frontend review found, without redesigning the screens.

**Changes**
- **Setup** imports `flows/setup-household` (now also re-exports `isValidHouseholdLabel`). The name locks once `createHousehold` starts: the real flow resumes from a checkpoint and refuses changed details. A resumed setup isn't blocked by the availability check, because after registration the household owns its name, and the check would report it "taken".
- **Consent** uses `signIn` and `loadHousehold`, the real stored state. A phone with no home shows "Set up your home first" instead of the fake `blue-gate.pata.eth`. The copy no longer says "single-use token", "one-time pass" or "turn-by-turn" (ADR 0005, ADR 0006: the link is a bearer secret until it ends).
- **Courier view** uses the real `checkCourierLink`. It removes the `#` from the address bar before touching sessionStorage, and clears storage on `invalid` as well as `ended`. A live view is held through at most 2 failed checks (about 6 s), and never past `grantEnd`. The registry still decides liveness, but a single Anon-RPC hiccup no longer hides the door. The ended text no longer claims the details were "locked".
- **Hand-dropped pin:** `PinPicker` read the bbox as [south, west, …], which put the pin off the map; the bbox is [west, south, east, north]. The map credit now names OpenFreeMap, whose tiles the map loads.
- `fake.ts` is deleted, as `docs/team/frontend.md` requires. The e2e test that checked fake door data is `fixme` until it uses a real stage grant.

**Open:** map tiles still come from `tiles.openfreemap.org`, which sees the courier's IP and the door's area. The bundled Protomaps extract (`public/maps/`) is an owner task. 4 ESLint `set-state-in-effect` errors predate this change.

**Verification:** `npm run check` (519 tests), `next build`, and `npx playwright test e2e/courier.spec.ts` (4 passed, 4 skipped).
