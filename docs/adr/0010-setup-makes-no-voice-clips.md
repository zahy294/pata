# Setup makes no voice clips; the phone's own voice reads the directions

## Context

ADR 0007 made three Sarvam clips at setup, and ADR 0009 stores each one as its own Arkiv entity of about 100 KiB.
On the OnePlus 11 over mobile data on 2026-11-06, setup stopped while saving the voice clips. Household `0x732738bcD04989F481643a9aA0D836A3091D50B5` holds two `pata.voice.v1` entities, no home record, and 0.074 tGLM, so gas wasn't the cause: the third ~100 KiB write through the mixnet never landed.
The clips also cost latency before that point: three sequential `/speech/out` calls on the directions screen, then three large writes, and one more large write at every approval.

## Decision

`makeDirections` returns only the directions text. Setup makes no clips and no voice records, so approval makes no grant-audio entity (ADR 0009's path is skipped when the home has no voice key). The setup and courier screens read the text aloud with the phone's `speechSynthesis`, ADR 0007's fallback. `createHousehold` still stores any clips it's given, so households made earlier keep theirs, and their grants still carry a clip.

## Considered options

- **Make the clip on the courier's phone after it reads the payload:** possible later. It would send the directions to Sarvam through our Worker at every link opening, not once per household, and it adds a server call to a page that otherwise only reads chains.
- **Keep the clips but retry the stalled write:** it would fix the failure, not the latency.

## Consequences

- Setup writes one Arkiv entity, not four, and approval one batch, not a clip plus a batch.
- Sarvam no longer sees the directions. Android's text-to-speech engine may send the text to Google if the language's voice isn't on the phone, and quality depends on the phone's voices.
- A phone without a Hindi or Marathi voice reads the text badly or not at all; the text stays on screen either way.
- ADR 0009 now applies only to households made before this change.
