// Generate expected outputs exclusively from the pinned India Post implementation.
// Does not import or call any Pata implementation. See README.md for reproduction.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const revision = "a15339e8fdea93b13ae0d7336e567c9ae6ceac8e";
const url = `https://raw.githubusercontent.com/INDIAPOST-gov/digipin/${revision}/src/digipin.js`;
const sha256 = "9c56c16d546af95a6621a5a99a509cc1a128e9b04fe42259b797a49ec4354038";
const args = process.argv.slice(2);
const local = args.indexOf("--source");
let source;
if (local !== -1) {
  if (!args[local + 1]) throw new Error("--source requires a path to the unmodified pinned source");
  source = await readFile(args[local + 1]);
} else {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Reference download failed: HTTP ${response.status}`);
  source = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(source).digest("hex") !== sha256) {
  throw new Error("Reference SHA-256 mismatch; refusing to execute or generate fixtures");
}
const module = { exports: {} };
runInNewContext(source.toString("utf8"), { module }, { timeout: 1000 });
const reference = module.exports;
const cases = [];
function add(label, lat, lon) {
  const code = reference.getDigiPin(lat, lon);
  const { latitude, longitude } = reference.getLatLngFromDigiPin(code);
  cases.push({ label, lat, lon, code, latitude, longitude });
}

// Identical deterministic input stream to the original P0-4 comparison.
let seed = 0x50415441;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (let i = 0; i < 1000; i++) add(`interior-${i}`, 2.5 + 36 * random(), 63.5 + 36 * random());

// Exact dyadic grid intersections at multiple resolutions, with points on every side.
// These compute INPUTS only; all expected codes/centres still come from upstream.
const epsilon = 2 ** -36;
for (const level of [1, 2, 5, 10]) {
  const size = 36 / 4 ** level;
  const index = 4 ** level / 2 + 1;
  const lat = 2.5 + index * size;
  const lon = 63.5 + index * size;
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1])
      add(`grid-level-${level}-dy${dy}-dx${dx}`, lat + dy * epsilon, lon + dx * epsilon);
  }
}
for (const lat of [2.5, 38.5]) {
  for (const lon of [63.5, 99.5]) add(`outer-corner-${lat}-${lon}`, lat, lon);
}
for (const lon of [63.5, 81.5, 99.5]) {
  add(`south-edge-${lon}`, 2.5, lon);
  add(`north-edge-${lon}`, 38.5, lon);
}
for (const lat of [2.5, 20.5, 38.5]) {
  add(`west-edge-${lat}`, lat, 63.5);
  add(`east-edge-${lat}`, lat, 99.5);
}
add("just-inside-south", 2.5 + epsilon, 81.5);
add("just-inside-north", 38.5 - epsilon, 81.5);
add("just-inside-west", 20.5, 63.5 + epsilon);
add("just-inside-east", 20.5, 99.5 - epsilon);
for (const [label, lat, lon] of [
  ["Dak Bhawan", 28.622788, 77.213033],
  ["README Chennai", 13.11179621, 80.20264269],
  ["Swagger Chennai", 13.067526, 80.270956],
  ["Bengaluru", 12.9716, 77.5946],
  ["Dharavi public sample", 19.045, 72.855],
  ["BKC public sample", 19.06, 72.87],
])
  add(label, lat, lon);

const metadata = {
  formatVersion: 1,
  reference: { revision, url, sha256 },
  inputs: {
    interiorSeed: "0x50415441",
    interiorCount: 1000,
    boundaryLevels: [1, 2, 5, 10],
    epsilonDegrees: epsilon,
  },
};
// One case per line keeps this generated fixture inspectable and byte-reproducible.
const output = `${JSON.stringify(metadata, null, 2).slice(0, -2)},\n  "cases": [\n${cases.map((row) => `    ${JSON.stringify(row)}`).join(",\n")}\n  ]\n}\n`;
const target = new URL("./fixtures.json", import.meta.url);
if (args.includes("--check")) {
  if ((await readFile(target, "utf8")) !== output)
    throw new Error("Reference fixtures differ; regenerate and review");
  console.log(`Verified ${cases.length} independent reference fixtures`);
} else {
  await writeFile(target, output);
  console.log(`Generated ${cases.length} independent reference fixtures`);
}
