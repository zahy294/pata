# Directions audio is made once at setup, as its own record type

The payload needs spoken directions in the requester's language, and the pitch says the speech provider sees the directions only once, at setup. At setup, the app writes the directions text in Hindi, Marathi and English into the home record. It also makes one clip of about 20 seconds per language with Sarvam (`bulbul:v4-flash`, MP3 at 16 kHz). Each clip is its own Arkiv entity of a fourth type, `pata.voice.v1`, encrypted to the household and living as long as the home record. Three clips can't share the home record, because an Arkiv entity's bytes are capped at 128 KiB. At approval, the app copies the clip in the requester's language into the payload, encrypted with the session key, so approving needs no server.

## Considered options

- **Make the audio at approval, in one language:** rejected. Sarvam would see the directions at every grant, and approving would need our server.
- **Text only, read aloud by the courier's browser (`speechSynthesis`):** kept as the fallback when Sarvam fails. Android's voices may send text to Google, and quality varies.

## Consequences

- Sarvam returns MP3 with no bitrate setting, and Cloudflare Workers' free CPU budget can't transcode. If a 20-second clip is over 128 KiB after encryption (measured in hour 0), the text gets shorter or the sample rate drops. The audio isn't transcoded.
- Each grant writes roughly 100 KB to Arkiv, which the relay's top-up targets include.
- Source: `docs/research/speech.md`, `docs/research/arkiv.md`.
