# P0-7: plain geometry

**Goal:** provide tested distance, bearing, offset and street-segment snapping for candidate pins, plus the existing pin-spread helper.

**Files:** `shared/geo.ts`, `shared/geo.test.ts`, this plan, and the AI/ML completion checklist. The shared geometry changes are explicitly authorized by AI/ML Prompt 2; keep exported signatures unchanged.

**Tests first:** use the existing public function seams agreed by the ticket, without mocks.

- `distanceMetres`: identity, independently specified degree/25 m examples, symmetry and antipodal stability; catches distance errors, not ellipsoidal GPS accuracy.
- `bearingDegrees`: cardinal directions and normalization; catches angle/sign mistakes, not routing or compass calibration.
- `offsetPoint`: known cardinal destinations and distance/bearing round-trips; catches unit and spherical-offset errors, not road-following directions.
- `nearestPointOnLine`: interior of a segment, endpoints, multiple segments, duplicate vertices, one vertex and empty input; catches lon/lat swaps and vertex-only snapping, not global geodesic routing.
- `pinsDisagree`: false at the threshold and true above it; catches the strict comparison used by P1-6, not landmark-name ambiguity.
- Reject non-finite/out-of-range coordinates and invalid numeric parameters before they produce unusable pins.

**Research read:** AI/ML Prompt 2 specifies haversine radius 6,371,008.8 m and a local equirectangular projection about the input pin. Also read `GLOSSARY.md`, P0-7 in `docs/tickets.md`, map-distance guidance in `docs/research/maps.md`, coordinate-order guidance in `docs/research/nominatim-overpass.md`, and the TDD skill.

**Risks:** projection is for street-scale segments around the pin, not long-distance navigation. Coordinates use WGS84 degrees; polylines use `[lon, lat]`. Empty lines have no nearest point and throw; one vertex/zero-length segments are treated as points. Keep all calculation local and deterministic, with no new dependencies or other owners' code changes. User will push commits manually on `feat/ai-ml`.

**Result:** complete (geometry part only; P0-7 map search, AI and speech remain separate).

- Implemented all four stubbed public functions and retained the existing `pinsDisagree` signature. Distances use the specified 6,371,008.8 m sphere; bearings are normalized; offsets wrap longitude and preserve zero-offset pins exactly.
- Street snapping uses the local equirectangular projection about the query pin and clamps onto each segment. It handles endpoints, multiple segments, duplicate vertices and single vertices. Empty lines, invalid coordinates and invalid numeric parameters throw `RangeError`.
- Replaced every geometry todo with 39 passing cases, including fixed distance/destination examples, 25 m bearing round-trips, an oblique street that tests longitude scaling, segment-interior snapping and strict threshold comparisons.
- `npm run check` passes: app + Worker typecheck, 119 unit tests (17 unrelated scaffold todos), and one Foundry test. Changes stay within authorized shared geometry, its tests, this plan and the AI/ML checklist. No dependencies added, no network calls or private data used.
- Limits: spherical distances approximate Earth; snapping is intended for local street geometry, not long-distance or antimeridian-crossing lines. Unblocks: deterministic candidate placement and the P1-6 spread check. No Arkiv friction. Commits stay local on `feat/ai-ml` for the user to push.
