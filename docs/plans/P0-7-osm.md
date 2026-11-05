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

**Result:** pending.
