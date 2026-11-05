# P0-7: map search

**Goal:** resolve a locality boundary with Nominatim, then fetch cached named OSM features and street geometry with one Overpass query; verify real Dharavi results.

**Files:** `server/src/geo/{nominatim,overpass}.ts`, their tests and small geo-owned request/cache helpers as needed; this plan and the AI/ML checklist. Preserve other owners' files and the untracked `.commandcode/` folder.

**Tests first:** existing public seams `localityBBox` and `featuresInBox`, with mocked external fetch, fake time and a minimal in-memory KV boundary.

- Nominatim converts string `[south,north,west,east]` to numeric `[west,south,east,north]`, checks locality rather than accepting a postcode point, and returns null for no match.
- Normalize locality cache keys, cache results for 30 days, suppress duplicate requests and pace cache misses at one per second using a serialized queue plus the KV timestamp.
- Overpass sends one bounded, resource-limited query for named feature categories and highway geometry. Parse nodes/ways/relations, representative centres and `[lon,lat]` streets; ignore malformed or out-of-box feature candidates.
- Cache by box, not spoken landmark phrases. Verify the transcript/room number never reaches URLs, headers, bodies or KV.
- Retry throttling/resource failures only after at least 30 seconds (or a longer Retry-After), with one fallback endpoint; never cache failed or incomplete replies.
- Reject invalid inputs and malformed service replies with plain errors. Endpoints are optional injected configuration, preserving existing callers and avoiding unauthorized Worker env/config edits.

**Research read:** `docs/research/nominatim-overpass.md` in full, `GLOSSARY.md`, P0-7 in `docs/tickets.md`, the AI/ML role, and the TDD skill. Public-service restrictions: identifying Pata User-Agent, Nominatim 1 request/second app-wide, no autocomplete/bulk/personal data, cached answers and OSM/ODbL attribution.

**Risks:**

- A KV timestamp is not an atomic global lock: Cloudflare KV is eventually consistent. The adapters can serialize and pace requests in one isolate and consult a persisted timestamp, but cannot guarantee the app-wide limit across concurrent isolates. Owner request: route public geo requests through a single atomic coordinator (e.g. Durable Object) before distributed deployment; do not alter owner bindings/router here.
- Owner request: wire replaceable endpoint config and visible OSM attribution when integrating; the adapters accept optional endpoint URLs without reading new env names.
- Upstream services can be unavailable or block cloud IPs. Record the real smoke result honestly; do not commit downloaded OSM extracts under MIT or fake a successful live result.
- Locality searches must not silently use the much wider postcode bounding box. A postcode-only or invalid reply is rejected.
- Only public locality/map answers are cached, never the way to the door, room number or household pin. Commits remain local on `feat/ai-ml` for the user to push.

**Result:** adapters implemented; live Overpass verification and deployment coordination remain open.

- `localityBBox` supports normalized 30-day positive/negative caching, configurable endpoints, settlement-only queries, postcode safeguards, validated numeric bounds and plain errors. `featuresInBox` issues one bounded Overpass query for the requested feature categories and street geometry, rejects partial replies, filters invalid/out-of-box candidates, deduplicates ids and caches by box independently of landmark phrases.
- Queueing covers full response consumption in this isolate. Persisted pacing and cooldown keys avoid rapid writes to a single KV key. Overpass HTTP 406/429/504 receives at least 30 seconds of backoff, honours longer Retry-After values and retries one fallback only. Runtime errors expose neither upstream response bodies nor network error details.
- 26 map-search cases pass, using mocked fetch, fake time and an in-memory KV boundary. `npm run check` passes: both TypeScript projects, 145 unit tests (17 unrelated todos), and one Foundry test.
- Real smoke on 2026-11-06 IST: Nominatim returned HTTP 200 and Dharavi's expected box `[72.8484246,19.0368844,72.8651342,19.0542277]` in about 0.4–0.6 seconds. The Overpass adapter failed; a primary status probe returned HTTP 406, the primary GET query timed out after 35 seconds, and the documented private.coffee backup status probe timed out after 12 seconds (the adapter request also timed out). No live feature count is claimed; retry the smoke from the deployed Worker before marking this part done. Temporary smoke code was removed; no real OSM extract was committed.
- Owner hand-off before distributed public-service deployment: provide atomic global coordination and wire endpoint configuration; frontend must display OSM/ODbL attribution. [Cloudflare documents KV's eventual consistency and recommends Durable Objects for atomic operations](https://developers.cloudflare.com/kv/concepts/how-kv-works/). The [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) applies the request limit across all app users. The requested KV timestamp alone cannot guarantee that limit across isolates.
- No shared types, Worker owner files, UI files or dependencies changed. `.commandcode/` left untouched. Commits remain local on `feat/ai-ml`; the user pushes. AI ranking can now be built/tested against these adapters, but P0-7 map search is not fully verified until the live Overpass check succeeds.
