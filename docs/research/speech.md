# Speech: Hindi and Marathi

Checked: 2026-11-03 · Version: Sarvam `saaras:v4` (STT) and `bulbul:v4-flash` / `bulbul:v3` (TTS), read on docs.sarvam.ai; Google Cloud Speech-to-Text V2 (`chirp_3`) and Text-to-Speech voice list and pricing, read on cloud.google.com; Azure AI Speech language support, pricing page and data-privacy page, read on learn.microsoft.com and azure.microsoft.com; Web Speech API and MediaRecorder on MDN, MDN browser-compat-data, webkit.org, Chrome's speech demo and Apple's iOS feature-availability page · Status: test at kick-off
Feeds: idea.md "Why this model and architecture?" (speech in and out), Build → Stack "Address AI" and "Offline demo kit", Demo script moments 1 and 2, Risks ("Speech recognition is weak for Marathi"), scope ladder P0 "Typed or spoken description" and "Courier view with Hindi audio", P1 "Spoken Marathi input"; the README's CROPS "P" section.

## Providers compared

Prices exclude tax. Sarvam publishes rupees; the dollar figures beside them assume about ₹88 to $1 (inferred).

| | Sarvam AI | Google Cloud | Azure AI Speech |
|---|---|---|---|
| STT model, Marathi and Hindi | `saaras:v4` (default), `saaras:v3`; `saaras:v3-realtime` for streaming; `mr-IN`, `hi-IN` ([Saaras](https://docs.sarvam.ai/api/api-guides-tutorials/models/saaras)) | V2 API: `chirp_3` (`us` and `eu` regions), `chirp_2`, `chirp`, `long`, `short` for both `mr-IN` and `hi-IN`; `hi-IN` also has `telephony` ([V2 languages](https://cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages)) | `mr-IN` and `hi-IN` listed in the speech-to-text table ([language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)) |
| TTS voices, Marathi | `bulbul:v4-flash`: 9 voices, such as `ishita_mr_conversational`, `nilesh_mr_conversation`, `ritu_mr_narration` ([voices](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices)); `bulbul:v3` speakers with `mr-IN` | `mr-IN-Chirp3-HD-*`, `mr-IN-Wavenet-A/B/C`, `mr-IN-Standard-A/B/C`; no Neural2 ([voices](https://cloud.google.com/text-to-speech/docs/list-voices-and-types)) | `mr-IN-AarohiNeural` (female), `mr-IN-ManoharNeural` ([language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)) |
| TTS voices, Hindi | `bulbul:v4-flash`: dozens, such as `aditya_hi_conversational`, `kavya_hi_conversational`, `ratan_hi_customer_expressive`; also English–Hindi `enhi` styles | `hi-IN-Chirp3-HD-*`, `hi-IN-Neural2-*` (4), `hi-IN-Wavenet-*` (6), `hi-IN-Standard-*` (6) | `hi-IN-SwaraNeural`, `hi-IN-MadhurNeural`, `hi-IN-AartiNeural`, `hi-IN-ArjunNeural`, `hi-IN-AnanyaNeural`, `hi-IN-KavyaNeural`, `hi-IN-KunalNeural`, `hi-IN-RehaanNeural`, `hi-IN-AaravNeural` |
| Code-switching with English | Built in: `mode="codemix"` returns English words in Latin script and Indic words in native script; `language_code` is optional, with auto-detect ([Saaras](https://docs.sarvam.ai/api/api-guides-tutorials/models/saaras)). TTS accepts code-mixed text ([TTS reference](https://docs.sarvam.ai/api-reference/text-to-speech/convert)) | Not checked; test at kick-off | Not checked; test at kick-off |
| Streaming | STT: WebSocket `/speech-to-text-realtime/ws`, raw PCM at 8 or 16 kHz only, with partial transcripts. TTS: HTTP stream and WebSocket ([which API](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/which-api-to-use)) | Yes; not needed by Pata | REST short audio and WebSocket via the Speech SDK ([short-audio REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)) |
| Latency figures | None published. REST is "one round-trip after upload" ([which API](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/which-api-to-use)) | None found | None found |
| STT price | ₹0.49/min pay-as-you-go, billed per second (about $0.0056/min) ([pricing](https://docs.sarvam.ai/api/getting-started/pricing)) | V2: $0.016/min for the first 500,000 min a month. V1: 60 min a month free, then $0.016/min with data logging or $0.024/min without ([pricing](https://cloud.google.com/speech-to-text/pricing)) | Free F0 tier: 5 audio hours of real-time STT a month. Paid rates are drawn by script and didn't load; read them in the portal ([pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)) |
| TTS price | `bulbul:v4-flash`: ₹1.00 per 1,000 chars (₹1,000 per million, about $11). `bulbul:v3`: ₹3.00 per 1,000 | Standard and WaveNet: 4M chars a month free, then $4 per million. Neural2: 1M free, then $16. Chirp 3 HD: 1M free, then $30 ([TTS pricing](https://cloud.google.com/text-to-speech/pricing)) | F0: 0.5 million neural characters a month free; paid rate as above |
| Free tier or credits | ₹100 of credits for each verified user at signup; they never expire ([pricing](https://docs.sarvam.ai/api/getting-started/pricing)) | The monthly free usage above; billing must be enabled ([TTS pricing](https://cloud.google.com/text-to-speech/pricing)) | F0 tier above, no card charge within it ([pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)) |
| Inputs train models? | Only with consent. The privacy policy lists "Model training / service improvement: inputs and outputs, where applicable" with consent as the legal basis; otherwise improvement uses de-identified data and data "you choose to contribute" ([privacy policy, updated 2026-07-29](https://www.sarvam.ai/privacy-policy); [terms §17.5](https://www.sarvam.ai/terms-of-service)) | No by default: "By default, Cloud Speech-to-Text does not log customer audio data or transcripts"; logging is an opt-in program with a cheaper rate ([data logging](https://cloud.google.com/speech-to-text/docs/data-logging)) | No: "Microsoft does not retain or store the data" for real-time and fast transcription ([data privacy](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security)) |
| Retention | "Your Content (Inputs/Outputs): User-configurable (default: 30 days after last access)". Data may be processed outside India, including on US cloud providers ([privacy policy](https://www.sarvam.ai/privacy-policy)) | No logging unless opted in (above) | Real-time audio "is processed only on the Azure's server memory, and no data is stored at rest" ([data privacy](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security)) |
| Formats Pata's recorders produce | Accepted: WebM, OGG/Opus, MP4/M4A, AAC, auto-detected ([STT overview](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview)) | Not checked | REST short audio takes only `audio/wav; codecs=audio/pcm; samplerate=16000` and `audio/ogg; codecs=opus`, at most 60 s ([short-audio REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)). WebM or MP4 needs transcoding or the Speech SDK (inferred) |

**Marathi quality evidence:** we found no independent word-error-rate or listening test comparing these three for Marathi, and Sarvam publishes no current Marathi WER for `saaras:v4`. Its only published score is for retired `saaras:v2.5` speech translation: a COMET score of 88.41% for "9 other languages" on Vistaar plus IndicVoices (a vendor claim; [Saaras](https://docs.sarvam.ai/api/api-guides-tutorials/models/saaras)). AI4Bharat's Vistaar and IndicVoices benchmarks weren't read. Quality is therefore a kick-off test, as idea.md already plans.

**Not compared:** Bhashini, AI4Bharat's open models, ElevenLabs, OpenAI and Deepgram weren't researched.

## Install and setup

- **Sarvam:**
  - Sign up at the [dashboard](https://indus.sarvam.ai/key-management), verify, and create a key by hand; it's shown only once ([authentication](https://docs.sarvam.ai/api-reference/authentication)).
  - Send it as `api-subscription-key: <key>`, or as `Authorization: Bearer <key>`.
  - JS SDK: `npm install sarvamai`, then `new SarvamAIClient({ apiSubscriptionKey })`.
  - Errors: a bad key returns `403 invalid_api_key_error`, not 401; empty credits return `402 insufficient_quota_error` ([pricing](https://docs.sarvam.ai/api/getting-started/pricing)).
- **Azure:**
  - Create a Speech resource on the free F0 tier.
  - The server can swap the resource key for an access token at the `issueToken` endpoint, "valid for 10 minutes" ([short-audio REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)). That token could go to the browser instead of the key (inferred).
- **Google:** a Cloud project with billing enabled.
- **Keys:** a new name in `.env.example` (for example `SARVAM_API_KEY`), with the value in `.env.local`, held by Pata's one small server (CLAUDE.md, Stack).

## What Pata uses

**Flow 1: the household speaks the way to its door (moment 1; P0 spoken input, P1 Marathi).**
- The phone records with MediaRecorder and uploads the clip to Pata's server, which calls the STT API with the key. Sarvam's docs say "Never expose your API key in ... client-side code" ([authentication](https://docs.sarvam.ai/api-reference/authentication)), so the static PWA can't call it directly.
- What the phones record:
  - **Android Chrome:** WebM with Opus (inferred from MDN's `isTypeSupported` examples, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)).
  - **iOS Safari:** MP4 with AAC since Safari 14.1 ([WebKit](https://webkit.org/blog/11353/mediarecorder-api/)), and WebM with Opus since Safari 18.4 ([WebKit 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)).
  - Sarvam accepts both as they are.
- **Sarvam call:** `POST https://api.sarvam.ai/speech-to-text`, multipart, with:
  - `file`: the clip;
  - `model=saaras:v4`;
  - `mode=codemix`;
  - `language_code=mr-IN` or `hi-IN`, or omit it for auto-detect;
  - optionally `keyterms`: up to 50 terms of 64 characters each, `saaras:v4` and REST only, to bias recognition toward generic locality words such as "Dharavi" ([REST guide](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api)).
- **Length:** clips must be 30 s or less.
- **Room number:** it never goes into the audio or the keyterms. The screen asks the household not to say it aloud (inferred from CLAUDE.md's invariant).

**Flow 2: directions spoken to the courier in the courier's language (moment 2; P0 "Courier view with Hindi audio").**
- **When to synthesize:** at setup, on the server, once per language. The compressed clip goes inside the encrypted grant payload on Arkiv, which has a 128 KiB cap. The courier link then plays audio with no TTS call, so it still works with our server switched off, as the CROPS video promises (inferred).
- **Sarvam call:** `POST https://api.sarvam.ai/text-to-speech`, JSON:
  `{ "text": …, "language_code": "hi-IN", "model": "bulbul:v4-flash", "speaker": "aditya_hi_conversational", "output_audio_codec": "mp3", "speech_sample_rate": 16000 }`
  - The response is base64 in `audios[]` ([TTS reference](https://docs.sarvam.ai/api-reference/text-to-speech/convert)).
  - Up to 2,500 characters a request.
  - `opus` "currently returns a validation error", so use `mp3`.
  - There's no bitrate parameter.
- **Script:** write Indic words in native script, since "Romanised Indic input degrades quality" ([Bulbul](https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul)).
- **Room number:** the TTS text leaves it out. The courier view shows it as text from the decrypted payload (inferred from the invariant).
- **Offline demo kit:** the same MP3 clips, saved.

**Fallback: the browser's own speech (Web Speech API, free).**
- **Recognition in Chrome:** `SpeechRecognition` ships in Chrome (prefixed since 33, unprefixed since 139), and Chrome Android mirrors desktop. Safari has `webkitSpeechRecognition` since 14.1, and iOS mirrors it ([browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json)).
- **Languages in Chrome:** Chrome's own demo lists both `mr-IN` and `hi-IN` ([Chrome demo](https://www.google.com/intl/en/chrome/demos/speech.html)).
- **Where the audio goes:** "On some browsers, like Chrome, … Your audio is sent to a web service for recognition processing, so it won't work offline" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)), meaning Google's servers (inferred).
- **On-device recognition:** `processLocally = true` keeps audio on the device, but browser-compat-data marks it "no" for Chrome Android and Safari, so it isn't available on the demo phones ([MDN guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)).
- **iOS:** Apple's iOS 27 Dictation list includes Hindi (India) but not Marathi ([Apple](https://www.apple.com/ios/feature-availability/)). Safari's recognition presumably follows that list (inferred), so on iPhone, Marathi is out and Hindi may work.
- **Synthesis:** `speechSynthesis` exists on both platforms. iOS 27 lists Marathi and Hindi under "VoiceOver, Live Speech, Read & Speak" ([Apple](https://www.apple.com/ios/feature-availability/)). Whether Safari exposes those voices to `getVoices()` is a kick-off test.
- **Remote voices:** `SpeechSynthesisVoice.localService` is false for voices "supplied by a remote speech synthesizer service" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)). Speak the room number only with a local voice, or not at all.

## Limits

- **Sarvam STT:**
  - REST takes 30 s per request; Batch takes up to 2 h a file.
  - The WebSocket takes WAV or raw PCM only.
  - Pay-as-you-go allows 60 REST requests a minute ([STT overview](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview), [pricing](https://docs.sarvam.ai/api/getting-started/pricing)).
- **Sarvam TTS:** 2,500 characters a request, 60 requests a minute, no SSML ([Bulbul](https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul)).
- **Azure REST short audio:** 60 s, WAV/PCM or OGG/Opus only ([short-audio REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)).
- **Hackathon cost on Sarvam (inferred):**
  - STT: 60 minutes of test speech costs about ₹29.
  - TTS: 50 setups × 3 languages × 400 characters is 60,000 characters, about ₹60 on `bulbul:v4-flash`.
  - Together that's about ₹89 of the ₹100 free credits, so a ₹100–200 top-up is a sensible buffer.
  - Azure F0 and Google's free monthly usage would each cost $0 at this volume.

## Gotchas

- **30-second cap:** a household that talks longer gets a `422` from Sarvam. Stop recording at about 28 s.
- **Speaker IDs:** Bulbul v4 Flash speakers are persona IDs (`<name>_<language>_<style>`), and the v3 default `shubh` is invalid on it ([Bulbul](https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul)).
- **Bulbul v3:** it's still the API default when `model` is omitted, and it reaches end of life on Sarvam's Voice Agents product on 10 Nov 2026 ([docs index](https://docs.sarvam.ai/llms.txt)). Always set `model` explicitly.
- **Audio size:** WAV won't fit in an Arkiv entity. 20 s of 22,050 Hz 16-bit mono is about 880 KB against the 128 KiB cap (inferred arithmetic). Use MP3 at 16 kHz and measure it.
- **Production rights:** Sarvam's free credits count as payment for its Production License, so generated audio can ship ([commercial licensing](https://docs.sarvam.ai/api/getting-started/commercial-licensing)).
- **Recorded formats:** Azure's short-audio REST API rejects both phones' default recordings (inferred from its format list), so using it means transcoding to WAV, for example with an `AudioWorklet`.
- **Submission video:** ETHGlobal bans AI voiceover ([research.md](../../research.md)), so a person narrates and the Hindi clip plays only as the app's output.

## Values to copy

| Name | Value | Source |
|---|---|---|
| Sarvam STT endpoint | `POST https://api.sarvam.ai/speech-to-text` (multipart) | [Saaras](https://docs.sarvam.ai/api/api-guides-tutorials/models/saaras) |
| Sarvam STT model and mode | `saaras:v4`, `codemix` | same |
| Language codes | `mr-IN`, `hi-IN`, `en-IN` | same |
| Sarvam TTS endpoint | `POST https://api.sarvam.ai/text-to-speech` (JSON) | [TTS reference](https://docs.sarvam.ai/api-reference/text-to-speech/convert) |
| Sarvam TTS model | `bulbul:v4-flash` | same |
| Hindi voice (example) | `aditya_hi_conversational` | [voices](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices) |
| Marathi voice (example) | `ishita_mr_conversational` | same |
| Sarvam TTS codec | `mp3` (not `opus`) | [TTS reference](https://docs.sarvam.ai/api-reference/text-to-speech/convert) |
| Sarvam auth header | `api-subscription-key` | [authentication](https://docs.sarvam.ai/api-reference/authentication) |
| Sarvam limits | STT REST 30 s; TTS 2,500 chars | [REST guide](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api), [Bulbul](https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul) |
| Azure voices | `mr-IN-AarohiNeural`, `mr-IN-ManoharNeural`, `hi-IN-SwaraNeural` | [language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) |
| Google STT model | `chirp_3` (V2, `us` or `eu`) | [V2 languages](https://cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages) |
| Browser recognition langs | `mr-IN`, `hi-IN` | [Chrome demo](https://www.google.com/intl/en/chrome/demos/speech.html) |

## Recommendation (a recommendation, not a decision)

- **P0:**
  - Typed input always works.
  - Spoken Hindi goes through Sarvam `saaras:v4` (`codemix`) from Pata's server.
  - Courier audio in Hindi comes from Sarvam `bulbul:v4-flash`, synthesized at setup as MP3 and stored in the encrypted payload.
  - Reasons: Sarvam takes both phones' recordings without transcoding, handles code-mixing, and fits the ₹100 free credits.
- **P1:** spoken Marathi through the same call with `mr-IN`, if it passes the kick-off test. Otherwise the demo uses Hindi, as idea.md says.
- **Fallbacks, in order:**
  1. Azure F0, the strongest data terms and $0: real-time audio isn't stored. It needs WAV transcoding in the browser, and the server hands out 10-minute tokens.
  2. Android Chrome's `SpeechRecognition` with `mr-IN`: free, but the audio goes to Google, and the README must say so.
  3. The offline kit's pre-recorded clips.
- **Before using Sarvam:** set its content retention as low as the dashboard allows, and grant no training consent.

## Contradictions with idea.md

- **The CROPS "P" list omits the speech provider.** idea.md says "The model provider and OpenStreetMap's search see the spoken address and its locality once, at setup." The speech provider is a further third party: it receives the household's voice recording and the directions text. Sarvam keeps "Your Content (Inputs/Outputs)" for "default: 30 days after last access" ([privacy policy](https://www.sarvam.ai/privacy-policy)). The README has to name it.
- **The no-trackers rule names one exception, not two.** idea.md says "The setup-time AI and map-search calls are the one exception, and the README names them." Speech-to-text and text-to-speech calls are a second exception. They can stay setup-time only if courier audio is pre-generated, as recommended here.
- **A browser fallback would reach Google.** idea.md's fallback for weak Marathi recognition is "fall back to Hindi or typing". If instead the browser's `SpeechRecognition` is used, Chrome sends the audio to a server ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)), another party the CROPS section would have to list.

## Test at kick-off

- [ ] Marathi recognition, idea.md's own test: five Marathi and five Hindi door descriptions, with English mixed in, through Sarvam `saaras:v4` `codemix`, and through Azure F0 for comparison. Read the transcripts.
- [ ] Android Chrome's WebM/Opus and iOS Safari's MP4/AAC clips are accepted by Sarvam unchanged.
- [ ] A 20-second Hindi `bulbul:v4-flash` MP3 at 16 kHz is under 128 KiB after encryption, and plays on both phones.
- [ ] Sarvam latency for a 25-second clip (STT) and 400 characters (TTS); none is published.
- [ ] Sarvam's dashboard: the lowest content-retention setting, and no training consent ticked.
- [ ] Azure: paid prices in the portal; whether the Speech SDK in the browser accepts compressed input, or WAV transcoding is needed.
- [ ] Web Speech API on the demo phones: `SpeechRecognition` with `mr-IN` and `hi-IN` on Android Chrome and iOS Safari; `speechSynthesis.getVoices()` for Marathi and Hindi voices, and their `localService` values.
- [ ] Google's Chirp 3 code-switching and accepted formats, only if Sarvam and Azure both fail.
- [ ] Independent Marathi benchmarks (AI4Bharat's Vistaar or IndicVoices) weren't read; rely on our own test.
