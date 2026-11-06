"use client";
// History (P1-2). Owner: frontend. Logic: src/lib/flows/history.ts.
// One row per grant this household issued, newest first: who, why, when, and how it ended.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { HouseholdKeys } from "../../lib/keys";
import { signIn } from "../../lib/flows/setup-household";
import { loadHousehold } from "../../lib/flows/approve-grant";
import { loadConsentHistory, type ConsentRecord } from "../../lib/flows/history";

const STATUS: Record<ConsentRecord["status"], { label: string; className: string }> = {
  live: { label: "Can still find your door", className: "bg-[#E3F2E8] text-[#046A38]" },
  ended: { label: "Ended on its own", className: "bg-[#EFE5D4] text-[#5C5346]" },
  stopped: { label: "Stopped by you", className: "bg-[#FDF3F2] text-[#8A2522]" },
};

function when(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function HistoryPage() {
  const [keys, setKeys] = useState<HouseholdKeys | null>(null);
  const [noHousehold, setNoHousehold] = useState(false);
  const [records, setRecords] = useState<ConsentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Callers set `loading` first; nothing here sets state before the read, so the boot effect stays
  // free of synchronous setState (react-hooks/set-state-in-effect).
  const load = useCallback(async (k: HouseholdKeys) => {
    try {
      const result = await loadConsentHistory(k, Math.floor(Date.now() / 1000));
      setRecords(result);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't read your history right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      const [k, state] = await Promise.all([signIn(), loadHousehold()]);
      setKeys(k);
      setNoHousehold(state === null);
      if (state) await load(k);
      else setLoading(false);
    } catch {
      setError("Could not load your home's keys on this device.");
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    let active = true;
    const start = async () => {
      // Device keys first; every state change below happens after this await.
      const booted = await Promise.all([signIn(), loadHousehold()]).catch(() => null);
      if (!active) return;
      if (!booted) {
        setError("Could not load your home's keys on this device.");
        setLoading(false);
        return;
      }
      const [k, state] = booted;
      setKeys(k);
      setNoHousehold(state === null);
      if (state) await load(k);
      else setLoading(false);
    };
    void start();
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <main className="flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-1">
        <span className="inline-flex self-start items-center rounded-full bg-[#EFE5D4] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#5C5346] uppercase">
          Your record of consent
        </span>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">History</h1>
        <p className="text-sm text-[#6E655A]">
          Every link you&apos;ve shared, who asked, why, and how it ended. Only this phone can read it, and
          nobody can change it afterwards.
        </p>
      </div>

      {noHousehold && (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-xs">
          <h2 className="text-sm font-bold text-[#1F1C18]">Set up your home first</h2>
          <Link
            href="/setup/"
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Set up my home
          </Link>
        </section>
      )}

      {error && (
        <section
          role="alert"
          className="flex flex-col gap-2.5 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-4"
        >
          <p className="text-xs font-medium text-[#8A2522]">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              void (keys ? load(keys) : boot());
            }}
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Retry
          </button>
        </section>
      )}

      {loading && records === null && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 text-sm text-[#1F1C18] shadow-xs">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#046A38] border-t-transparent" />
          <span>Reading your history…</span>
        </section>
      )}

      {records && records.length === 0 && (
        <section
          data-testid="history-empty"
          className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 text-sm text-[#6E655A] shadow-sm"
        >
          You haven&apos;t shared your door with anyone yet.
        </section>
      )}

      {records && records.length > 0 && (
        <ul className="flex flex-col gap-3" data-testid="history-list">
          {records.map((record) => (
            <li
              key={record.grantLabel}
              className="flex flex-col gap-2 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#1F1C18]">{record.requester.displayName}</p>
                  {record.requester.ensName && (
                    <p className="truncate font-mono text-[11px] text-[#046A38]">
                      {record.requester.ensName}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-[#6E655A]">{record.purpose}</p>
                </div>
                <span
                  data-testid="history-status"
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${STATUS[record.status].className}`}
                >
                  {STATUS[record.status].label}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 border-t border-[#E6DAC6] pt-2 text-[11px] text-[#6E655A]">
                <div>
                  <dt className="font-semibold uppercase tracking-wider">Shared</dt>
                  <dd className="text-[#1F1C18]">{record.issuedAt ? when(record.issuedAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wider">
                    {record.status === "stopped" ? "Stopped" : record.status === "live" ? "Ends" : "Ended"}
                  </dt>
                  <dd className="text-[#1F1C18]">
                    {when(
                      record.status === "stopped" && record.stoppedAt ? record.stoppedAt : record.grantEnd,
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {keys && !noHousehold && (
        <div className="flex items-center justify-between text-xs">
          <Link href="/access/" className="font-semibold text-[#046A38] underline">
            Who can find my door now →
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load(keys);
            }}
            className="font-semibold text-[#6E655A] underline disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-[#6E655A]">
        Each entry is locked to this phone&apos;s key and kept read-only for six months, so you hold your own
        record of every time someone got your address.
      </p>
    </main>
  );
}
