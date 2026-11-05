# P0-7: speech input (Prompt 5)

**Goal:** recorded way to the door → Sarvam transcript → existing extraction/candidate flow, with mocked HTTP; leave real API/phone tests pending.

**Files:** owned speech adapter and `/speech/in` route/tests, speech client and recording inspection helper/tests under `src/lib/server-client`, Blob path in setup/tests; this plan, AI/ML checklist, and only the two assigned AI/ML rows in `P0-3.md`. Preserve guard/env/router/shared API, other owners' files, directions/TTS stubs and `.commandcode/`.

**Tests first:** existing role seams `transcribe`, `speechIn`, `speechToText`, `describeTheWay`: inspect WebM/Opus and MP4/AAC byte streams, reject empty/malformed/unsupported/over-2-MiB/over-30-second recordings before provider HTTP, send correct multipart fields/language/header, parse transcripts, return plain errors, sign exact raw bytes and use transcripts for extraction. Use synthetic FFmpeg/ffprobe fixtures, never household recordings. Route tests substitute the unfinished owner spend interface; external requests are mocked.

**Research read:** speech note in full, glossary, P0-7 ticket and role, ADR 0007, API/domain and existing signing flow, TDD skill. Metadata references: Matroska element specification and Opus RFC 6716, plus ISO BMFF fragmented MP4 structure. No new dependency or browser decoder in the Worker.

**Decisions:** sniff supported audio containers from bytes because RouteContext has no content-type header; leave that owner contract unchanged. Check timing metadata, including durationless WebM packet timelines and fragmented MP4 sample durations; reject uninspectable inputs rather than guess duration from size or trust caller duration. Keep original audio bytes; do not transcode. Supported scope is audio-only WebM/Opus and MP4/AAC recorder output; unsupported structures fail closed and can use typed input. The browser signs `/speech/in` and raw bytes as in the shared path-based contract, with language in the query. No audio/transcript persistence or logs. Charge validated recording duration, rounded up to seconds, conservatively at 0.56 US cents/minute from the speech research estimate before provider HTTP; owner P0-6 must reconcile accounting. Hindi is P0; Marathi API support is not a claim of validated Marathi quality.

**Risks:** P0-6 guard/spend and P0-5 seal are owner stubs. No shared Cloudflare access; no key-file reads or live model/speech calls. Phone container compatibility, ten recognition recordings, sealed 20-second Hindi MP3 size and both-phone playback remain manual/live checks. Do not invent results or mark the overall speech ticket done. Prompt 6 directions/TTS is separate; do not implement it here. Record missing owner integration in this plan rather than changing owned contracts.

**Result:** pending implementation.
