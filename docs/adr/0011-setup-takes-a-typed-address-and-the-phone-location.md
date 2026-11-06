# Setup takes a typed address and the phone's location, not a recording

## Context

Setup asked the household to speak or type one free-form "way to the door". Sarvam transcribed the recording, and Haiku pulled the area, PIN code and landmark phrases out of the text. When it missed the area or PIN, a second box asked for them. On phones, that meant a 28-second recording limit, two model calls before the map, and a retry whenever the extraction came back incomplete. ADR 0010 already removed speech from the directions, so the recording was the last use of Sarvam in setup.

## Decision

The setup screen has typed fields: area and PIN code (the public locality), an optional nearby landmark, and how to find the door. `describeTypedAddress` builds the way to the door, the locality and the landmark phrase from them in plain code, with no model call. A "Use my current location" button reads the phone's position (`locateHome`). With a fix, the pin screen starts a hand-dropped pin there and skips the landmark search. Without one, the landmark and locality go to the landmark search as before. The household moves the pin onto the door either way.

## Considered options

- **Keep the recorder beside the fields:** the recording path needs Sarvam, a model call and its own error states. That's worth it only if typing is a real barrier, and spoken Marathi (P1-7) was never finished.
- **Reverse-geocode the location to fill in the area and PIN code:** it would send the exact position to a map service, which the invariants forbid.

## Consequences

- Setup reaches the pin screen with no server call when the phone has a fix, or with one call (`/address/rank`) when it doesn't.
- With a fix, the position goes only to `/address/directions` with the confirmed pin, as every pin already did. Map search never sees it.
- Sarvam and the Haiku extraction are no longer used by any screen. `describeTheWay`, `Recorder` and the speech routes stay in the code, unused.
- Indoor GPS can be tens of metres off, so the household still has to move the pin.
- P1-7 (spoken Marathi input) has no screen to plug into.
