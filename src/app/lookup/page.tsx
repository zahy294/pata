"use client";
// Public lookup (P0-13, P1-1). Owner: frontend; reads in src/lib/ens/lookup.ts.
// A household name → only its locality ("Dharavi, 400017").
// A grid name (39j49ll8t4.digipin.eth) → the cell centre on the map, with nothing registered (P1-1).
export default function LookupPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Look up a name</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P0-13).</p>
    </main>
  );
}
