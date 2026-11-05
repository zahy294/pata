"use client";
// Public lookup (P0-13, P1-1). Owner: frontend; reads in src/lib/ens/lookup.ts.
// A household name → only its locality ("Dharavi, 400017").
// A grid name (39j49ll8t4.digipin.eth) → the cell centre on the map, with nothing registered (P1-1).
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RpcReadReport } from "../../lib/rpc/diagnostics";

export default function LookupPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Look up a name</h1>
      <p className="mt-2 text-sm text-neutral-600">Not built yet (P0-13).</p>
      <Suspense fallback={null}>
        <RpcDiagnostics />
      </Suspense>
    </main>
  );
}

function RpcDiagnostics() {
  const debug = useSearchParams().get("debug") === "1";
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<RpcReadReport | null>(null);
  const [error, setError] = useState("");

  async function runChecks() {
    setRunning(true);
    setReport(null);
    setError("");
    try {
      const { runRpcReadChecks } = await import("../../lib/rpc/diagnostics");
      setReport(await runRpcReadChecks());
    } catch {
      setError("Private RPC checks could not run. Check the public RPC configuration and try again.");
    } finally {
      setRunning(false);
    }
  }
  if (!debug) return null;
  return (
    <section className="mt-6 space-y-3 border-t pt-4" aria-label="RPC diagnostics">
      <h2 className="font-semibold">Private RPC diagnostics</h2>
      <p className="text-sm">
        Read-only checks through Nox. No wallet is needed and no transactions are sent.
      </p>
      <button
        className="min-h-11 rounded border px-4 disabled:opacity-50"
        disabled={running}
        onClick={runChecks}
      >
        {running ? "Checking private RPC…" : "Run private RPC read checks"}
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <pre data-testid="rpc-read-report" className="overflow-auto whitespace-pre-wrap text-xs">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
      <p className="text-sm">
        Phone verification and five write-latency samples per chain remain manual checks after deployment and
        funding. Never put a development private key in browser config.
      </p>
    </section>
  );
}
