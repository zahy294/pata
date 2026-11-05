// Home. Owner: frontend.
// Signed out: "Set up your home" (→ /setup). Signed in: the household name, its locality, and
// links to the live-access list and history. No crypto words anywhere in the UI (idea.md, Usability).
import Link from "next/link";

const screens = [
  { href: "/setup/", label: "Set up a household", ticket: "P0-7, P0-8" },
  { href: "/approve/", label: "Approve a request (consent screen)", ticket: "P0-10" },
  { href: "/access/", label: "Who can find my door", ticket: "P1-2" },
  { href: "/history/", label: "History", ticket: "P1-2" },
  { href: "/lookup/", label: "Look up a name", ticket: "P0-13, P1-1" },
  { href: "/seller/", label: "Mock seller", ticket: "P1-5" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Pata</h1>
      <p className="mt-1 text-sm text-neutral-600">Your door, shared only by consent.</p>
      <ul className="mt-6 space-y-2">
        {screens.map((s) => (
          <li key={s.href}>
            <Link className="underline" href={s.href}>
              {s.label}
            </Link>{" "}
            <span className="text-xs text-neutral-500">{s.ticket}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
