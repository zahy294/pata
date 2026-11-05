# Maps: MapLibre and offline OpenStreetMap tiles

Checked: 2026-11-03 · Version: `maplibre-gl` 6.16.0 (`npm view maplibre-gl version`, published 2026-10-25), `pmtiles` 4.5.0, `@protomaps/basemaps` 5.7.2, `next` 16.4.4 (all from `npm view`, 2026-11-03) · Status: test at kick-off
Feeds: idea.md moment 1, "Speak once" (three candidate pins, confirm or drag); the courier view; the CROPS "P" line ("Map tiles for the demo areas ship with the app"); the Stack row "Offline demo kit" ("Cached map tiles for Dharavi and BKC"); scope ladder P0 items "3 pins → confirm → DIGIPIN" and "Courier view".

**Recommendation (inferred from the sources below):** use a Protomaps PMTiles extract of Dharavi and BKC, bundled in the static build and served from our own origin. Build the style with `@protomaps/basemaps` and self-host its glyphs and sprite. Don't use `tile.openstreetmap.org`: its policy forbids offline use. Use OpenFreeMap only as a live fallback for areas outside the extract. All of this is free, and none of it needs an API key.

## Install and setup

- `npm install maplibre-gl pmtiles @protomaps/basemaps`.
- **v6 is ESM-only.** The package has `"type": "module"`, and `exports` has only an `import` condition. The default import is gone, so use `import {Map, Marker, setWorkerUrl, addProtocol} from 'maplibre-gl'` ([v5→v6 migration guide](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/v5-to-v6-migration-guide.md), read 2026-11-03; verified by: package.json via `npm view`).
- v6.0.0 shipped on 2026-07-22 (`npm view maplibre-gl time`). Tutorials and model memory mostly show v5. For example, Protomaps' own React snippet still uses `import maplibregl from 'maplibre-gl'` ([Protomaps docs, PMTiles for MapLibre](https://docs.protomaps.com/pmtiles/maplibre)), and that import fails on v6.
- **Worker URL.** Next.js (Turbopack, or `--webpack`) needs this call in a `'use client'` file:
  `setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())`
  The docs say: "Next.js emits the worker as a hashed asset in both of its bundler modes … This needs Next.js 15 or later" ([MapLibre docs, ESM → Turbopack](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/index.md#esm), read 2026-11-03).
- **Template:** MapLibre's own Next.js test app ([test/integration/bundler/turbopack](https://github.com/maplibre/maplibre-gl-js/tree/main/test/integration/bundler/turbopack); verified by: source code). It uses:
  - Next `^16.4.1`, React 19, and `output: 'export'`, which produces a static site as for IPFS;
  - `app/map.tsx`, marked `'use client'`, which creates the `Map` in `useEffect` on a ref'd div and calls `map.remove()` on cleanup;
  - a server `page.tsx` that imports that file directly, with no `next/dynamic`.
- CSS: `import 'maplibre-gl/dist/maplibre-gl.css'`. Markers and popups break without it ([docs index](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/index.md)).
- **WebGL2 is required.** If it's missing, `new Map()` throws `GPUInitializationError` ([migration guide](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/v5-to-v6-migration-guide.md)). Catch the error and fall back to a "pins as a list" view (inferred).
- CSP, if we set one, with a self-hosted worker: `worker-src 'self'; img-src data: blob: 'self'` ([migration guide](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/v5-to-v6-migration-guide.md)).

## What Pata uses

### Moment 1: three candidate pins, confirm or drag

All option names below come from the 6.16.0 type definitions, `dist/maplibre-gl.d.ts` (verified by: package types).

- **Candidate markers:** `new Marker({color, anchor: 'bottom'}).setLngLat([lng, lat]).addTo(map)`, three times. To show the landmark name and confidence on each pin, pass a custom `element`.
- **Confirming and dragging:** call `setDraggable(true)` on the chosen marker, or create it with `draggable: true`. On `dragend`, a `MarkerDragEvent`, read `marker.getLngLat()`.
  - A draggable default marker is also keyboard-focusable: an arrow key moves it 1 px, or 10 px with Shift, and fires the same events.
- **Fitting all three pins in view:** build an `LngLatBounds` (`new LngLatBounds()` then `.extend(lngLat)`), then call `map.fitBounds(bounds, {padding, maxZoom: 17, linear: true})`. The `absolutePadding` option was added in 6.12.0 ([CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)).
- **Geolocation:** `new GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: false})`. It defaults to `{enableHighAccuracy: false, timeout: 6000}` and zooms to at most `maxZoom` 15. It fires `geolocate`, carrying `coords`, and `error`.
  - The position is read on the device from the browser's Geolocation API, and MapLibre itself sends it nowhere (inferred from the control's source, `src/ui/control/geolocate_control.ts`).
- **Distances:** the 50 m check and "60 m off" come from tested plain code (CLAUDE.md invariant). `LngLat#distanceTo` exists but shouldn't be the source of truth.
- **Keeping the map on the demo area:** use `maxBounds` and `minZoom`, plus `renderWorldCopies: false` (MapOptions in the types). This also keeps national boundaries off screen (see "Indian map rules").

### Courier view

- One fixed `Marker` at the decrypted pin, plus the attribution control.
- **Privacy:** every tile request names the tile being viewed. At z15 to z18 that is a cell of roughly 1.2 km down to 150 m around the door, sent with the courier's IP to whoever hosts the tiles (inferred from the slippy-map tile scheme). Tiles served from our own static build keep this inside the demo area. Outside the extract, a third-party tile host learns the approximate area, and the CROPS "P" line should say so.

### Tile sources and their rules

| Source | Cost and key | Offline or caching | Max zoom | Required attribution |
|---|---|---|---|---|
| OSM raster `tile.openstreetmap.org` | Free, no key | **Prohibited.** "Offline use is not permitted"; "Bulk download ('scrape') tiles or offer prefetch features" is a must-not, including "Building tile archives (e.g. `.zip`, `.mbtiles`)". You must send a valid User-Agent and a Referer, not set a restrictive Referrer-Policy, and cache at least 7 days ([OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/), read 2026-11-03) | 19 (raster) | "© OpenStreetMap contributors", linked to `/copyright`; "Do not hide attribution beneath UI, behind toggles, or off-screen" |
| OSM vector `vector.openstreetmap.org` (Shortbread schema) | Free, no key | **Prohibited:** "Bulk downloading is prohibited", including "creating a tile archive or downloading for offline usage" ([OSMF vector policy](https://operations.osmfoundation.org/policies/vector/)) | n/a | OSM licence attribution, bottom right |
| OpenFreeMap `tiles.openfreemap.org` | Free, no key, "no limits on the number of map views or requests", commercial use allowed | **Allowed:** "at most 3,000 tiles or 50 MB, made with at most 4 parallel requests, sent with a unique User-Agent" ([ToS, updated 2026-10-14](https://openfreemap.org/tos)). It may sit behind Cloudflare | 14 (TileJSON at `https://tiles.openfreemap.org/planet`) | "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; the TileJSON carries it, so MapLibre adds it automatically ([openfreemap.org](https://openfreemap.org/)) |
| Protomaps basemap (PMTiles) | Free download, no key | **Allowed:** the data is an ODbL Produced Work, and `pmtiles extract` cuts a region. "Hotlinking to these downloads are discouraged", so copy the file to your own storage ([Basemap Downloads](https://docs.protomaps.com/basemaps/downloads)) | 15 | `<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>` ([Basemaps for MapLibre](https://docs.protomaps.com/basemaps/maplibre)) |
| MapTiler Cloud Free | $0, API key, sign-up | **Not for an offline kit.** Responses may be stored only "in a temporary personal cache (browser cache, mobile app cache, etc.) for use by a single end-user only". The Free plan is "limited to non-commercial use and research & development" ([Cloud terms](https://www.maptiler.com/terms/cloud/)), and the MapTiler logo must show on the map ([pricing](https://www.maptiler.com/cloud/pricing/)) | n/a | MapTiler attribution "shown on screen while the map is displayed" |

### Offline demo kit: a PMTiles file in the build

1. **Extract.** Get the build URL from [maps.protomaps.com/builds](https://maps.protomaps.com/builds); daily builds are kept for a week. Then run:
   `pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles mumbai-demo.pmtiles --bbox=72.835,19.025,72.885,19.075 --maxzoom=15`
   - The flags are documented in the [pmtiles CLI docs](https://docs.protomaps.com/pmtiles/cli). "Extracting a full sub-pyramid from 0 to `maxzoom` is always an efficient operation."
   - The CLI is the `go-pmtiles` binary from GitHub releases. Don't run it before kick-off.
   - The bounding box is inferred: about 5.3 × 5.6 km around Dharavi and BKC, including the Jio World Centre. Check it against the map at kick-off.
2. **Tile count for that box at z0–15: 68 tiles** (z0–11 one each, z12 4, z13 4, z14 12, z15 36). Computed with the standard slippy-map formula (verified by: own script).
   - **Expected size: about 1–5 MB (inferred).** Protomaps gives only the planet size, about 120 GB for z0–15, and says "Each additional zoom level roughly doubles the size of the file" ([downloads](https://docs.protomaps.com/basemaps/downloads)). Measure the real size at kick-off.
   - MapLibre overzooms past z15, so street level at z17–18 still renders.
3. **Protocol.** Call `addProtocol('pmtiles', new Protocol().tile)` once at app start, not per map ([Protomaps React note](https://docs.protomaps.com/pmtiles/maplibre)). Use the named import from `maplibre-gl`, not the default import in that note. The source is `{type: 'vector', url: 'pmtiles://<url>', attribution: '…'}`.
   - Set `attribution` on the source yourself: the protocol's TileJSON has none unless `new Protocol({metadata: true})` is used ([pmtiles 4.5.0 `src/adapters.ts`](https://github.com/protomaps/PMTiles/blob/main/js/src/adapters.ts); verified by: source code).
4. **Serving.** By default PMTiles reads the file with HTTP range requests (`FetchSource`).
   - The IPFS path-gateway spec says "Gateways SHOULD support single range requests" ([IPFS path gateway spec, §Range](https://specs.ipfs.tech/http-gateways/path-gateway/)). SHOULD is not MUST, so test the chosen gateway (hosting.md decides which one).
   - **Way around range requests:** fetch the whole small file once, wrap it as a `File`, and call `protocol.add(new PMTiles(new FileSource(file)))`. The style then points at `pmtiles://<file.name>`, because `FileSource.getKey()` returns `file.name` and slices the `File` locally ([pmtiles 4.5.0 types and source](https://github.com/protomaps/PMTiles/tree/main/js/src); verified by: source code). The same `File` can sit in IndexedDB or the Cache API for offline use (inferred).
5. **Style.** `layers('protomaps', namedFlavor('light'), {lang: 'en'})` from `@protomaps/basemaps` ([Basemaps for MapLibre](https://docs.protomaps.com/basemaps/maplibre)). The style uses the fontstacks `Noto Sans Regular`, `Noto Sans Medium`, `Noto Sans Italic` and `Noto Sans Devanagari Regular v1` (verified by: grep of the 5.7.2 dist).
6. **Glyphs and sprite offline.** Self-host from [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets). Sizes, from the GitHub tree API on 2026-11-03:
   - **Full fontstacks:** Regular 6.1 MB, Medium 3.5 MB, Italic 1.2 MB, Devanagari v1 0.4 MB, each 256 `.pbf` range files.
   - **Latin-only labels** need only `0-255`, `256-511` and `8192-8447`, about 270 KB per stack.
   - **The `sprites/v4/light` sprite** (`.json`, `.png`, `@2x`) is about 52 KB.
   - Protomaps notes that "The URLs for glyphs and sprites must be absolute" ([Security and Privacy](https://docs.protomaps.com/guide/security-privacy)). On an IPFS path gateway, build them from `location` at runtime by string concatenation. `new URL()` would percent-encode the `{fontstack}` and `{range}` braces (inferred from the WHATWG URL path encode set).

### Service-worker tile cache vs a bundled PMTiles file (inferred)

| | Service worker caching ZXY tiles | One bundled PMTiles file |
|---|---|---|
| Legal with which source | OpenFreeMap within its limits, or self-hosted only. Pre-caching from OSM's servers is forbidden | Protomaps extract: yes |
| Works offline on first open | Only for tiles fetched earlier or pre-cached | Yes, once the file and app shell are cached |
| Moving parts | Cache rules plus a prefetch list of tile URLs | One file, plus `FileSource` or range requests |
| Gotcha | Cache API `put()` rejects 206 Partial Content responses (Fetch/Service Worker spec; not re-read today), so range-served PMTiles can't simply be cached by URL | Areas outside the box show blank tiles unless a live fallback source is added |
| CROPS | The tile host still sees the first view | Nobody sees the demo area being viewed |

### Hindi and Marathi labels

- MapLibre 6.7.0 added the style spec's `font-faces` and better Devanagari shaping, 6.9.0 improved it further, and 6.15.0 fixed Devanagari labels "mixing fonts or dropping letters when the style has a glyphs URL" ([CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)).
- Protomaps' own docs predate this. They list Devanagari as "partial support" through `pgf:name:hi` fields and the "Noto Sans Devanagari Regular v1" fontstack ([Basemap Localization](https://docs.protomaps.com/basemaps/localization)).
- **For P0, use `lang: 'en'`** (inferred). The directions are spoken, so the map's labels can stay English.

## Limits

- **Bundle size** (6.16.0, measured from the npm tarball):
  - `maplibre-gl.mjs`: 1.11 MB, 295 KB gzip;
  - `maplibre-gl-worker.mjs`: 519 KB, 147 KB gzip;
  - CSS: 72 KB, 10 KB gzip.
- **Demo extract:** 68 tiles, about 1–5 MB (inferred). Fonts add 0.8–11 MB depending on how many ranges we ship.
- **OpenFreeMap offline cap:** 3,000 tiles or 50 MB per download, so the 68-tile box fits easily. Its maximum zoom is 14.
- **Mobile:** WebGL2 only. Recent fixes for iOS and Safari backgrounding landed in 6.15.0 and 6.16.0 ([CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)), so pin the latest 6.x. Set `maxBounds` and `maxZoom` around 19 to bound tile work (inferred). Real-device performance is untested.

## Attribution on screen

- The OSMF guidelines allow any corner of the map. The attribution may collapse "automatically on map interaction such as panning, clicking, or zooming" or "after five seconds". Once collapsed, "the user must still be able to find the licence information … from an '(i)' button" ([Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), read 2026-11-03).
- MapLibre's default matches this. On maps 640 px wide or less, the control starts expanded (`maplibregl-compact maplibregl-compact-show`) and collapses to the (i) button on the first `drag` (`src/ui/control/attribution_control.ts`, 6.16.0; verified by: source code).
  - Keep the default `attributionControl`.
  - Put the Protomaps and OSM string in the source's `attribution`.
  - The MapLibre logo is optional ("Showing the logo of MapLibre is not required", MapOptions docs).
- Recommended by the OSM policies: a "Report a map issue" link to `https://www.openstreetmap.org/fixthemap`.

## Indian map rules

- India's 2021 geospatial guidelines (DST, 15 Feb 2021) give Indian entities freedom to "acquire, collect, generate, prepare, disseminate … Maps, of any spatial accuracy" within India, subject to a negative list of attributes ([Survey of India, Guidelines](https://onlinemaps.surveyofindia.gov.in/GeospatialGuidelines.aspx); [PIB 1814067](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1814067)).
- The rule that touches a basemap: "For political Maps of India of any scale including national, state and other boundaries, SoI published maps or SoI digital boundary data are the standard to be used" (same page, item xiii).
- OSM-derived tiles at world zoom show OSM's boundaries, not Survey of India's. For a street-level demo, clamp with `maxBounds` and a `minZoom` of about 11, so no national boundary is ever drawn (inferred). We found no rule that bars a street-level Mumbai map; this is not legal advice.

## Gotchas

- **ESM-only:** `require('maplibre-gl')` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Keep MapLibre out of unit-tested modules ([migration guide](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/v5-to-v6-migration-guide.md)).
- **Unpinned CDN URLs:** "a page pinned to `@latest` goes to a blank gray screen with a 404" (same guide). Bundle from npm instead.
- **`zoomLevelsToOverscale`** now defaults to 4, which changes label placement past the source's max zoom (same guide).
- **Attribution:** the PMTiles protocol adds none unless the source sets it.
- **Protocol registration:** call `addProtocol` once globally. Under React Strict Mode, `useEffect` runs twice in development (inferred).
- **OSM's tile servers** need a Referer: "Do not set a restrictive Referrer-Policy". Relevant only if we ever use them live. They are not offline-safe ([tile policy](https://operations.osmfoundation.org/policies/tiles/)).

## Values to copy

| Name | Value | Source |
|---|---|---|
| maplibre-gl | `6.16.0` | `npm view`, 2026-11-03 |
| pmtiles (JS) | `4.5.0` | `npm view`, 2026-11-03 |
| @protomaps/basemaps | `5.7.2` | `npm view`, 2026-11-03 |
| Worker setup | `setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString())` | [MapLibre docs, ESM](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/index.md#esm) |
| Demo bounding box (inferred) | `72.835,19.025,72.885,19.075` | own estimate; check at kick-off |
| Extract command | `pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles mumbai-demo.pmtiles --bbox=72.835,19.025,72.885,19.075 --maxzoom=15` | [pmtiles CLI](https://docs.protomaps.com/pmtiles/cli) |
| Protomaps attribution | `<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>` | [Basemaps for MapLibre](https://docs.protomaps.com/basemaps/maplibre) |
| Glyphs (hosted; self-host offline) | `https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf` | same |
| Sprite (hosted; self-host offline) | `https://protomaps.github.io/basemaps-assets/sprites/v4/light` | same |
| OpenFreeMap fallback style | `https://tiles.openfreemap.org/styles/liberty` | [Quick start](https://openfreemap.org/quick_start/) |
| OpenFreeMap attribution | `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` | [openfreemap.org](https://openfreemap.org/) |
| CSP (self-hosted worker) | `worker-src 'self'; img-src data: blob: 'self'` | [migration guide](https://github.com/maplibre/maplibre-gl-js/blob/main/docs/guides/v5-to-v6-migration-guide.md) |

## Contradictions with idea.md

1. idea.md's Stack row says "Offline demo kit: Cached map tiles for Dharavi and BKC", and the App row says "an OpenStreetMap map (MapLibre)". If that means caching tiles from OpenStreetMap's own servers, it's forbidden: "Offline use is not permitted on `tile.openstreetmap.org`", and building tile archives counts as bulk downloading ([OSMF tile policy §4](https://operations.osmfoundation.org/policies/tiles/)). The vector service forbids it too ([vector policy](https://operations.osmfoundation.org/policies/vector/)). The kit must use OpenStreetMap *data* from Protomaps or OpenFreeMap, not OSM's tile servers.
2. The CROPS "P" line says "Map tiles for the demo areas ship with the app." That is accurate only inside the extract. Outside it, a live tile host sees which tiles the courier or household views, roughly the door's area at z15–18 (inferred). The line should either say so or the map should stay clamped to bundled areas.
3. Not idea.md, but worth knowing: Protomaps' MapLibre docs use the v5 default import and `setRTLTextPlugin`. Both are wrong for maplibre-gl v6 ([CHANGELOG 6.0.0, 6.9.0](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)).

## Test at kick-off

- [ ] `next build` with `output: 'export'` emits `maplibre-gl-worker.mjs` as a hashed asset, and the map renders from the static build.
- [ ] Run `pmtiles extract` with the bbox above and record the real file size and tile count. Open the file at pmtiles.io and check that Dharavi and BKC are covered.
- [ ] Our chosen IPFS gateway answers `Range: bytes=0-16383` on the `.pmtiles` file with a 206. If it doesn't, use the whole-file `FileSource` route.
- [ ] Wi-Fi off, after one online load: the map, glyphs and sprite all render from the cache, with no failed requests in DevTools.
- [ ] The demo phones create a WebGL2 context, with no `GPUInitializationError`.
- [ ] On a phone, dragging a marker fires `dragend` with the new `LngLat`, and the page doesn't scroll instead.
- [ ] `GeolocateControl` works on the IPFS HTTPS origin, which is a secure context.
- [ ] The attribution is visible on first load on a 360 px wide screen and collapses on drag.
- [ ] If Hindi labels are wanted (P2): `lang: 'hi'` renders Devanagari correctly on v6.16 with the self-hosted fontstack.
- [ ] Service-worker route only: confirm that `cache.put` rejects 206 responses, since this wasn't re-read from the spec today.
