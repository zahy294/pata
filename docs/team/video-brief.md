# Video brief: what Pata is now, and what changed on 2026-11-06

For whoever makes the submission video. Everything here is on `main`; commit hashes point at the change (`git show <hash>`). The [README](../../README.md) has the full how-it-works and the honest claims, so use its wording when in doubt.

**Video rules (ETHGlobal):** 2:45–3:00, narrated by a person (no AI voice), at most 4 bullets a slide. The three moments from `idea.md`: **Marathi in, Hindi out**, **the key that dies on stage**, **a trillion names**.

## The story in one breath

A household in Dharavi says how to reach their door. Pata turns that into a pin, a DIGIPIN and spoken directions in three languages, and gives the home an ENS name like `white-gate.pata.eth`. Strangers see only "Dharavi, 400017". A courier gets a link that opens the exact door until the grant expires, and the page then switches to "This link has ended" by itself. Everything exact is encrypted on Arkiv, and the courier's phone reads the chains through a mixnet (Anon-RPC).

## What to film (it works today, on phones)

1. **Setup** (`/setup`, about 2 min, so speed it up in the edit):
   - Speak the way in Hindi, saying the area and PIN code.
   - The room number goes in its own box ("Stays on this phone").
   - Three landmark pins appear (Dharavi works best), with a 10-character DIGIPIN.
   - Play the three voice clips.
   - Pick a name, then **Save & Finish**; the progress list ticks through.
2. **Lookup** (`/lookup`): type the name, and only "Dharavi, 400017" shows.
3. **Consent** (`/approve`): "Make a test request" with a requester, purpose, language and **20 seconds**, then approve. Show the notice "Anyone with this link can find your door until it ends", then the QR code and share sheet.
4. **Courier** (second phone): the locality first, then the door (room, written address, DIGIPIN, map, Hindi audio). Then **"This link has ended"**, which is the key dying on stage.

**Filming tips:**

- **Both phones on mobile data.** Some Wi-Fi networks block the mixnet, and lookups and the courier page then stall (a Wi-Fi network did this on 2026-11-06).
- **Open `/c` once on the courier phone before recording,** so the first load is warm: 10–13 s instead of about 35 s.
- **A 20 s grant really lives about 50 s** (20 s plus a 30 s margin for slow networks), and approval takes 20–40 s of that. Open the link right away. Use a 15-minute grant for the calm walkthrough shots.
- **Expect a drop pin outside Dharavi and BKC.** Other areas usually get a hand-dropped pin ("tap the map where your door is").

## Architecture for a slide

```text
Household phone ──signed──▶ Worker (Claude, Sarvam, OSM search, gas relay, name registration)
   ├─ ENSv2 Sepolia: household name, resolver (locality only), grant registry
   └─ Arkiv Rabdi: encrypted home, voice clips, grant payload + audio, history
Courier phone ──Anon-RPC mixnet──▶ ENS "is the grant live?" ──▶ Arkiv payload, decrypted with the key in the link
```

- **Names:** ENSv2 on Sepolia. `pata.eth`'s registry is emancipated and its pointer is **locked**: the lock transaction `0x1269…3d8d` revoked our own power to swap the registry, so Pata can't take names back.
- **Grants:** random 8-character subnames, owned by an address derived from a one-time session key, expiring on chain (ADRs 0002, 0004).
- **Courier link:** the secret is after `#`, so it never reaches any server, and the page strips it from the address bar (ADR 0006).
- **AI:** Haiku 5.5 extracts the area and landmarks; Sonnet 5.5 picks landmarks only from real OpenStreetMap features and writes directions. Plain code computes pins and DIGIPINs; the model only proposes.
- **Speech:** Sarvam `saaras:v4` in, `bulbul:v4-flash` out as AAC.
- **Honest claim** (ADR 0005): expiry stops honest apps from showing the door; it can't make anyone unsee it.

## Decisions and fixes from today's phone runs (good "what we learned" material)

| What happened                                                                                        | Decision                                                                                                                                                                                  | Commits                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| The screens were still running on fake data                                                          | Switched setup, consent and courier to the real flows and deleted the fake ones                                                                                                           | `3c3062a`, `b38c281`, `40cf34b`, `55b652c` |
| Sarvam's MP3 is a fixed 128 kbps: a 20 s clip is about 340 KB, more than an Arkiv entity's 128 KiB   | Switched to 8 kHz AAC (about 100 KB), and each grant's clip became its own Arkiv entity (**ADR 0009**)                                                                                    | `f3f30fe`, `9130132`, `bb89c46`            |
| First real setup: the second contract deploy reused a nonce on the load-balanced RPC and was dropped | The deploys now get explicit nonces                                                                                                                                                       | `bcb98bf`                                  |
| A full-size Arkiv write costs about 0.013 tGLM; the 0.02 top-up paid for one voice clip out of three | The relay tops up 0.1 tGLM, and the app asks for gas before each Arkiv batch                                                                                                              | `1864df7`                                  |
| AI calls failed for a phone on its mobile network                                                    | Logs showed Anthropic answering **403 forbidden** to calls from Cloudflare's **Hong Kong** data centre (Singapore worked). The Worker now always runs in a **US region** (placement hint) | `7a5260a`                                  |
| Occasional unusable or refused model replies                                                         | One SDK retry, a second attempt (extraction falls back to Sonnet), the app retries up to 3 times, and failure logs record only the error category, never the content                      | `49649af`, `e643253`, `ffeea05`, `6122816` |
| "Bandra 400098" put the map in **Bihar**, and BKC's PIN didn't match OpenStreetMap                   | Fall back to the PIN code's centre; a name match without a postcode must be within 15 km of the PIN                                                                                       | `ef64a9a`, `6e16c00`, `ac4ac81`            |
| The drop pin was stuck inside the demo area, and only draggable                                      | Tap the map to place the pin, any area works, and the map opens at street level                                                                                                           | `5a966af`, `6f9293b`, `7cfacd5`            |
| The courier page spun forever on a phone                                                             | Checks overlapped (one every 3 s, each 10–20 s through the mixnet), and the door waited for the 115 KB audio. Now one check at a time, the door shows first and the audio follows         | `3be9048`, `f3a4051`                       |
| A Wi-Fi network blocked the mixnet                                                                   | Documented; test and demo on mobile data; the courier page says so after 3 failed checks                                                                                                  | `3be9048`                                  |
| Recordings that ran the full 30 s were always rejected                                               | The recorder stops at 28 s, and errors now say why                                                                                                                                        | `2240b38`                                  |

**Also today:**

- the `pata.eth` lock;
- the README rewrite (`cf0a282`);
- phone results recorded in `docs/plans/P0-3.md`;
- `main` frozen for P1 (`docs/team/p1-branching.md`).

## Don't claim

- **Expiry as encryption.** Use ADR 0005's wording: it stops honest apps; it can't make anyone unsee.
- **Spoken Marathi input.** It's P1-7; Marathi works as **output** (directions and voice). For "Marathi in, Hindi out", film Marathi _output_, or say Marathi input is next.
- **Revoke.** The flow exists, but the button (P1-2) isn't built; show expiry instead.
- **Passkeys and the IPFS pin.** Neither is done yet.
- **That nothing leaks.** The README's CROPS section lists who sees what: Claude and Sarvam see the spoken way, map tiles see the area, the chains show labels and timing.
