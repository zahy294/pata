// Map config. Owner: frontend (P0-7). Read docs/research/maps.md first.
// The map uses MapLibre with a bundled Protomaps PMTiles extract of Dharavi and BKC in public/maps/,
// clamped to the demo box. OSM's own tile servers forbid offline use, so never point at tile.openstreetmap.org.

/** [west, south, east, north], from maps.md (check at kick-off). */
export const DEMO_BBOX: [number, number, number, number] = [72.835, 19.025, 72.885, 19.075];

/** Served from public/maps/. Built by the owner with the pmtiles CLI (maps.md, "Extract command"). */
export const PMTILES_URL = "/maps/mumbai-demo.pmtiles";

export const ATTRIBUTION =
  '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://openstreetmap.org">OpenStreetMap</a>';
