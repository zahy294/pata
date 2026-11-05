# P0-7: map failure fallback

**Goal:** tolerate the reported slow primary Overpass service and preserve the hand-dropped-pin path on map failure.

**Files:** `server/src/geo/overpass.ts`, its tests, and the map-search plan/checklist. No Worker config, deployment, Solidity or other owners' implementation changes.

**Tests first:** existing `featuresInBox` seam: query timeout 60 seconds and fetch timeout 90 seconds; the ten requested highway values only; failures return empty features/streets without caching failures; invalid input still rejects before any request. Preserve retries/backoff and amenity coverage.

**Research read:** Nominatim/Overpass research, AI/ML role, glossary and TDD skill. Owner reports primary small Dharavi query ~29 seconds, status 502, alternate services timeout/504; these are reported observations, not a new deployed test.

**Risks:** no Worker deployed until owner reviews P0-6; no shared Cloudflare access. Live smoke is **pending deployed Worker**. Owner will post `NEXT_PUBLIC_SERVER_URL` and pre-warm Dharavi/BKC. The 90-second network allowance does not prove the free Worker's CPU budget; verify parsing/geometry in that deployment. Preserve endpoint override support and the existing atomic-coordination hand-off.

**Result:** pending implementation. No deployment attempted.
