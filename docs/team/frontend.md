# Frontend: Codex prompts

You own every screen, the components, the map, the courier link format, the PWA and the Playwright tests. Your screens call `src/lib/flows/*` only, never viem, Arkiv or `fetch` directly.

**Until a flow is real**, build against fake data: create `src/lib/flows/fake.ts` with the same signatures returning sample values, import from it, and switch to the real module when its owner posts "Unblocks" in the team chat. Delete `fake.ts` before hour 20: the demo can't contain hard-coded data.

UI rules: phone first (the OnePlus 11 and a cheap Android on 4G), big tap targets, no crypto words anywhere (no "wallet", "gas", "ENS", "transaction"; say "your home's name", "access", "link"). Hindi and English labels where it's cheap.

Paste one prompt at a time.

---

### Prompt 1: courier link format (start now)

```
Read AGENTS.md, docs/team/frontend.md, docs/adr/0006-courier-link-format.md and docs/adr/0004-grant-identity-from-the-session-key.md.
Ticket: P0-10 (link part). Use the tdd skill.
1. Write docs/plans/P0-10-link.md and commit it ("P0-10: link plan").
2. In src/lib/link/index.ts implement toBase64Url, fromBase64Url, formatCourierLink and parseCourierFragment exactly as the file header says: https://<origin>/c#1~<household name>~<payload key>~<session key>, keys as base64url without padding, payload key is 32 bytes (0x-hex in memory), session key is 32 bytes.
3. Turn every it.todo in src/lib/link/link.test.ts into a real test first, watch it fail, then implement. Add tests for: a household name with a hyphen, a 31-byte key (rejected), extra "~" fields (rejected), version "2" (rejected).
4. Pure TypeScript only: no browser globals, so tests run in Node.
Done when npm run check passes. Commit in small steps ("P0-10: base64url", "P0-10: format and parse courier links"), pull --rebase, push.
```

### Prompt 2: app shell and the map

```
Read AGENTS.md, docs/team/frontend.md, docs/research/maps.md and docs/research/nextjs-pwa.md (sections "client-only code" and "static build").
Ticket: P0-7 (map part). Write docs/plans/P0-7-map.md first and commit it.
1. Layout: a simple phone-first shell in src/app/layout.tsx (header with "Pata", main area). Tailwind is installed. No external fonts or analytics: nothing may load from a third-party host except the map tiles and glyphs named in maps.md.
2. src/components/MapView.tsx: keep it a 'use client' wrapper that does dynamic(() => import("./MapViewInner"), { ssr: false }). Write MapViewInner.tsx with maplibre-gl 6.16 + pmtiles 4.5 + @protomaps/basemaps 5.7.2 as maps.md describes (pmtiles protocol, setWorkerUrl, style from @protomaps/basemaps, maxBounds = DEMO_BBOX, attribution from src/lib/map/config.ts). Support the MapViewProps in the file: pins with labels, draggable pins that call onPinMoved, and fitting to bbox.
3. Map data: build the extract with the pmtiles CLI (maps.md "Extract command", demo bbox in src/lib/map/config.ts) into public/maps/mumbai-demo.pmtiles. If the file is over 25 MB, lower --maxzoom to 14. If the CLI fails, use OpenFreeMap's style from maps.md for now and note it in the plan.
4. A /map-test page is NOT allowed in the final build; test the map inside /setup instead.
Done when npm run build passes, the map shows Dharavi on localhost, and dragging a pin logs its new LatLon. Commit, push.
```

### Prompt 3: set up a household (screens)

```
Read AGENTS.md, docs/team/frontend.md, docs/plan.md ("Set up a household"), docs/tickets.md (P0-7, P0-8, P0-9) and src/lib/flows/setup-household.ts.
Ticket: P0-7/P0-8 screens. Write docs/plans/P0-8-screens.md first and commit it.
Build src/app/setup/page.tsx as a step-by-step flow following the comment at the top of that file:
1. Sign in → flows.signIn().
2. "How do people find your door?": src/components/Recorder.tsx (MediaRecorder, max 30 s, shows a timer) OR a textarea; language picker hi/mr/en; a SEPARATE input "Room or flat number" with the note "Stays on this phone". → flows.describeTheWay(keys, blobOrText, language). If locality is null, ask for the area and PIN code.
3. → flows.findCandidatePins(...). src/components/PinPicker.tsx shows up to 3 candidates on MapView with landmark name, relation and confidence (low/medium/high as words, not numbers). Empty → "Drop a pin on your door" on the locality's bbox. The household can drag any pin.
4. Confirm → show the DIGIPIN with formatDigipin from src/lib/digipin.
5. → flows.makeDirections(...): show the three directions texts with play buttons (AudioPlayer).
6. Name: suggestHouseholdLabel() as a default, an input for her own with the rule from isValidHouseholdLabel (ADR 0006) and a warning that names are public; check availability with householdLabelStatus.
7. → flows.createHousehold(...) with a progress list ("Reserving your name…", "Saving your home, locked…"). Then go to /.
Use src/lib/flows/fake.ts until the real flows land. Every async step needs a loading state and a retry button; errors show a plain sentence, never a raw error message (it may contain request bodies).
Done when the whole flow runs end to end on fake data on localhost and on a phone. Commit per step, push.
```

