# P0-7: App shell and the map (map part)

**Goal:** Build the phone-first app shell in `src/app/layout.tsx`, the client-only `MapView.tsx` and `MapViewInner.tsx` (MapLibre 6.16 + PMTiles + bounds + draggable pins), verified inside `/setup` with a passing static export (`npm run build`).

**Files:**
- `docs/plans/P0-7-map.md` (this plan)
- `src/app/layout.tsx` (phone-first layout, header, no third-party scripts)
- `src/components/MapView.tsx` (client wrapper with dynamic `ssr: false`)
- `src/components/MapViewInner.tsx` (MapLibre map, markers, PMTiles protocol, OpenFreeMap fallback style)
- `src/app/setup/page.tsx` (test map rendering with draggable pin in Dharavi)

**Tests first:**
- Static export build test (`npm run build` writing to `out/` with zero SSR errors).
- Verification gate (`npm run check`: typecheck app + server, Vitest, Foundry Osaka test).
- Manual verification on localhost `/setup`: map displays Dharavi area within `DEMO_BBOX`, marker dragging logs new `LatLon` coordinates.

**Research read:**
- `AGENTS.md`
- `docs/team/frontend.md`
- `docs/research/maps.md`
- `docs/research/nextjs-pwa.md` (sections "client-only code" and "static build")
- `src/lib/map/config.ts`

**Risks:**
- MapLibre v6 is ESM-only and requires `window` at runtime: keep all map instantiation strictly inside `MapViewInner.tsx` loaded via `next/dynamic(..., { ssr: false })` from `'use client'` components.
- Map worker bundling under Turbopack: pass explicit `setWorkerUrl` pointing to `maplibre-gl-worker.mjs` asset.
- PMTiles extract: if `pmtiles` CLI binary is unavailable locally, use OpenFreeMap's liberty style (`https://tiles.openfreemap.org/styles/liberty`) as authorized by `maps.md` and Prompt 2.
- WebGL2 missing: catch `GPUInitializationError` gracefully if environment lacks WebGL2 support.

**Result:** Complete on `frontend`.
- Built phone-first container in `src/app/layout.tsx` with header branding and zero third-party fonts/trackers.
- Built `src/components/MapView.tsx` as a dynamic SSR-safe wrapper (`ssr: false`) and `src/components/MapViewInner.tsx` using `maplibre-gl` 6.16, `pmtiles` 4.5, `setWorkerUrl` pointing to worker asset, bounds clamped to `DEMO_BBOX`, OpenFreeMap fallback style, attribution, and draggable markers with `onPinMoved`.
- Wired interactive map test into `src/app/setup/page.tsx` with a draggable pin logging `LatLon`.
- `npm run check` passes (typecheck app + server, 241 unit tests, and Foundry Osaka test).
- `npm run build` succeeds cleanly with Next.js Turbopack static export to `out/` across all 11 static routes.
