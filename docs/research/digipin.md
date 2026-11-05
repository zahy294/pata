# DIGIPIN

Checked: 2026-11-03 · Version: India Post repo [`INDIAPOST-gov/digipin`](https://github.com/INDIAPOST-gov/digipin) v2.0.0 ("May 2026 Standards Revision"; tag `v2.0.0` → `1f8be449`, `main` HEAD `a15339e8`, 2026-05-29, cloned 2026-11-03), and India Post's technical PDF "Technical Document – Final version, March 2025" (downloaded from indiapost.gov.in 2026-11-03) · Status: test at kick-off
Feeds: idea.md "The public grid → wildcard resolution" (six jury questions, architecture row); Build → Stack, DIGIPIN row; Data → "DIGIPIN test vectors"; Demo script moment 3 ("a trillion names"); scope ladder P0 "confirm → DIGIPIN" and P1 "the `*.digipin.eth` wildcard resolver" (P2 "DIGIPIN names shown in ENS's own app"); CLAUDE.md invariant "DIGIPIN encoding … come[s] from plain, tested code".

All sources below were read 2026-11-03. "Verified by" says how: source code (read, never run), docs, or our own arithmetic (marked inferred).

## Install and setup

- **The official code** is `https://github.com/INDIAPOST-gov/digipin`, linked from India Post's own DIGIPIN page as "GitHub - DIGIPIN Repository", next to the technical document, the web app `https://dac.indiapost.gov.in/mydigipin` and DHRUVA ([India Post](https://www.indiapost.gov.in/digipin); verified by: docs).
- **History:** it started at `github.com/CEPT-VZG/digipin` (created 2025-04-07). On 2025-11-14 that repo was emptied to a "Repository Relocated" notice pointing to `INDIAPOST-gov/digipin` ([CEPT-VZG README](https://github.com/CEPT-VZG/digipin)). The algorithm file there (`src/digipin.js` at `dca39047`) is byte-identical, apart from line endings, to the new repo's first version (`1f5ffc96`) (verified by: `diff` of the two files).
- **Languages:** JavaScript only (GitHub languages API: `{"JavaScript": 7935}`). It's a small Express server (`server.js`, `src/app.js`, `src/routes/digipin.routes.js`) around one module, [`src/digipin.js`](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/digipin.js), which exports `getDigiPin(lat, lon)` and `getLatLngFromDigiPin(digiPin)`. There is no npm package to install; the README's only setup is clone, `npm install`, `npm start` on port 5000 ([README](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md)).
- **Tests:** none. `package.json` has `"test": "echo \"Error: no test specified\" && exit 1"` ([package.json](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/package.json)). The only official vectors are examples in the docs (see Values to copy).
- **Last update:** last push 2026-05-29 (GitHub API `pushed_at: 2026-05-29T12:26:45Z`); release [v2.0.0](https://github.com/INDIAPOST-gov/digipin/releases/tag/v2.0.0), "DIGIPIN v2.0.0 – May 2026 - Logo Branding inclusions , Format Revision", published 2026-05-29. 8 commits in total. 15 open issues (not yet read: open).
- **Licence:** the [`LICENSE`](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/LICENSE) file is the Apache License 2.0 text with the appendix filled in as "Copyright 08.04.2025 Department of Posts", and the README says "licensed under the Apache License, Version 2.0". Two loose ends: GitHub's detector reports `NOASSERTION` (the file's formatting differs from the canonical text), and `package.json` says `"license": "ISC"`, which looks like an `npm init` default (inferred). **We may port it** (Apache-2.0 §2 grants the right to make derivative works). The conditions in §4: ship a copy of the Apache licence with the ported file, keep the Department of Posts copyright notice, and mark the file as changed. There is no `NOTICE` file, so §4(d) adds nothing. §6 grants no trademark rights, which matters for the DIGIPIN logo (see Gotchas). Pata's own MIT licence (idea.md, CROPS "O") can sit beside an Apache-2.0 file (inferred; not legal advice).
- **Use in Pata:** port the two functions into our own TypeScript module with our own tests (the CLAUDE.md invariant). Don't run India Post's server and don't add a dependency on the repo (inferred).

## The algorithm

Read from [`src/digipin.js`](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/digipin.js) (v2.0.0), the repo's [technical document](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/docs/DIGIPIN_Technical_Document.md) (May 2026 revision) and the [India Post PDF](https://www.indiapost.gov.in/documents/offerings/intiatives/DIGIPIN_Technical_document.pdf) (March 2025, with its own reference code in Annexures 1 and 2). All three agree on the grid.

1. **Bounding box:** longitude 63.5–99.5° E, latitude 2.5–38.5° N, a 36° × 36° square; CRS EPSG:4326, "WGS84 datum at epoch 2005" (tech doc §4.1; code `BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 }`). It covers India and its maritime EEZ, and so also parts of Pakistan, Nepal, Bangladesh, Sri Lanka and the sea (tech doc §4.1 and Figure 1).
2. **Levels:** 10. At each level the current box is cut into a 4 × 4 grid and one symbol picks the sub-cell, so the code is 10 symbols and "uniquely identifies one of the 16^10 cells within the bounding box" (tech doc §4). The same labelled grid is used at every level ("A uniform gridding and labelling scheme across all iterations (1-10)", tech doc §5).
3. **Alphabet:** 16 symbols `2 3 4 5 6 7 8 9 C J K L M P F T`, "exactly ten characters in length and alphabets shall be in upper case" (tech doc §2b). The beta's G, W and X were replaced by C, F and T (tech doc §5).
4. **Grid layout** (row 0 is north, column 0 is west), from the code's `DIGIPIN_GRID`:

   ```
   F C 9 8
   J 3 2 7
   K 4 5 6
   L M P T
   ```

   "Symbols are assigned in anticlockwise fashion, spiraling outwards", so consecutive symbols are neighbours (tech doc §4.3). In the code, the row counts down from the north: `row = 3 - floor((lat - minLat) / latDiv)`, `col = floor((lon - minLon) / lonDiv)`, both clamped to 0–3.
5. **Separators:** none since v2.0.0. "Hyphens (-) and other punctuation characters are not permitted. For display purposes, spaces may optionally be used in a 3-4-3 grouping pattern" ([README, Representation Guidelines](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md)). The v1 code (and the March 2025 PDF's Annexure 1) inserted `-` after symbols 3 and 6 (`XXX-XXX-XXXX`); v2.0.0 changed that line to `digiPin += ""` ([v2.0.0 diff](https://github.com/INDIAPOST-gov/digipin/commit/13375128da82161d14e2519544c90566653000d8)). The algorithm itself didn't change between v1 and v2: same grid, bounds and arithmetic (verified by: reading the diff).
6. **Cell size per level:** the tech doc's Table 1 (§4.5) and the exact values (our arithmetic, inferred: 36°/4^k; metres use 1° ≈ 111.32 km east–west and ≈ 110.6 km north–south at the equator):

   | Level | Doc's width | Exact degrees (36/4^k) | Doc's approx. distance |
   |---|---|---|---|
   | 1 | 9° | 9 | 1000 km |
   | 2 | 2.25° | 2.25 | 250 km |
   | 3 | 33.75′ | 0.5625 | 62.5 km |
   | 4 | 8.44′ | 0.140625 | 15.6 km |
   | 5 | 2.11′ | 0.03515625 | 3.9 km |
   | 6 | 0.53′ | 0.0087890625 | 1 km |
   | 7 | 0.13′ | 0.002197265625 | 250 m |
   | 8 | 0.03′ | 0.00054931640625 | 60 m |
   | 9 | 0.5″ | 0.0001373291015625 | 15 m |
   | 10 | 0.12″ | 0.000034332275390625 | 3.8 m |

   A level-10 cell is 0.000034332275390625° on each side. North–south that is about 3.8 m everywhere (0.0000343323° × ~110.6–110.9 km). East–west it shrinks with cos(latitude): 3.82 m at the equator, about 3.61 m in Mumbai (19.0° N: 3.822 × 0.945) and 3.36 m in Delhi (28.6° N: 3.822 × 0.878) (inferred). The doc says the same in words: "The level-10 cells would be almost rectangular, but the dimensions would vary based on the latitude … smaller than 3.8-meter x 3.8-meter if measured at the equator" (tech doc §4.1). Its headline phrase is "uniform 4-meter by 4-meter(approx.) units" (tech doc §3.1).
7. **Decode returns the centre**, not a corner: `centerLat = (minLat + maxLat) / 2`, returned as `{ latitude: centerLat.toFixed(6), longitude: … }`, which are **strings** with 6 decimals. The PDF's Annexure 2 also returns the centre, as one string `cLat + ', ' + cLng` at full precision.
8. **Points on grid lines** (tech doc §4.4): a point on a vertical line goes to the east cell, on a horizontal line to the north cell, and on an intersection to the north-east cell. The exceptions are the top edge (38.5° N), which goes to the cell below, and the right edge (99.5° E), which goes to the cell to its left. The v2 code does this through `floor` plus the clamp to 0–3. The PDF code does it with half-open intervals `[min, max)` and a "NEWLY ADDED TO ADDRESS BOUNDARY CONDITION" branch for the east edge (verified by: reading both).
9. **Outside the box:** v2 `getDigiPin` throws `"Latitude out of range"` or `"Longitude out of range"`. The bounds are inclusive (`lat < 2.5 || lat > 38.5` throws), so the edges themselves encode. The PDF version calls `alert(...)` and returns `''`.
10. **Decode validation (v2):** the input must be a string; it is `trim()`med and upper-cased, must be exactly 10 characters, and must match `/^[23456789CJKLMPFT]{10}$/`. Lowercase is accepted; hyphens and spaces are rejected. The v1 decoder did the opposite: it stripped hyphens (`replace(/-/g, '')`) and was case-sensitive.

## What Pata uses

- **Encode (P0, in the app):** our own TypeScript port of `getDigiPin(lat, lon) → string`. Input is WGS84 decimal degrees, the confirmed pin from MapLibre. Output is the 10-symbol uppercase string with no separators (the v2 standard). Throw outside the box. Don't round the input: the PDF says "A higher precision (upto 5 decimal places) of latitude-longitude input values results in more precise DIGIPIN" (Annexure 1 comment). 1e-5° is about 1.1 m against a 3.4e-5° cell, so 4-decimal inputs can land in the wrong level-10 cell (inferred).
- **Decode (P0 courier view, P1 resolver):** `getLatLngFromDigiPin(code) → { latitude, longitude }` gives the cell centre. Port it to return numbers. Keep the string form only for a test that matches India Post's `toFixed(6)` output.
- **Storage and display:** store the canonical 10 uppercase symbols inside the encrypted home record and grant payload. Show it to the courier as `39J 49LL 8T4` (3-4-3 with spaces), as the v2 standard allows.
- **ENS label mapping:** label = the 10 symbols lower-cased, e.g. `39J49LL8T4` → `39j49ll8t4.digipin.eth`. This is unambiguous (inferred from the alphabet and ENSIP-15):
  - the alphabet has 8 digits and 8 letters (C, J, K, L, M, P, F, T), and lower-casing maps them one-to-one onto `2–9, c, j, k, l, m, p, f, t`, with no collisions;
  - ENS normalization (ENSIP-15) maps ASCII uppercase to lowercase and keeps digits and `a–z` as they are, so every DIGIPIN has exactly one normalized label, and its 10 characters are all plain ASCII ([ENSIP-15](https://docs.ens.domains/ensip/15); exact rule text: open, see Test at kick-off);
  - the resolver should accept only `^[23456789cjklmpft]{10}$`, a single label under `digipin.eth`. A hyphenated `39j-49l-l8t4` is also a valid ENS label, but accepting it would give one cell two names and break with the v2 standard, so reject it (inferred). For a normalized name the upper-case branch is redundant; folding `A–Z` too costs little if someone calls `resolve()` with raw bytes (inferred).
- **Decoding in Solidity (P1; no official Solidity code exists, so all of this is inferred):**
  - *Parse:* take the first label of the DNS-encoded name passed to ENSIP-10 `resolve(bytes name, bytes data)`. Require length byte = 10 and the rest of the name = `digipin.eth` (the interface is the ENS note's topic).
  - *Lookup:* map each byte to (row, col): either a linear scan of the constant `"fc98j327k456lmpt"` (index i gives row = i / 4, col = i % 4), or a 128-entry table of nibbles packed in one `bytes32`/`uint256` constant read by shift. Reject anything else.
  - *Integer arithmetic, no floats:* accumulate cell indices from the south-west corner, `x = x*4 + col` and `y = y*4 + (3 - row)`, over 10 symbols, so x, y ∈ [0, 2^20). The cell's south-west corner is `2.5 + y·36/2^20` (lat) and `63.5 + x·36/2^20` (lon), and the centre is `2.5 + (2y+1)·36/2^21`.
  - *Exact fixed point:* 36/2^21 = 36·5^21/10^21, so the centre in units of 1e-21° is the integer `2.5e21 + (2y+1)·36·476837158203125` (5^21 = 476,837,158,203,125). It fits easily in `uint256`, with no rounding anywhere.
  - *Matching India Post's 6-decimal output:* round that integer to 1e-6° (add half, divide by 1e15). There is never a tie: the value has exactly two factors of 2, so it can't sit exactly halfway between two 1e-6 steps. Integer rounding therefore equals JS `toFixed(6)` for every cell (inferred: our proof sketch; to confirm by fuzzing at kick-off).
  - *Gas:* about 10 iterations of a byte read, a lookup and a few shifts, plus formatting two decimals as text. Rough guess: under ~10k gas for the decode and a few thousand more for string formatting. It runs in `eth_call`, so users pay nothing. Measure with `forge test --gas-report` at kick-off.
- **Official API:** India Post's repo is a self-hostable reference server: Swagger `servers: - url: http://localhost:5000/api`, routes `GET|POST /api/digipin/encode` (`latitude`, `longitude`) and `GET|POST /api/digipin/decode` (`digipin`) ([swagger.yaml](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/swagger.yaml), [routes](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/routes/digipin.routes.js)). No hosted public endpoint, key or rate limit is documented there. Whether the web app `dac.indiapost.gov.in/mydigipin` calls a public API: **open**.
- **Decision:** compute locally, always. The algorithm is about 40 lines, deterministic and offline. Any API call would hand the household's exact coordinates to a third party, which goes against the first invariant (inferred).

## Limits

- **Full codes only:** v2 decode accepts exactly 10 symbols. The tech doc describes prefixes as larger regions ("a DIGIPIN code of length 6 represents a ~ 1km x 1km region", §4.5), but the code has no prefix decode. Our port can decode a prefix to a box if we ever need one.
- **The box is not India:** the grid's 16^10 = 2^40 = 1,099,511,627,776 cells (inferred arithmetic; the docs say "16^10 cells") cover the whole 36° × 36° square: sea, Pakistan, Nepal, China, Bangladesh, Myanmar, Sri Lanka. The encoder doesn't check borders, so a point in Lahore gets a valid DIGIPIN (inferred from the code).
- **Precision:** a code names a cell about 3.8 m × 3.4–3.8 m, not a point. Decode gives the centre, up to about 2.6 m from any point in the cell (half-diagonal, inferred). GNSS error on phones is usually larger (the doc calls the cell size "reasonable given the accuracy of most current commercially available Global Navigation Satellite System", §4.1).
- **Floating point:** every cell boundary is 2.5 or 63.5 plus a multiple of 36/4^k = 9·2^-(2k-2), so boundaries are exact in float64 (inferred). Only `floor((lat - minLat)/latDiv)` can round wrong, and only for points within about 1e-14° of a grid line, where the v2 and PDF codes might disagree. That doesn't matter for GPS input; it matters only if a test vector sits on a line.
- **Rate limits and offline:** none, since we compute locally.

## Gotchas

- **Hyphens are gone.** v2.0.0 (May 2026) made `39J-49L-L8T4` invalid ("❌ Hyphens are not permitted"), and the official v2 decoder rejects it on length. India Post's own PDF still shows the v1 code that emits hyphens, and its text writes Dak Bhawan with spaces, `39J 49L L8T4` (3-3-4), even though the v2 display rule is 3-4-3 (`39J 49LL 8T4`). Normalize on input: strip spaces and hyphens, upper-case, then validate.
- **India Post's own examples disagree.** The README pairs `4T396F42L7` with (13.11179621, 80.20264269); swagger.yaml pairs the same code with (13.067526, 80.270956). Those points are about 5 km apart, so at most one pairing is right. Which one: open (to compute).
- **Decode returns strings** (`"12.971601"`), not numbers, rounded to 6 decimals (about 0.1 m).
- **The v2 encoder computes an unused `str = String(digiPin).toUpperCase()`** and returns `digiPin`. That's harmless because the grid is already uppercase, but don't copy it.
- **`NaN` passes the range check** (`NaN < 2.5` is false), then fails later with a TypeError on `DIGIPIN_GRID[NaN]`. The GET route feeds it `parseFloat(undefined)`. Our port should check `Number.isFinite` first (inferred from reading the code).
- **Comment typos:** the header says `Date : 28.04.20026`. The v2 doc's correct/incorrect tables also show odd examples (`C4P8K63MK5` "Correct", `C4P-86-3A` "Incorrect"). Treat display examples without coordinates as format samples only.
- **Privacy, ours:** a DIGIPIN is the exact door. Don't resolve a household's code through `<code>.digipin.eth` from the courier view: that would send the exact cell over RPC. Decode locally from the payload. The public resolver is for the demo and for public places (inferred, from the CLAUDE.md invariant).
  - Never publish a DIGIPIN *prefix* as the "locality" either. Six symbols already pin about 1 km and seven about 250 m (tech doc §4.5); the public record should stay the PIN code (inferred).
- **Branding rule:** v2 says a DIGIPIN "shall be represented using the official DIGIPIN symbol" before the code, and marks a bare code as "❌ DIGIPIN symbol missing" (README). The logo is in the repo (`docs/images/DIGIPIN_Logo.svg`), but Apache-2.0 §6 grants no trademark rights. Showing the bare code in a hackathon UI is a judgement call; mention it if a judge asks (inferred).

## Values to copy

| Name | Value | Source |
|---|---|---|
| Grid, row 0 = north, col 0 = west | `[["F","C","9","8"],["J","3","2","7"],["K","4","5","6"],["L","M","P","T"]]` | [`src/digipin.js` L37–42](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/digipin.js#L37-L42) |
| Same grid as one string (index i → row i/4, col i%4) | `FC98J327K456LMPT` (lowercase for ENS: `fc98j327k456lmpt`) | derived from the grid (inferred) |
| Bounds | lat 2.5–38.5, lon 63.5–99.5 (inclusive for encode) | [`src/digipin.js` L44–49](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/digipin.js#L44-L49); tech doc §4.1 |
| Levels | 10 | tech doc §4 |
| Level-10 cell | 0.000034332275390625° = 36/2^20° (0.1236″) | tech doc Table 1 says 0.12″; exact value inferred |
| Total cells | 16^10 = 2^40 = 1,099,511,627,776 | tech doc §4 says "16^10"; the number is our arithmetic (inferred) |
| Valid code (canonical) | `^[23456789CJKLMPFT]{10}$` | [`src/digipin.js` L135](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/digipin.js#L135); swagger `pattern` |
| Valid ENS label | `^[23456789cjklmpft]{10}$` | inferred from the above and ENSIP-15 |
| Display format | `C4P 8K63 M4M` (3-4-3, spaces); never hyphens | [README](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md) |
| Centre in 1e-21° | lat = 2.5e21 + (2y+1)·36·476837158203125; lon = 63.5e21 + (2x+1)·36·476837158203125 | inferred (see Solidity) |
| **Vector 1, Dak Bhawan** | (28.622788, 77.213033) → `39J49LL8T4` (printed as `39J 49L L8T4`) | tech doc §6 (repo) and §5 (PDF): "The DIGIPIN of Dak Bhawan is 39J 49L L8T4"; Figure 4 gives the levels 3, 9, J, 4, 9, L, L, 8, T, 4 |
| Vector 1, decode centre | open (to compute) | — |
| Vector 2, v2 README encode | (13.11179621, 80.20264269) → `4T396F42L7` | [README](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md); same in the `getDigiPin` doc comment |
| Vector 3, swagger encode/decode | (13.067526, 80.270956) ↔ `4T396F42L7` → `{"latitude":"13.067526","longitude":"80.270956"}`; **conflicts with vector 2** | [swagger.yaml](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/swagger.yaml) |
| Vector 4, v2 README decode | `4P3JK852C9` → `{"latitude":"12.971601","longitude":"77.594584"}` | [README](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md) |
| Vector 5, v1 README encode | (12.9716, 77.5946) → `4P3-JK8-52C9` (v2 form `4P3JK852C9`); decode → ("12.971601", "77.594584") | [CEPT-VZG README at `dca39047`](https://github.com/CEPT-VZG/digipin/blob/dca39047a74d278a82230b8ced41a0ca73bd0a6e/README.md) |
| Format-only samples (no coordinates) | `C4P8K63M4M`, `C4P8K63MK5` | README; tech doc §2 |
| Repo tests | none | package.json |
| Licence | Apache-2.0, "Copyright 08.04.2025 Department of Posts" | [LICENSE](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/LICENSE) |

## Contradictions with idea.md

1. **Hyphenated Dak Bhawan code.** idea.md, Data: "India Post's published example (Dak Bhawan, `39J-49L-L8T4`)". India Post's v2.0.0 standard (May 2026): "Hyphens (-) and other punctuation characters are not permitted", with `C4P-8K6-3M4M` marked "❌ Hyphens are not permitted" ([README](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md)). The v2 decoder rejects the hyphenated form. The documents print it `39J 49L L8T4`. Use `39J49LL8T4`; idea.md's ENS label `39j49ll8t4` already matches.
2. **"4 m square".** idea.md (opening and demo hook): "DIGIPIN gives every 4 m square of India a code". The docs say "4-meter by 4-meter (approx.)" but also "3.8m x 3.8m" at the equator and "almost rectangular … vary based on the latitude" (tech doc §3.1, §4.1, Table 1). In Mumbai a cell is about 3.8 m × 3.6 m (inferred). It's a nuance rather than an error; "about 4 m" is safe on stage.
3. **"1.1 trillion cells" / "India's 4 m cells".** idea.md: "any of India's 4 m cells", "every one of the grid's 1.1 trillion cells". 16^10 = 1.0995 × 10^12 is right for the grid (tech doc §4: "one of the 16^10 cells within the bounding box"), but those cells cover a 36° × 36° box, most of it sea or other countries, not India's land. "India Post's grid has 1.1 trillion cells" is accurate; "India's 1.1 trillion cells" is not. No India Post document read so far states "1.1 trillion" in words.
4. **"Tested against India Post's own example code."** idea.md, Stack: "testable against India Post's own example code". The repo has no tests, and two of its own examples conflict (vectors 2 and 3). We have to build our own vectors.

## Test at kick-off

- [ ] Port `getDigiPin` and `getLatLngFromDigiPin` to TypeScript. Unit-test Dak Bhawan (28.622788, 77.213033) → `39J49LL8T4`, and vectors 2–5.
- [ ] Settle the README-vs-swagger conflict for `4T396F42L7` (open; to compute before kick-off).
- [ ] Round-trip property test: `encode(decode(c)) == c` for random codes, and `decode(encode(p))` within half a cell of p. Edge tests on grid lines, 38.5° N and 99.5° E.
- [ ] Solidity decoder: integer outputs equal the TS port's centres for 10k random codes (fuzz). Its 6-decimal rounding equals `toFixed(6)`. Measure gas with `forge test --gas-report`.
- [ ] Confirm the ENSIP-15 rule text that normalizes uppercase ASCII to lowercase and keeps `0-9 a-z`, by checking that `normalize("39J49LL8T4") === "39j49ll8t4"` with viem's `normalize`.
- [ ] Open: does the India Post web app `dac.indiapost.gov.in/mydigipin` call a public API (endpoints, limits)? It doesn't change the decision to compute locally.
- [ ] Open: India Post FAQ answers ("How precise is the DIGIPIN system?", "Is DIGIPIN applicable only within India?", "Will DIGIPIN affect my privacy?") were collapsed in the scrape and haven't been read yet.
- [ ] Open: the DHRUVA PDF's DIGIPIN passages (context only).
- [ ] Open: read the repo's 15 open issues for known bugs.
