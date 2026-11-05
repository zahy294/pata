# Independent DIGIPIN reference fixtures

`fixtures.json` contains expected outputs generated **only** by India Post's JavaScript encoder and decoder at revision `a15339e8fdea93b13ae0d7336e567c9ae6ceac8e`. The generator never imports Pata's implementation or derives expected codes/centres from it.

- [Pinned source](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/src/digipin.js)
- Source SHA-256: `9c56c16d546af95a6621a5a99a509cc1a128e9b04fe42259b797a49ec4354038`
- [Pinned representation requirements](https://github.com/INDIAPOST-gov/digipin/blob/a15339e8fdea93b13ae0d7336e567c9ae6ceac8e/README.md)

There are 1,062 cases: 1,000 interior points from the original comparison's seeded LCG (`0x50415441`); 36 intersection/adjacent cases at levels 1, 2, 5 and 10; 4 corners; 12 edge samples (including corner repeats); 4 just-inside edge samples; and 6 named examples. Grid/edge arithmetic creates inputs only. Upstream `getDigiPin` supplies each expected code, and upstream `getLatLngFromDigiPin` supplies each expected six-decimal centre string. Fixture metadata includes the revision, raw URL, hash and input-generation settings.

From the repository root, with Node 22 or later:

```bash
# Fetch the pinned source, verify its hash, regenerate independently, and compare bytes.
node src/lib/digipin/reference/generate.mjs --check

# Deliberately regenerate the committed artifact, then inspect its diff.
node src/lib/digipin/reference/generate.mjs

# A previously downloaded, unmodified source file also works offline; its hash is checked.
node src/lib/digipin/reference/generate.mjs --source /path/to/pinned-digipin.js --check

# Test Pata against the committed expected outputs without any network access.
npx --no-install vitest run src/lib/digipin/reference/reference.test.ts
```

Hash mismatches fail before source execution. The verified source executes in a VM context with only its CommonJS `module` provided, without Node `require`, `process` or networking. Generated fixtures have no timestamp and are byte-reproducible; keep their generator formatting rather than reformatting the JSON manually. No reference code is loaded by the application, and `npm run check` needs no network access for these fixtures. Decode comparisons use the upstream six-decimal output precision; existing Pata tests separately verify full-precision cell bounds and centres.

## Pata input contract

Canonical storage/interchange is ten uninterrupted uppercase characters; grid labels are lowercase. The upstream reference decoder trims surrounding whitespace but rejects internal spaces and hyphens. Its README permits 3-4-3 spaces for display only.

Pata intentionally adds input convenience: all four code-input helpers fold case and remove **ASCII U+0020 spaces anywhere**, regardless of grouping. This was specified by the original `isValidDigipin` header and P0-4 plan. It is normalization of user input, not a claim that arbitrarily spaced text is canonical DIGIPIN. `formatDigipin` always emits 3-4-3 groups. Tabs, newlines, non-ASCII whitespace and hyphens remain invalid. No hyphen compatibility mode is introduced.

TypeScript signatures remain string-only. At the JavaScript runtime boundary, `isValidDigipin` returns false for non-strings; `decodeDigipin`, `toGridLabel` and `formatDigipin` throw `Invalid DIGIPIN` for invalid inputs rather than coercing objects.
