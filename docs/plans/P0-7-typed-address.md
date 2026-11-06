# P0-7: typed address and phone location replace the recorder

2026-11-06 evening, after the OnePlus setup run. Decision: [ADR 0011](../adr/0011-setup-takes-a-typed-address-and-the-phone-location.md).

## Plan

1. `describeTypedAddress` (flow): locality name, PIN code, optional landmark and door notes → way to the door, locality and landmark phrases. Plain code, with plain-sentence problems for the screen.
2. `locateHome` and `locateHomeError` (flow): one fresh high-accuracy geolocation reading. Refuse fixes outside the DIGIPIN grid; give a sentence per failure that points to the landmark field.
3. Setup screen: remove the recorder, the language picker and the second area/PIN box. Add the location button and the four fields. With a fix, open the pin screen with no candidates and the hand-dropped pin at the fix. Without one, call `findCandidatePins` as before.
4. `PinPicker`: an optional `fromLocation` flag, so the no-candidate card doesn't claim a landmark search failed.

## Checks

- Unit: `typed-address.test.ts` (16 cases).
- Browser, against the live Worker with a faked location (Playwright, 390×844 touch):
  - GPS path: the pin lands on the fix, and `/address/directions` is the only Worker call; directions came back in three languages with three play buttons.
  - No-permission path: the location message offers the landmark field; `/address/rank` answered 200 in 9 s and showed candidates.
  - A pasted "400 017" first became "40001": `maxLength` cut it before the space was stripped. Fixed by keeping the first 6 digits.
- Not yet done: a phone run through to saving.

## Follow-up: fill the area and PIN code from the location (ADR 0012)

- `scripts/build-locality-table.mjs` builds `src/lib/locality/mumbai.json` from two Overpass extracts: 192 suburbs, 174 PIN codes, 6,335 cells.
- `nearestLocality` (pure, tested) and `suggestLocality` (flow, loads the table lazily). The screen fills only empty fields and says so.
- Leave-one-out on the table's own cells: 5 voters within 1.5 km were right 86% of the time (1 voter: 83%).
- Playwright with faked fixes: Dharavi → "Dharavi, 400017"; BKC with an area already typed keeps it and fills 400051; Delhi fills nothing. No outside request in any of the three.
