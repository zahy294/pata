"use client";
// Public lookup (P0-13, P1-1). Owner: frontend; reads in src/lib/flows/lookup.ts.
// A household name → only its locality ("Dharavi, 400017").
// A grid name (39j49ll8t4.digipin.eth) → the cell centre on the map, with nothing registered (P1-1).
import { Suspense, useState } from "react";
import MorphLoader from "../../components/MorphLoader";
import { useSearchParams } from "next/navigation";
import { lookupHousehold } from "../../lib/flows/lookup";
import { formatDigipin, isValidDigipin, toGridLabel } from "../../lib/digipin";
import { GRID_NAME, PROVIDER_NAME } from "../../../shared/constants";
import type { Locality } from "../../../shared/domain";
import type { RpcReadReport } from "../../lib/rpc/diagnostics";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "household"; name: string; locality: Locality }
  | { kind: "grid-coming-soon"; gridName: string; digipinDisplay: string }
  | { kind: "not-found"; query: string }
  | { kind: "error"; message: string };

function extractDigipinCandidate(input: string): string | null {
  const trimmed = input.trim();
  const gridSuffix = `.${GRID_NAME}`;
  if (trimmed.toLowerCase().endsWith(gridSuffix)) {
    const label = trimmed.slice(0, -gridSuffix.length);
    return isValidDigipin(label) ? label : null;
  }
  return isValidDigipin(trimmed) ? trimmed : null;
}

