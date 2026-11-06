"use client";
// Demo seller (P1-5), clearly a mock. Owner: frontend. Logic: src/lib/flows/seller.ts.
// 1. Set up: the seller's own key and name under pata.eth, with ENSIP-26 records typed here.
// 2. Order chat: "Confirm your delivery address" → /approve#<GrantRequest carrying the seller's name>.
// 3. Hand-off: the consent screen sends the courier link back here after "#" (ADR 0013). The link is kept
//    in sessionStorage only, like the courier view's (ADR 0006), and the seller can prove it holds it.
import { useEffect, useState } from "react";
import Link from "next/link";
import { LANGUAGES, type Language } from "../../../shared/domain";
import {
  addressRequestUrl,
  loadSeller,
  newChallenge,
  proveGrantHolder,
  receiveCourierLink,
  setUpSeller,
  suggestSellerLabel,
  verifyGrantProof,
  type SellerState,
  type SellerStep,
} from "../../lib/flows/seller";

const INBOX_KEY = "pata:seller:links";
const LANGUAGE_NAME: Record<Language, string> = { hi: "Hindi", mr: "Marathi", en: "English" };
const DURATIONS = [
  { seconds: 20, label: "20 seconds (stage)" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 86_400, label: "1 day" },
];
const STEP_WORDS: Record<SellerStep, string> = {
  funding: "Getting gas from the relay…",
  deploying: "Creating the seller's records…",
  registering: "Registering the seller's name…",
  checking: "Checking the name resolves…",
};

interface Received {
  courierLink: string;
  householdName: string;
  at: number;
}
type ProofView =
  | { state: "checking" }
  | { state: "valid"; grantName: string; owner: string; challenge: string }
  | { state: "invalid"; reason: string };

function readInbox(): Received[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(INBOX_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Received[]) : [];
  } catch {
    return [];
  }
}

function aboutFor(displayName: string): string {
  const shop = displayName.trim() || "This shop";
  return `${shop} is a demo seller in Pata. It asks for a household's door only to deliver an order, and gets the courier link at its own page.`;
}

