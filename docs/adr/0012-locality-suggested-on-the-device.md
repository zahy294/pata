# The area and PIN code are suggested on the device from a bundled Mumbai table

## Context

With a location fix (ADR 0011), the household still typed the area and PIN code. Filling them in needs reverse geocoding, and sending the fix to a map service would expose a position within metres of the door. OpenStreetMap has about 13,900 features tagged with a postcode in Mumbai, and 195 `place=suburb` nodes.

## Decision

`scripts/build-locality-table.mjs` turns two Overpass extracts into `src/lib/locality/mumbai.json` (84 KB, 22 KB gzipped). The table has each suburb's name and position, and one point per PIN code per ~110 m cell, Mumbai-area codes only. After a fix, `suggestLocality` loads the table on the device and fills the empty fields:

- **Area:** the nearest suburb within 4 km. Suburbs, not neighbourhoods, because the area becomes public.
- **PIN code:** a distance-weighted vote of the 5 nearest postcode features within 1.5 km. That was right for 86% of the table's own cells, tested leave-one-out.

Fields the household already typed are left alone, and the screen asks them to check what was filled.

## Consequences

- The fix never leaves the phone for this, and setup makes no extra request.
- Only Mumbai is covered. Elsewhere the fields stay empty, as before.
- About one suggestion in seven may be the neighbouring PIN code, so the household has to check it.
- The table is OpenStreetMap data under ODbL 1.0; its `source` field carries the attribution. Rebuild it with the script to refresh it.
