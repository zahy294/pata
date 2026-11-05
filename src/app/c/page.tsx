"use client";
// Courier view (P0-11). Owner: frontend; checks in src/lib/flows/courier.ts.
// One static route; everything secret is in the "#" part, which browsers never send (ADR 0006).
// On load (in useEffect, never during prerender):
//   1. read location.hash, save it to sessionStorage, history.replaceState to drop the "#";
//   2. show the locality at once;
//   3. checkCourierLink on load and every few seconds;
//   4. live → map with the pin, directions text, the audio clip (components/AudioPlayer);
//      ended → only the locality, sessionStorage cleared; invalid → "This link doesn't work".
// Must work on a slow 4G phone (hour-0 test): locality first, the pin once the ENS check passes.
export default function CourierPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Delivery directions</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P0-11).</p>
    </main>
  );
}