export default function SellerPage() {
  const [origin, setOrigin] = useState("");
  const [seller, setSeller] = useState<SellerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [inbox, setInbox] = useState<Received[]>([]);
  const [justReceived, setJustReceived] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [label, setLabel] = useState("");
  const [labelEdited, setLabelEdited] = useState(false);
  const [about, setAbout] = useState("");
  const [aboutEdited, setAboutEdited] = useState(false);
  const [step, setStep] = useState<SellerStep | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [orderNumber] = useState(() => String(1000 + Math.floor(Math.random() * 9000)));
  const [purpose, setPurpose] = useState("");
  const [language, setLanguage] = useState<Language>("hi");
  const [duration, setDuration] = useState(20);
  const [proofs, setProofs] = useState<Record<string, ProofView>>({});

  useEffect(() => {
    let active = true;
    const start = async () => {
      const state = await loadSeller();
      if (!active) return;
      const here = window.location.origin;
      setOrigin(here);
      setSeller(state);
      if (state && !state.ready) {
        setDisplayName(state.displayName);
        setLabel(state.name.split(".")[0]);
        setLabelEdited(true);
        setAbout(state.about);
        setAboutEdited(true);
      }
      setPurpose((current) => current || `Deliver order #${orderNumber}`);
      // A courier link handed over by the consent screen arrives after "#".
      const received = receiveCourierLink(window.location.hash, here);
      let list = readInbox();
      if (received) {
        list = [
          { ...received, at: Math.floor(Date.now() / 1000) },
          ...list.filter((item) => item.courierLink !== received.courierLink),
        ].slice(0, 10);
        sessionStorage.setItem(INBOX_KEY, JSON.stringify(list));
        history.replaceState(null, "", window.location.pathname);
        setJustReceived(received.courierLink);
      }
      setInbox(list);
      setLoaded(true);
    };
    void start();
    return () => {
      active = false;
    };
  }, [orderNumber]);

  const shownLabel = labelEdited ? label : (suggestSellerLabel(displayName) ?? "");
  const shownAbout = aboutEdited ? about : aboutFor(displayName);
  const endpoint = origin ? `${origin}/seller/` : "";
  const settingUp = step !== null && !setupError;

  const handleSetUp = async () => {
    setSetupError(null);
    setStep("funding");
    try {
      const state = await setUpSeller(
        { label: shownLabel, displayName, about: shownAbout, endpoint },
        (next) => setStep(next),
      );
      setSeller(state);
      setStep(null);
    } catch (failure) {
      setSetupError(failure instanceof Error ? failure.message : "Couldn't set up the seller.");
    }
  };

  const handleProve = async (item: Received) => {
    setProofs((current) => ({ ...current, [item.courierLink]: { state: "checking" } }));
    try {
      const challenge = newChallenge();
      const proof = await proveGrantHolder(item.courierLink, challenge);
      const result = await verifyGrantProof(proof);
      setProofs((current) => ({
        ...current,
        [item.courierLink]: result.valid
          ? { state: "valid", grantName: result.grantName, owner: result.owner, challenge }
          : {
              state: "invalid",
              reason:
                result.reason === "ended"
                  ? "This grant has ended, so the shop can no longer prove it holds it."
                  : "The signature doesn't match the grant's owner.",
            },
      }));
    } catch (failure) {
      setProofs((current) => ({
        ...current,
        [item.courierLink]: {
          state: "invalid",
          reason: failure instanceof Error ? failure.message : "Couldn't check the proof right now.",
        },
      }));
    }
  };

  const handleSendToCourier = async (item: Received) => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Delivery for order #${orderNumber}`, url: item.courierLink });
        return;
      } catch {
        /* Cancelled: fall back to copying. */
      }
    }
    await navigator.clipboard?.writeText(item.courierLink);
  };

  return (
    <main className="flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-1">
        <span className="inline-flex self-start items-center rounded-full bg-[#1F1C18] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#FAF5EC] uppercase">
          Demo seller (mock)
        </span>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
          {seller?.ready ? seller.displayName : "A shop that asks for your door"}
        </h1>
        <p className="text-sm text-[#6E655A]">
          A pretend shop, to show the other side: it asks for the address, the household decides, and the shop
          gets a link that ends by itself.
        </p>
      </div>

      {!loaded && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 text-sm shadow-xs">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#046A38] border-t-transparent" />
          <span>Opening the shop…</span>
        </section>
      )}

      {/* Links handed over by the consent screen */}
      {loaded && inbox.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="seller-inbox">
          {inbox.map((item) => {
            const proof = proofs[item.courierLink];
            return (
              <div
                key={item.courierLink}
                className={`flex flex-col gap-3 rounded-2xl border bg-[#FFFDF9] p-4 shadow-sm ${
                  justReceived === item.courierLink ? "border-2 border-[#046A38]" : "border-[#E6DAC6]"
                }`}
              >
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-[#046A38] uppercase">
                    {justReceived === item.courierLink ? "✓ Door link received" : "Door link"}
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-[#1F1C18]">{item.householdName}</p>
                  <p className="text-xs text-[#6E655A]">
                    The shop holds a link to this door. It ends when the household said it would.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSendToCourier(item)}
                    className="rounded-xl bg-[#046A38] px-3 py-2.5 text-xs font-semibold text-[#FFFDF9]"
                  >
                    Send to courier
                  </button>
                  <button
                    type="button"
                    data-testid="prove"
                    disabled={proof?.state === "checking"}
                    onClick={() => void handleProve(item)}
                    className="rounded-xl border-2 border-[#046A38] px-3 py-2.5 text-xs font-semibold text-[#046A38] disabled:opacity-50"
                  >
                    {proof?.state === "checking" ? "Checking…" : "Prove we hold it"}
                  </button>
                </div>
                {proof?.state === "valid" && (
                  <div
                    data-testid="proof-valid"
                    className="rounded-xl bg-[#E3F2E8] p-3 text-xs leading-relaxed text-[#1F1C18]"
                  >
                    <p className="font-bold text-[#046A38]">✓ Proof checked against the public record</p>
                    <p className="mt-1">
                      <span className="font-mono">{item.householdName}</span> gave this shop access, and it is
                      still live. The shop signed challenge{" "}
                      <span className="font-mono">{proof.challenge}</span> with the key the record names (
                      <span className="font-mono">
                        {proof.owner.slice(0, 6)}…{proof.owner.slice(-4)}
                      </span>
                      ). The address itself stayed locked.
                    </p>
                  </div>
                )}
                {proof?.state === "invalid" && (
                  <p role="alert" className="rounded-xl bg-[#FDF3F2] p-3 text-xs font-medium text-[#8A2522]">
                    {proof.reason}
                  </p>
                )}
                <a href={item.courierLink} className="text-xs font-semibold text-[#6E655A] underline">
                  Open what the courier sees →
                </a>
              </div>
            );
          })}
        </section>
      )}

      {/* Order chat: ask the household for its address */}
      {loaded && seller?.ready && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#E6DAC6] bg-[#E9F5EC] p-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[#CFE3D5] pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#046A38] text-sm font-bold text-[#FFFDF9]">
              {seller.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#1F1C18]">{seller.displayName}</p>
              <p className="truncate font-mono text-[11px] text-[#046A38]">{seller.name}</p>
            </div>
          </div>
          <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-[#FFFDF9] p-3 text-sm text-[#1F1C18] shadow-xs">
            Your order <b>#{orderNumber}</b> is packed. Please confirm your delivery address with Pata. You
            choose how long we can see it.
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-[#FFFDF9]/70 p-3">
            <label htmlFor="seller-purpose" className="text-[11px] font-semibold text-[#4A433B]">
              Purpose the household will see
            </label>
            <input
              id="seller-purpose"
              value={purpose}
              maxLength={200}
              onChange={(e) => setPurpose(e.target.value)}
              className="rounded-lg border border-[#E6DAC6] bg-[#FFFDF9] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Courier's language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="rounded-lg border border-[#E6DAC6] bg-[#FFFDF9] px-2 py-2 text-xs"
              >
                {LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    Courier speaks {LANGUAGE_NAME[code]}
                  </option>
                ))}
              </select>
              <select
                aria-label="How long"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="rounded-lg border border-[#E6DAC6] bg-[#FFFDF9] px-2 py-2 text-xs"
              >
                {DURATIONS.map((option) => (
                  <option key={option.seconds} value={option.seconds}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <a
            data-testid="ask-address"
            href={
              purpose.trim()
                ? addressRequestUrl(origin, seller, {
                    purpose: purpose.trim(),
                    language,
                    durationSeconds: duration,
                  })
                : undefined
            }
            aria-disabled={!purpose.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3 text-sm font-semibold text-[#FFFDF9] shadow-sm aria-disabled:opacity-50"
          >
            Confirm address with Pata →
          </a>
          <p className="text-[11px] leading-relaxed text-[#35593F]">
            Published on {seller.name}: “{seller.about}”
          </p>
        </section>
      )}

      {/* Set up the demo seller */}
      {loaded && !seller?.ready && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#1F1C18]">Set up the demo seller</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6E655A]">
              The shop gets its own name, which says who it is and where it takes links. A household&apos;s
              consent screen reads that name before it shows the request.
            </p>
          </div>
          <label htmlFor="shop-name" className="text-xs font-semibold text-[#4A433B]">
            Shop name
            <input
              id="shop-name"
              value={displayName}
              maxLength={60}
              disabled={settingUp || seller !== null}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Type the shop's name…"
              className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2 text-sm font-normal"
            />
          </label>
          <label htmlFor="shop-label" className="text-xs font-semibold text-[#4A433B]">
            Its name in Pata
            <div className="mt-1 flex items-center rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2">
              <input
                id="shop-label"
                value={shownLabel}
                maxLength={32}
                disabled={settingUp || seller !== null}
                onChange={(e) => {
                  setLabel(e.target.value.toLowerCase());
                  setLabelEdited(true);
                }}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold"
              />
              <span className="font-mono text-xs text-[#6E655A]">.pata.eth</span>
            </div>
          </label>
          <label htmlFor="shop-about" className="text-xs font-semibold text-[#4A433B]">
            What it tells households (public)
            <textarea
              id="shop-about"
              value={shownAbout}
              maxLength={600}
              rows={3}
              disabled={settingUp || seller !== null}
              onChange={(e) => {
                setAbout(e.target.value);
                setAboutEdited(true);
              }}
              className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2 text-xs font-normal leading-relaxed"
            />
          </label>
          <p className="text-[11px] text-[#6E655A]">
            Links come back to: <span className="font-mono">{endpoint}</span>
          </p>
          {setupError && (
            <p role="alert" className="rounded-xl bg-[#FDF3F2] p-3 text-xs font-medium text-[#8A2522]">
              {setupError}
            </p>
          )}
          <button
            type="button"
            data-testid="seller-setup"
            disabled={settingUp || !displayName.trim() || !shownLabel || !shownAbout.trim() || !endpoint}
            onClick={() => void handleSetUp()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3 text-sm font-semibold text-[#FFFDF9] disabled:opacity-50"
          >
            {settingUp && step ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFFDF9] border-t-transparent" />
                <span>{STEP_WORDS[step]}</span>
              </>
            ) : setupError ? (
              "Retry"
            ) : (
              "Create the shop's name"
            )}
          </button>
        </section>
      )}

      <Link href="/" className="self-center text-xs font-semibold text-[#6E655A] underline">
        ← Back to Pata
      </Link>
    </main>
  );
}
