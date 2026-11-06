// Builds src/lib/locality/mumbai.json: the on-device table that turns a location fix into a suggested
// area and PIN code (ADR 0012), so the position never leaves the phone. Data © OpenStreetMap
// contributors, ODbL 1.0. Reads no secrets.
//
// Usage: node scripts/build-locality-table.mjs <postcodes.csv> <places.csv>
// Each CSV comes from one Overpass query over Mumbai (bbox 18.85,72.74,19.45,73.20), for example via
// curl --data-urlencode "data=<query>" https://overpass-api.de/api/interpreter:
//   postcodes.csv: [out:csv(::lat,::lon,"addr:postcode";false;"|")];nwr["addr:postcode"](18.85,72.74,19.45,73.20);out center;
//   places.csv:    [out:csv(::lat,::lon,place,name,"name:en";false;"|")];node["place"~"^(suburb|neighbourhood|quarter)$"](18.85,72.74,19.45,73.20);out;
import { readFileSync, writeFileSync } from "node:fs";

const [postcodesCsv, placesCsv] = process.argv.slice(2);
if (!postcodesCsv || !placesCsv) {
  console.error("Usage: node scripts/build-locality-table.mjs <postcodes.csv> <places.csv>");
  process.exit(1);
}
const rows = (file) =>
  readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => line.split("|"));

// One point per PIN code per ~110 m cell (lat and lon rounded to 3 decimals, stored as integers × 1000).
const pins = {};
const seen = new Set();
for (const [lat, lon, raw] of rows(postcodesCsv)) {
  const pin = (raw ?? "").replace(/\s/g, "");
  if (!/^4(00|01|10|21)\d{3}$/.test(pin)) continue; // Mumbai-area PIN codes; drops mis-tags elsewhere.
  const cell = [Math.round(Number(lat) * 1000), Math.round(Number(lon) * 1000)];
  if (!cell.every(Number.isFinite) || seen.has(`${pin},${cell}`)) continue;
  seen.add(`${pin},${cell}`);
  (pins[pin] ??= []).push(...cell);
}

// Suburbs only: coarser than neighbourhoods, which suits a name that becomes public.
const suburbs = rows(placesCsv)
  .filter(([, , place, name]) => place === "suburb" && name)
  .map(([lat, lon, , name, nameEn]) => [
    (nameEn || name).trim(),
    Math.round(Number(lat) * 1e5) / 1e5,
    Math.round(Number(lon) * 1e5) / 1e5,
  ])
  .sort((a, b) => a[0].localeCompare(b[0]));

const table = {
  source: `© OpenStreetMap contributors, ODbL 1.0. Built by scripts/build-locality-table.mjs on ${new Date().toISOString().slice(0, 10)}.`,
  suburbs,
  pins: Object.fromEntries(Object.entries(pins).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync("src/lib/locality/mumbai.json", JSON.stringify(table) + "\n");
console.log(
  `${suburbs.length} suburbs, ${Object.keys(pins).length} PIN codes, ${seen.size} cells → src/lib/locality/mumbai.json`,
);
