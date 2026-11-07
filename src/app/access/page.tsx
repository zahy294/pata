"use client";
// "Who can find my door": the live-access list (P1-2). Owner: frontend. Logic: src/lib/flows/access.ts.
// Each row: requester, purpose, a countdown to grantEnd, and "Stop access". Arkiv emits no expiry event,
// so the page polls (arkiv.md Gotcha 3): one check at a time, paused while the page is hidden, and a
// failed check keeps the last list on screen rather than showing it empty.
import { useCallback, useEffect, useRef, useState } from "react";
import MorphLoader from "../../components/MorphLoader";
import Link from "next/link";
import type { LiveGrant } from "../../../shared/domain";
import type { HouseholdKeys } from "../../lib/keys";
import type { HouseholdState } from "../../lib/keys/store";
import { signIn } from "../../lib/flows/setup-household";
import { loadHousehold } from "../../lib/flows/approve-grant";
import { finishInterruptedStops, loadLiveAccess, stopAccess, timeLeft } from "../../lib/flows/access";

const POLL_MS = 4000;

type StopState = { state: "stopping" } | { state: "failed"; message: string };

export default function AccessPage() {
  const [keys, setKeys] = useState<HouseholdKeys | null>(null);
  const [household, setHousehold] = useState<HouseholdState | null>(null);
  const [noHousehold, setNoHousehold] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [grants, setGrants] = useState<LiveGrant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stops, setStops] = useState<Record<string, StopState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  // Labels this page stopped: a check that started before the stop landed may still return them.
  const stopped = useRef(new Set<string>());

  const boot = useCallback(async () => {
    setBootError(null);
    try {
      const [k, state] = await Promise.all([signIn(), loadHousehold()]);
      setKeys(k);
      setHousehold(state);
      setNoHousehold(state === null);
    } catch {
      setBootError("Could not load your home's keys on this device.");
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!keys || !household) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void finishInterruptedStops(keys, household);
    const check = async () => {
      if (!active) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(check, POLL_MS);
        return;
      }
      try {
        const list = await loadLiveAccess(keys, household);
        if (!active) return;
        setGrants(list.filter((grant) => !stopped.current.has(grant.grantLabel)));
        setLoadError(null);
      } catch (failure) {
        if (active) setLoadError(failure instanceof Error ? failure.message : "Couldn't check right now.");
      } finally {
        if (active) timer = setTimeout(check, POLL_MS);
      }
    };
    void check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [keys, household]);

  const handleStop = async (grant: LiveGrant) => {
    if (!keys || !household) return;
    setNotice(null);
    setStops((current) => ({ ...current, [grant.grantLabel]: { state: "stopping" } }));
    try {
      const result = await stopAccess(keys, household, grant);
      stopped.current.add(grant.grantLabel);
      setGrants((current) => current?.filter((item) => item.grantLabel !== grant.grantLabel) ?? null);
      setNotice(
        result === "stopped"
          ? `${grant.requester.displayName} can no longer find your door. Their link now shows only your area.`
          : `${grant.requester.displayName}'s access had already ended on its own.`,
      );
      setStops((current) => {
        const next = { ...current };
        delete next[grant.grantLabel];
        return next;
      });
    } catch (failure) {
      setStops((current) => ({
        ...current,
        [grant.grantLabel]: {
          state: "failed",
          message: failure instanceof Error ? failure.message : "Access may not have stopped yet.",
        },
      }));
    }
  };

  return (
    <main className="flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-1">
        <span className="inline-flex self-start items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
          Live access
        </span>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
          Who can find my door
        </h1>
        <p className="text-sm text-[#6E655A]">
          Each link opens your exact door only until its time runs out. It ends by itself, even if this phone
          is off, or you can stop it now.
        </p>
      </div>

      {bootError && (
        <section className="flex flex-col gap-2.5 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-4">
          <p className="text-xs font-medium text-[#8A2522]">{bootError}</p>
          <button
            type="button"
            onClick={() => void boot()}
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Retry
          </button>
        </section>
      )}

      {noHousehold && (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-xs">
          <h2 className="text-sm font-bold text-[#1F1C18]">Set up your home first</h2>
          <p className="text-xs leading-relaxed text-[#6E655A]">This phone has no home yet.</p>
          <Link
            href="/setup/"
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Set up my home
          </Link>
        </section>
      )}

      {notice && (
        <section
          role="status"
          className="rounded-2xl border border-[#046A38]/30 bg-[#E3F2E8] p-4 text-sm font-medium text-[#035A2F]"
        >
          {notice}
        </section>
      )}

      {loadError && (
        <section
          role="alert"
          className="rounded-xl border border-[#B8862D]/40 bg-[#FBF3E4] p-3 text-xs font-medium text-[#7A5615]"
        >
          {loadError} {grants ? "Showing the last list; checking again…" : "Checking again…"}
        </section>
      )}

      {household && grants === null && !loadError && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 text-sm text-[#1F1C18] shadow-xs">
          <MorphLoader size={24} color="#046A38" />
          <span>Checking who can find your door…</span>
        </section>
      )}

      {grants && grants.length === 0 && (
        <section
          data-testid="access-empty"
          className="flex flex-col gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E3F2E8] text-lg"
              aria-hidden="true"
            >
              🔒
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#1F1C18]">Nobody can find your door right now</h2>
              <p className="text-xs text-[#6E655A]">
                Strangers see only {household ? "your area and PIN code" : "your area"}.
              </p>
            </div>
          </div>
          <div className="flex gap-4 border-t border-[#E6DAC6] pt-3 text-xs">
            <Link href="/seller/" className="font-semibold text-[#046A38] underline">
              Try the demo seller
            </Link>
            <Link href="/approve/" className="font-semibold text-[#6E655A] underline">
              Make a test request
            </Link>
          </div>
        </section>
      )}

      {grants && grants.length > 0 && (
        <ul className="flex flex-col gap-3" data-testid="access-list">
          {grants.map((grant) => {
            const stop = stops[grant.grantLabel];
            const words = timeLeft(grant.grantEnd, now);
            const ending = words === "Ending now";
            return (
              <li
                key={grant.grantLabel}
                className={`flex flex-col gap-3 rounded-2xl border bg-[#FFFDF9] p-4 shadow-sm ${
                  ending ? "border-[#E6DAC6] opacity-60" : "border-[#046A38]/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#1F1C18]">{grant.requester.displayName}</p>
                    {grant.requester.ensName && (
                      <p className="truncate font-mono text-[11px] text-[#046A38]">
                        {grant.requester.ensName}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-[#6E655A]">{grant.purpose}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                      {ending ? "Status" : "Ends in"}
                    </p>
                    <p
                      data-testid="time-left"
                      className={`font-mono text-lg font-bold ${ending ? "text-[#6E655A]" : "text-[#B8862D]"}`}
                    >
                      {words}
                    </p>
                  </div>
                </div>
                {stop?.state === "failed" && (
                  <p role="alert" className="text-xs font-medium text-[#8A2522]">
                    {stop.message}
                  </p>
                )}
                <button
                  type="button"
                  disabled={stop?.state === "stopping" || ending}
                  onClick={() => void handleStop(grant)}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#8A2522] px-4 py-2.5 text-sm font-semibold text-[#8A2522] transition hover:bg-[#FDF3F2] disabled:opacity-50"
                >
                  {stop?.state === "stopping" ? (
                    <>
                      <MorphLoader color="#8A2522" />
                      <span>Stopping access…</span>
                    </>
                  ) : stop?.state === "failed" ? (
                    "Stop again"
                  ) : (
                    "Stop access now"
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {household && (
        <Link href="/history/" className="self-center text-xs font-semibold text-[#6E655A] underline">
          See every link you&apos;ve shared →
        </Link>
      )}
    </main>
  );
}