export default function LookupPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupState>({ kind: "idle" });

  const runLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Check if the input is a 10-character DIGIPIN or `<10-char>.digipin.eth` grid name
    const digipinCode = extractDigipinCandidate(trimmed);
    const gridSuffix = `.${GRID_NAME}`;
    if (
      digipinCode &&
      (trimmed.toLowerCase().endsWith(gridSuffix) ||
        !trimmed.toLowerCase().endsWith(`.${PROVIDER_NAME}`))
    ) {
      const gridLabel = toGridLabel(digipinCode);
      setResult({
        kind: "grid-coming-soon",
        gridName: `${gridLabel}.${GRID_NAME}`,
        digipinDisplay: formatDigipin(digipinCode),
      });
      return;
    }

    setResult({ kind: "loading" });
    try {
      const locality = await lookupHousehold(trimmed);
      if (!locality) {
        setResult({ kind: "not-found", query: trimmed });
        return;
      }
      const suffix = `.${PROVIDER_NAME}`;
      const normalized = trimmed.toLowerCase();
      const fullHouseholdName = normalized.endsWith(suffix)
        ? normalized
        : `${normalized}${suffix}`;
      setResult({
        kind: "household",
        name: fullHouseholdName,
        locality,
      });
    } catch {
      setResult({
        kind: "error",
        message: "Could not look up that name right now. Please tap Retry.",
      });
    }
  };

  return (
    <main className="pata-lookup-page flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-1">
        <span className="inline-flex self-start items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
          Public Directory
        </span>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
          Look up a name
        </h1>
        <p className="text-sm text-[#6E655A]">
          Enter a home&apos;s name (like{" "}
          <span className="font-mono font-semibold text-[#1F1C18]">
            blue-gate
          </span>{" "}
          or{" "}
          <span className="font-mono font-semibold text-[#1F1C18]">
            blue-gate.{PROVIDER_NAME}
          </span>
          ) or a 10-character DIGIPIN grid code.
        </p>
      </div>

      {/* Search Form */}
      <form
        onSubmit={(e) => void runLookup(e)}
        className="flex flex-col gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm"
      >
        <label
          htmlFor="lookup-input"
          className="text-xs font-bold tracking-wider text-[#6E655A] uppercase"
        >
          Home Name or Grid Code
        </label>
        <div className="flex gap-2">
          <input
            id="lookup-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`blue-gate.${PROVIDER_NAME} or 39J 49LL 8T4`}
            className="min-w-0 flex-1 rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2.5 font-mono text-sm text-[#1F1C18] placeholder-[#8C8275] focus:border-[#046A38] focus:outline-none"
          />
          <button
            type="submit"
            disabled={result.kind === "loading" || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-2.5 text-sm font-semibold text-[#FFFDF9] shadow-xs transition hover:bg-[#03562D] disabled:opacity-50"
          >
            {result.kind === "loading" ? <><MorphLoader />Searching…</> : "Look up"}
          </button>
        </div>
      </form>

      {/* Loading */}
      {result.kind === "loading" && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 text-sm text-[#1F1C18] shadow-xs">
          <MorphLoader size={24} color="#046A38" />
          <span>Looking up public neighbourhood record…</span>
        </section>
      )}

      {/* Household Result: Locality Only + Privacy Sentence */}
      {result.kind === "household" && (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E6DAC6] pb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Home Name
              </p>
              <p className="font-mono text-base font-bold text-[#1F1C18]">
                {result.name}
              </p>
            </div>
            <span className="rounded-full bg-[#E3F2E8] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#046A38] uppercase">
              Locality Only
            </span>
          </div>

          <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-4">
            <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
              Public Locality
            </p>
            <p className="mt-1 font-serif text-xl font-bold text-[#1F1C18]">
              {result.locality.name}, {result.locality.pinCode}
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-[#F5EBDC] p-3.5 text-[#1F1C18]">
            <span className="text-base" aria-hidden="true">
              🔒
            </span>
            <p className="text-sm font-semibold leading-snug">
              Only people you give a link to can see the door.
            </p>
          </div>
        </section>
      )}

      {/* Grid Name / 10-character DIGIPIN Result (P1-1 coming soon) */}
      {result.kind === "grid-coming-soon" && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-[#1F1C18]">
              {result.gridName}
            </span>
            <span className="rounded-full bg-[#F9EFDB] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#8A5F14] uppercase">
              Coming soon
            </span>
          </div>
          <p className="font-mono text-base font-bold text-[#046A38]">
            {result.digipinDisplay}
          </p>
          <p className="text-xs leading-relaxed text-[#6E655A]">
            Grid name resolution on the map is coming soon.
          </p>
        </section>
      )}

      {/* Not Found */}
      {result.kind === "not-found" && (
        <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 text-sm text-[#6E655A] shadow-xs">
          No registered home found for{" "}
          <span className="font-mono font-semibold text-[#1F1C18]">
            {result.query}
          </span>
          .
        </section>
      )}

      {/* Error + Retry */}
      {result.kind === "error" && (
        <section
          role="alert"
          className="flex flex-col gap-2.5 rounded-2xl border border-[#D9534F]/30 bg-[#FDF3F2] p-4"
        >
          <p className="text-xs font-medium text-[#8A2522]">{result.message}</p>
          <button
            type="button"
            onClick={() => void runLookup()}
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Retry
          </button>
        </section>
      )}

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
      setError(
        "Private RPC checks could not run. Check the public RPC configuration and try again.",
      );
    } finally {
      setRunning(false);
    }
  }
  if (!debug) return null;
  return (
    <section
      className="mt-6 space-y-3 border-t pt-4"
      aria-label="RPC diagnostics"
    >
      <h2 className="font-semibold">Private RPC diagnostics</h2>
      <p className="text-sm">
        Read-only checks through Nox. No wallet is needed and no transactions
        are sent.
      </p>
      <button
        className="min-h-11 rounded border px-4 disabled:opacity-50"
        disabled={running}
        onClick={runChecks}
      >
        {running ? <span className="inline-flex items-center gap-2"><MorphLoader />Checking private RPC…</span> : "Run private RPC read checks"}
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <pre
          data-testid="rpc-read-report"
          className="overflow-auto whitespace-pre-wrap text-xs"
        >
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
      <p className="text-sm">
        Phone verification and five write-latency samples per chain remain
        manual checks after deployment and funding. Never put a development
        private key in browser config.
      </p>
    </section>
  );
}
