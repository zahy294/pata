# AI/ML: Codex prompts

You own DIGIPIN, the geometry, the address AI pipeline, speech, and the accuracy test. Most of your code runs in the Worker (`server/src/ai`, `geo`, `speech`, and the `address-*`/`speech-*` routes), plus `src/lib/digipin`, `shared/geo.ts`, and the address and speech functions in `src/lib/server-client` and `src/lib/flows/setup-household.ts`.

The privacy rules are yours to defend (AGENTS.md, Invariants):

- the model and Sarvam see only the way to the door and the directions written from it;
- Nominatim and Overpass see only landmark names and the locality, never the transcript;
- the room number never reaches the server;
- the model never outputs coordinates: it picks OSM ids and relations, and plain code places the pins.

To run the Worker locally you need `server/.dev.vars` with `ANTHROPIC_API_KEY` and `SARVAM_API_KEY`. Ask the owner for them over a private channel, or use your own free credits. Never paste a key into Codex.

Until the owner's guard (P0-6) lands, every route returns 500, so unit-test your functions directly with Vitest and mocked `fetch`.

---

### Prompt 1: DIGIPIN (start now)

```
Read AGENTS.md, docs/team/ai-ml.md and docs/research/digipin.md (all of it).
Ticket: P0-4. Use the tdd skill.
1. Write docs/plans/P0-4.md and commit it ("P0-4: plan").
2. Turn each it.todo in src/lib/digipin/digipin.test.ts into a failing test, then implement src/lib/digipin/index.ts: encodeDigipin, decodeDigipin, isValidDigipin, toGridLabel, formatDigipin. India Post v2.0.0 algorithm, grid and bounds exactly as in digipin.md; no hyphens.
3. Load vectors from src/lib/digipin/vectors.json. Dak Bhawan (28.622788, 77.213033) -> 39J49LL8T4 is the reference. Vectors 2 and 3 conflict upstream (digipin.md says why): if one fails, record which and why in the plan rather than bending the code.
4. Round-trip test: 1,000 seeded random points inside the bounds; each encodes to a code whose decoded cell contains the point.
5. Compute the Dak Bhawan decode centre and add it to vectors.json (the Solidity resolver tests will reuse the file).
Done when npm run check passes. Small commits ("P0-4: encode", "P0-4: decode", ...), push your branch, open a pull request to main. Post "Unblocks: digipin" in the team chat.
```

### Prompt 2: plain geometry

```
Read AGENTS.md and docs/team/ai-ml.md. Use the tdd skill.
Ticket: P0-7 (geometry). Write docs/plans/P0-7-geo.md first and commit it.
Implement shared/geo.ts (distanceMetres, bearingDegrees, offsetPoint, nearestPointOnLine) test-first in shared/geo.test.ts, replacing each it.todo. Haversine with R = 6,371,008.8 m. nearestPointOnLine works on [lon, lat] pairs and must snap to the closest point on a segment, not the closest vertex (use a local equirectangular projection around p; it's accurate at street scale).
Done when npm run check passes. Commit, push.
```

### Prompt 3: map search (Nominatim + Overpass)

```
Read AGENTS.md, docs/team/ai-ml.md and docs/research/nominatim-overpass.md (all of it: rate limits, User-Agent, caching, ODbL).
Ticket: P0-7 (map search). Write docs/plans/P0-7-osm.md first and commit it. Use the tdd skill with mocked fetch.
1. server/src/geo/nominatim.ts localityBBox: search "<locality name>, <PIN code>" with countrycodes=in, format=jsonv2, limit=1; return [west, south, east, north]. Cache in KV by a normalized key for 30 days. At most 1 request per second across the Worker (a KV timestamp is enough). User-Agent: "Pata/0.1 (ETHGlobal Mumbai hackathon; https://github.com/zahy294/pata)".
2. server/src/geo/overpass.ts featuresInBox: ONE query per box: named nodes/ways with amenity, shop, building, tourism, leisure, place_of_worship, plus highway ways with their geometry. [out:json][timeout:25][maxsize:67108864]. Return OsmFeature[] (osmId like "node/123", centroid for ways) and Street[]. Cache in KV. On 429/504 back off and try the fallback endpoint from the note.
3. Only the locality and the box ever leave the Worker here. Write a test that asserts the request URL/body never contains words from a sample way-to-the-door string.
Done when tests pass and a manual run (a tiny script under server/src/geo/, not committed) returns real features for "Dharavi, 400017". Commit, push.
```

### Prompt 4: address AI and candidate pins

