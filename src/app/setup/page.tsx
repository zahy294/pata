"use client";
// Set up a household (P0-7, P0-8, P0-9). Owner: frontend; logic in src/lib/flows/setup-household.ts.
// Steps on screen:
//   1. Sign in (P0: device key; P1-3: passkey).
//   2. "How do people find your door?" Record (components/Recorder) or type, pick hi/mr/en.
//      A separate typed field for the room or flat number, labelled "stays on this phone".
//   3. Map with up to 3 candidate pins (components/PinPicker), each with its landmark and confidence.
//      No candidates → a map on the locality for a hand-dropped pin. "We're not sure" banner (P1-6).
//   4. Confirm or drag → DIGIPIN shown (formatDigipin).
//   5. Directions in the three languages, with play buttons.
//   6. Pick a name: a two-word suggestion or her own (after a warning), with an availability check.
//   7. Progress while the name, records and clips are created. Then home.
export default function SetupPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Set up your home</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P0-7, P0-8).</p>
    </main>
  );
}
