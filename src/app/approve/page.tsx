"use client";
// Consent screen (P0-10). Owner: frontend; logic in src/lib/flows/approve-grant.ts.
// The request arrives as /approve#<base64url JSON GrantRequest> (from the mock seller, P1-5, or typed in).
// Shows: who is asking (and their agent-context in P1-5), the purpose, the courier's language, the duration,
// and in plain words: "Anyone with this link can find your door until it ends." (ADR 0006).
// Approve → share sheet (navigator.share) + QR code (components/QrCode) of the courier link.
// The stage grant is 20 seconds.
export default function ApprovePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Someone is asking for your address</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P0-10).</p>
    </main>
  );
}