### Prompt 4: consent screen

```
Read AGENTS.md, docs/team/frontend.md, docs/plan.md ("Approve a grant"), docs/adr/0006-courier-link-format.md and src/lib/flows/approve-grant.ts.
Ticket: P0-10 screens. Write docs/plans/P0-10-screens.md first and commit it.
1. src/app/approve/page.tsx reads a GrantRequest from location.hash as base64url JSON (validate every field; reject anything malformed). Show requester, purpose, the courier's language, the duration in words, and this sentence prominently: "Anyone with this link can find your door until it ends."
2. Approve → flows.approveGrant(keys, household, request). Then show the courier link with a Share button (navigator.share, falling back to copy) and a QR code (src/components/QrCode.tsx using the qrcode package, drawn locally).
3. Add a small "Make a test request" form on the page (requester name, purpose, language, duration with a 20-second option for the stage) that builds the same #fragment. This is NOT hard-coded data: the household types it.
Done when a fake approval shows a link and a scannable QR. Commit, push.
```

### Prompt 5: courier view

```
Read AGENTS.md, docs/team/frontend.md, docs/plan.md ("Open a courier link"), docs/adr/0002-grant-liveness-from-the-registry.md, docs/adr/0006-courier-link-format.md and src/lib/flows/courier.ts.
Ticket: P0-11 (screen). Write docs/plans/P0-11-screen.md first and commit it.
Build src/app/c/page.tsx following its header comment exactly:
1. In useEffect: read location.hash; if present save it to sessionStorage and call history.replaceState(null, "", location.pathname) to remove it; else read it back from sessionStorage.
2. Show the locality as soon as checkCourierLink returns it.
3. Poll checkCourierLink every 3 seconds. live → MapView with the pin, the DIGIPIN, room number, written address, directions text and AudioPlayer (mp3Base64, fallback speechSynthesis in the payload's language). ended → clear sessionStorage, show only the locality and "This link has ended". invalid → "This link doesn't work".
4. It must stay usable on a slow 4G phone: text first, map after.
5. Playwright (e2e/courier.spec.ts): replace the fixme tests that can run with the fake flow; keep the CROPS network test for the owner.
Done when the fake live → ended transition works on a phone. Commit, push.
```

### Prompt 6: home and stranger lookup

```
Read AGENTS.md, docs/team/frontend.md, src/lib/ens/lookup.ts and src/lib/keys/store.ts.
Ticket: P0-13. Write docs/plans/P0-13.md first and commit it.
1. src/app/page.tsx: signed out → "Set up your home" button. Signed in (loadHouseholdState) → the household name, its locality, and buttons for "Who can find my door" and "History". Remove the dev list of screens.
2. src/app/lookup/page.tsx: an input for a name. A household name → lookupLocality → shows only "Dharavi, 400017" and the sentence "Only people you give a link to can see the door." A 10-character grid name (or a DIGIPIN) → resolveGridName → a pin on the map (P1-1; show "coming soon" until it's real).
Done when both work against the real flows. Commit, push.
```

### P1 prompts (only after every P0 ticket is done)

```
P1-2 screens. Read AGENTS.md and docs/team/frontend.md. Write docs/plans/P1-2-screens.md first.
src/app/access/page.tsx: listLiveGrants every 5 s, a row per grant with requester, purpose and a live countdown to grantEnd, and "Stop access" → revokeGrant with a confirm step. Rows vanish by themselves when a grant ends. src/app/history/page.tsx: listHistory, newest first, "Shared with … for …" and "Stopped …" rows. Commit, push.
```

```
P1-5 mock seller screen. Read AGENTS.md, docs/team/frontend.md and docs/research/ens-v2.md §8.
src/app/seller/page.tsx: a WhatsApp-style chat bubble "Confirm your address for order #…" with a button that builds a GrantRequest and opens /approve#<base64url JSON>. Label the page "Demo seller (mock)". Blockchain adds the seller's ENS name and agent-context; show agent-context on the consent screen when the request carries ensName.
```

```
P1-6 "We're not sure". Read AGENTS.md. In the PinPicker, when pinsDisagree(top two, NOT_SURE_SPREAD_METRES) or RankResponse.duplicateLandmarkName, show "We're not sure which place you mean" and ask her to pick one or drop the pin by hand.
```

### Hours 28–34 prompts

```
PWA and offline kit. Read AGENTS.md and docs/research/nextjs-pwa.md (Serwist, CSP, manifest).
1. Icons: app/icon.png, app/apple-icon.png, 192 and 512 PNGs in the manifest.
2. src/sw.ts with serwist runtime classes; a postbuild step with @serwist/cli injectManifest writing out/sw.js; register it from a client component. Precache the app shell, the map extract and fonts. Chain, Arkiv, AI and speech calls are network-only, never cached.
3. A meta CSP in the root layout with a connect-src allowlist (Worker URL, RPC hosts, tile/glyph hosts) plus 'wasm-unsafe-eval' for Nox. Verify the map, the harness and hydration still work.
4. With Wi-Fi off, the app shell and an already-opened courier page reload.
```
