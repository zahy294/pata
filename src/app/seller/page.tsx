"use client";
// Mock seller (P1-5). Owner: frontend. Clearly labelled as a mock in the UI and the README.
// A WhatsApp-style order confirmation that asks for the address: builds a GrantRequest and opens
// /approve#<base64url JSON>. P1-5 also gives the seller an ENS name with ENSIP-26 records
// (agent-context, agent-endpoint[web]) and a "prove you hold the grant" signature check.
export default function SellerPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Mock seller</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P1-5).</p>
    </main>
  );
}
