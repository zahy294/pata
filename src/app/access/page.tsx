"use client";
// "Who can find my door" — the live-access list (P1-2, revoke button from P0-12). Owner: frontend.
// Data: listLiveGrants (src/lib/arkiv). Each row: requester, purpose, a countdown to grantEnd,
// and "Stop access" → revokeGrant (src/lib/flows/revoke.ts). Poll every few seconds: Arkiv emits no
// expiry event, so the list empties only when we query again (arkiv.md Gotcha 3).
export default function AccessPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Who can find my door</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P1-2).</p>
    </main>
  );
}
