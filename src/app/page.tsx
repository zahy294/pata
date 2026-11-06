"use client";
// Home. Owner: frontend.
// Signed out: "Set up your home" (→ /setup). Signed in: the household name, its locality, and
// links to the live-access list and history. No crypto words anywhere in the UI (idea.md, Usability).
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadHouseholdState, type HouseholdState } from "../lib/keys/store";
import { lookupHousehold } from "../lib/flows/lookup";
import type { Locality } from "../../shared/domain";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<HouseholdState | null>(null);
  const [locality, setLocality] = useState<Locality | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const state = await loadHouseholdState();
        if (!active) return;
        setHousehold(state);

        if (state) {
          try {
            const loc = await lookupHousehold(state.name);
            if (active && loc) {
              setLocality(loc);
            }
          } catch {
            // Public locality is optional if offline or not yet resolved
          }
        }
      } catch {
        // Treat storage error as signed out
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex flex-col gap-5 pb-10">
      {/* Hero Banner */}
      <div className="flex flex-col gap-1">
        <span className="inline-flex self-start items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
          {household ? "Home Ready" : "Private Doorway Address"}
        </span>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
          Your door, shared only by consent.
        </h1>
        <p className="text-sm text-[#6E655A]">
          Share expiring doorstep directions with couriers while everyone else
          sees only your neighbourhood.
        </p>
      </div>

      {loading && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 text-sm text-[#1F1C18] shadow-xs">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#046A38] border-t-transparent" />
          <span>Checking your home on this phone…</span>
        </section>
      )}

      {/* Signed Out View */}
      {!loading && !household && (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#1F1C18]">
              No home set up on this phone yet
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6E655A]">
              Record or type how people find your door, confirm your 4m × 4m
              DIGIPIN grid code, and pick a memorable name for your home.
            </p>
          </div>

          <Link
            href="/setup/"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D]"
          >
            <span>Set up your home</span>
            <span aria-hidden="true">→</span>
          </Link>

          <div className="border-t border-[#E6DAC6] pt-3 text-center">
            <Link
              href="/lookup/"
              className="text-xs font-semibold text-[#6E655A] underline hover:text-[#1F1C18]"
            >
              Look up a home&apos;s name →
            </Link>
          </div>
        </section>
      )}

      {/* Signed In View */}
      {!loading && household && (
        <div className="flex flex-col gap-4">
          {/* Household Identity Card */}
          <section className="rounded-2xl border-2 border-[#046A38] bg-[#FFFDF9] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-[#046A38] uppercase">
                Your Home&apos;s Name
              </span>
              <span className="rounded-full bg-[#E3F2E8] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#046A38] uppercase">
                Door Locked
              </span>
            </div>

            <p className="mt-1.5 font-mono text-xl font-bold text-[#1F1C18]">
              {household.name}
            </p>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2.5">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                  Public Locality
                </p>
                <p className="mt-0.5 text-sm font-bold text-[#1F1C18]">
                  {locality
                    ? `${locality.name}, ${locality.pinCode}`
                    : "Neighbourhood saved on your home's name"}
                </p>
              </div>
              <span className="text-base" aria-hidden="true">
                📍
              </span>
            </div>
          </section>

          {/* Primary Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/access/"
              className="flex items-center justify-between rounded-2xl bg-[#046A38] px-4 py-4 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D]"
            >
              <span>Who can find my door</span>
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/history/"
              className="flex items-center justify-between rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] px-4 py-4 text-sm font-semibold text-[#1F1C18] shadow-xs transition hover:border-[#B8862D]"
            >
              <span>History</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] px-4 py-3 text-xs">
            <Link
              href="/approve/"
              className="font-semibold text-[#046A38] underline"
            >
              Share a courier link
            </Link>
            <Link
              href="/lookup/"
              className="font-semibold text-[#6E655A] underline hover:text-[#1F1C18]"
            >
              Look up a name
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
