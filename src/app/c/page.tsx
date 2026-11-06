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
import { useEffect, useState } from "react";
import MapView from "../../components/MapView";
import AudioPlayer from "../../components/AudioPlayer";
import { formatDigipin } from "../../lib/digipin";
import { checkCourierLink, type CourierView } from "../../lib/flows/courier";
import type { Locality } from "../../../shared/domain";

const SESSION_STORAGE_KEY = "pata.courier.fragment";
const POLL_INTERVAL_MS = 3000;
// The registry decides liveness, so a failed check normally hides the door. Hold a live view through at
// most this many consecutive failed checks (a brief Anon-RPC hiccup), and never past the grant's end.
const MAX_HELD_CHECKS = 2;
// After this many failed checks in a row, say what usually helps instead of only spinning.
const STALL_CHECKS = 3;

export default function CourierPage() {
  const [view, setView] = useState<CourierView>({
    state: "checking",
    locality: null,
  });
  const [knownLocality, setKnownLocality] = useState<Locality | null>(null);
  const [digipinCopied, setDigipinCopied] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    let fragment = "";
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      fragment = hash;
      // Remove the bearer secret from the address bar first, even if storage is unavailable.
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {
        // ignore: nothing else to do without history access
      }
      try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, hash);
      } catch {
        // ignore: the link still works for this page load
      }
    } else {
      try {
        fragment = window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? "";
      } catch {
        fragment = "";
      }
    }
    let failedChecks = 0;

    if (!fragment) {
      setView({ state: "invalid" });
      return;
    }

    const poll = async () => {
      try {
        const result = await checkCourierLink(fragment);
        if (!active) return;

        if ("locality" in result && result.locality) {
          setKnownLocality(result.locality);
        }

        failedChecks = result.state === "checking" ? failedChecks + 1 : 0;
        setStalled(result.state === "checking" && failedChecks >= STALL_CHECKS);
        setView((previous) =>
          result.state === "checking" &&
          previous.state === "live" &&
          failedChecks <= MAX_HELD_CHECKS &&
          Date.now() / 1000 < previous.payload.grantEnd
            ? previous
            : result,
        );

        if (result.state === "ended" || result.state === "invalid") {
          try {
            window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
          } catch {
            // ignore storage errors
          }
          return;
        }
      } catch {
        // Keep polling on transient network errors
      }
      // One check at a time: a check is ~5 reads through the mixnet (10-20 s on a phone), so a fixed
      // 3 s interval piled up overlapping checks that slowed each other into timeouts (2026-11-06).
      if (active) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const displayLocality = "locality" in view && view.locality ? view.locality : knownLocality;

  const formattedDigipin = view.state === "live" ? formatDigipin(view.payload.digipin) : "";

  return (
    <main className="flex flex-col gap-4 pb-10">
      {/* Top Heading */}
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-flex items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
            {view.state === "live"
              ? "Live Door Pass"
              : view.state === "ended"
                ? "Pass Ended"
                : view.state === "invalid"
                  ? "Link Error"
                  : "Checking Pass"}
          </span>
          <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
            Delivery directions
          </h1>
        </div>
      </div>

      {/* Locality Banner — Shown Immediately as soon as checkCourierLink returns it */}
      {displayLocality && (
        <section
          aria-label="Neighbourhood locality"
          className="flex items-center justify-between rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-xs"
        >
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
              Public Locality
            </p>
            <p className="mt-0.5 font-serif text-lg font-bold text-[#1F1C18]">
              {displayLocality.name}, {displayLocality.pinCode}
            </p>
          </div>
          <span className="rounded-lg bg-[#F2ECE1] px-2.5 py-1 font-mono text-xs font-semibold text-[#4A433B]">
            PIN {displayLocality.pinCode}
          </span>
        </section>
      )}

      {/* INVALID STATE */}
      {view.state === "invalid" && (
        <section role="alert" className="rounded-2xl border border-[#D9534F]/40 bg-[#FDF3F2] p-5 shadow-xs">
          <p className="text-base font-bold text-[#8A2522]">This link doesn&apos;t work</p>
          <p className="mt-1 text-xs leading-relaxed text-[#6E2A27]">
            Ask the resident to share a fresh courier link from their phone.
          </p>
        </section>
      )}

      {/* ENDED STATE */}
      {view.state === "ended" && (
        <section role="status" className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2ECE1] text-sm">
              🔒
            </span>
            <div>
              <p className="text-base font-bold text-[#1F1C18]">This link has ended</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6E655A]">
                This page no longer shows the door details or directions. Only the public neighbourhood
                locality is shown above.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* CHECKING STATE */}
      {view.state === "checking" && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 text-sm text-[#1F1C18] shadow-xs">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#046A38] border-t-transparent" />
          <span>Unlocking doorstep directions…</span>
        </section>
      )}
      {view.state === "checking" && stalled && (
        <p className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3 text-xs leading-relaxed text-[#6E655A]">
          Still reaching the private network. Some Wi-Fi networks block it: switch to mobile data, then pull
          down to reload. The link is kept for this tab.
        </p>
      )}

      {/* LIVE STATE — Text & Audio First (for slow 4G phones), Map After */}
      {view.state === "live" && (
        <div className="flex flex-col gap-4">
          {/* Exact Door / Room Number & Written Address Card */}
          <section className="rounded-2xl border-2 border-[#046A38] bg-[#FFFDF9] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-[#E3F2E8] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#046A38] uppercase">
                Verified Doorstep
              </span>
              <span className="font-mono text-xs font-semibold text-[#B8862D]">
                {view.payload.requester.displayName} • {view.payload.purpose}
              </span>
            </div>

            {view.payload.roomNumber && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                  Room / Flat / Floor
                </p>
                <p className="mt-0.5 font-serif text-xl font-bold text-[#1F1C18]">
                  {view.payload.roomNumber}
                </p>
              </div>
            )}

            <div className="mt-3 border-t border-[#E6DAC6] pt-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Written Address
              </p>
              <p className="mt-0.5 text-sm leading-relaxed font-medium text-[#1F1C18]">
                {view.payload.writtenAddress}
              </p>
            </div>

            {/* DIGIPIN Row */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2.5">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                  DIGIPIN (4m × 4m Grid)
                </p>
                <p className="font-mono text-base font-bold tracking-wider text-[#1F1C18]">
                  {formattedDigipin}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    void navigator.clipboard.writeText(formattedDigipin);
                    setDigipinCopied(true);
                    setTimeout(() => setDigipinCopied(false), 1800);
                  }
                }}
                className="rounded-lg border border-[#D8CCB8] bg-[#FFFDF9] px-3 py-1 text-xs font-semibold text-[#1F1C18]"
              >
                {digipinCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>

          {/* Spoken Directions & AudioPlayer */}
          <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <AudioPlayer
                audioBytes={view.audio}
                fallbackText={view.payload.directions}
                lang={view.payload.language}
                label="doorstep directions"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-wider text-[#B8862D] uppercase">
                  Spoken Directions ({view.payload.language.toUpperCase()})
                </p>
                <p className="mt-1 text-sm leading-relaxed font-medium text-[#1F1C18]">
                  {view.payload.directions}
                </p>
              </div>
            </div>
          </section>

          {/* MapView Below Text */}
          <section className="overflow-hidden rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] shadow-sm">
            <MapView
              center={view.payload.pin}
              pins={[
                {
                  point: view.payload.pin,
                  label: view.payload.roomNumber || "Exact Doorstep",
                },
              ]}
            />
            <div className="flex items-center justify-between border-t border-[#E6DAC6] px-3.5 py-2 text-xs text-[#6E655A]">
              <span className="font-mono">
                {view.payload.pin.lat.toFixed(5)}° N, {view.payload.pin.lon.toFixed(5)}° E
              </span>
              <span className="font-semibold text-[#046A38]">Exact Door Pin</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