```
Read AGENTS.md, docs/team/ai-ml.md, docs/research/claude-api.md (all of it), shared/api.ts and server/src/routes/address-*.ts.
Ticket: P0-7 (AI). Write docs/plans/P0-7-ai.md first and commit it. Use the tdd skill for everything that isn't a model call.
1. server/src/ai/extract.ts: Haiku 5.5 (claude-haiku-5-5) with client.messages.parse and zodOutputFormat, effort "low": { locality: { name, pinCode } | null, landmarkPhrases: string[] }. The prompt explains Mumbai/Dharavi conventions (chawl, nagar, "90 Feet Road") and that the text may mix Hindi, Marathi and English.
2. server/src/ai/rank.ts: Sonnet 5.5 gets the way to the door and the features (osmId, name, kind only) and returns up to 5 { osmId, relation: at|opposite|behind|near, confidence }. keepKnownLandmarks is already written: test it, and always apply it.
3. server/src/geo/place-pins.ts: plain code (TDD) that turns ranked landmarks into CandidatePins using shared/geo.ts and the streets, rules in the file header; dedupe pins within 10 m; at most 3, best first; metresFromLandmark computed by code.
4. Routes: address-extract and address-rank parse the body with ExtractRequest/RankRequest, call the functions, charge the spend cap (chargeSpend; estimate cents from token usage), return ExtractResponse/RankResponse. RankResponse.duplicateLandmarkName = more than one fetched feature shares the chosen landmark's name. Never log the body; catch errors and return the plain error helper.
5. src/lib/server-client: extractAddress and rankLandmarks (sign with the household account per shared/api.ts SIGNATURE_HEADERS; parse responses with the zod schemas).
6. src/lib/flows/setup-household.ts: describeTheWay (typed text path for now) and findCandidatePins.
Done when, with the Worker running locally, a typed Dharavi description returns 1–3 sensible pins. Commit per step, push. Post "Unblocks: describeTheWay, findCandidatePins".
```

### Prompt 5: speech in (and two hour-0 tests)

```
Read AGENTS.md, docs/team/ai-ml.md and docs/research/speech.md (all of it).
Tickets: P0-7 (speech) and two rows of the P0-3 hour-0 table. Write docs/plans/P0-7-speech.md first and commit it.
1. server/src/speech/sarvam.ts transcribe: POST multipart to Sarvam speech-to-text, model saaras:v4, mode codemix, language code from SARVAM_LANGUAGE_CODE. Reject audio over 30 s or 2 MB before calling. Never store or log the audio or transcript.
2. server/src/routes/speech-in.ts and src/lib/server-client speechToText; extend describeTheWay to accept a Blob.
3. Hour-0 tests (write results into docs/plans/P0-3.md under your rows, with numbers): (a) Marathi recognition on five Marathi and five Hindi door descriptions recorded on the OnePlus 11; (b) a 20 s Hindi bulbul:v4-flash clip (mp3, 16 kHz): its size after AES-GCM sealing must be under 128 KiB, and it must play on both phones.
Done when a spoken Hindi description on the phone becomes candidate pins. Commit, push.
```

### Prompt 6: directions and audio

```
Read AGENTS.md, docs/team/ai-ml.md, docs/adr/0007-directions-audio-made-once-at-setup.md, docs/research/speech.md and docs/research/claude-api.md.
Ticket: P0-9. Write docs/plans/P0-9.md first and commit it.
1. server/src/ai/directions.ts: one Sonnet call returns { hi, mr, en } directions from the confirmed pin, the landmarks with their relation and the metres computed by code, and the way to the door. Each text short enough for about 20 s of speech (cap the characters; test the cap). Directions describe the last 50 metres in landmarks a courier can see.
2. server/src/speech/sarvam.ts synthesize: bulbul:v4-flash, mp3, 16 kHz, voices from speech.md; route speech-out returns audio/mpeg.
3. src/lib/server-client writeDirections and textToSpeech; src/lib/flows/setup-household.ts makeDirections: directions → three clips → blockchain's createVoiceRecord for each (sealed) → { directions, voiceKeys }. If a sealed clip is over the 128 KiB budget, shorten the text and retry once.
4. If Sarvam fails, return the directions anyway with no clip, and the courier view falls back to speechSynthesis (ADR 0007).
Done when setup produces three playable clips. Commit, push. Post "Unblocks: makeDirections".
```

### P1 prompts (only after every P0 ticket is done)

```
P1-6 "We're not sure" (server side). Read AGENTS.md. Make sure RankResponse.duplicateLandmarkName is right, export a helper that applies pinsDisagree to the top two candidates with NOT_SURE_SPREAD_METRES, and test both triggers. Frontend shows the banner.
```

```
P1-7 spoken Marathi. Only if the hour-0 Marathi test passed. Read docs/research/speech.md. Make mr-IN the default for Marathi input, test on the OnePlus 11, and record accuracy in docs/plans/P1-7.md.
```

```
P1-9 accuracy test. Read idea.md ("The metric", Data) and docs/tickets.md P1-9. Write scripts/accuracy-test.mjs that runs each of the 20 test addresses' typed descriptions through extract → rank → place-pins against the deployed Worker and reports how many top pins land within ACCURACY_METRES (25 m) of the true pin. The test data file stays out of git if it holds real people's pins; commit only the summary numbers in docs/plans/P1-9.md and the README.
```
