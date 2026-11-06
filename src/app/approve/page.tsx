"use client";
// Consent screen (P0-10). Owner: frontend; logic in src/lib/flows/approve-grant.ts.
// The request arrives as /approve#<base64url JSON GrantRequest> (from the mock seller, P1-5, or typed in).
// Shows: who is asking (and their agent-context in P1-5), the purpose, the courier's language, the duration,
// and in plain words: "Anyone with this link can find your door until it ends." (ADR 0006).
// Approve → share sheet (navigator.share) + QR code (components/QrCode) of the courier link.
// The stage grant is 20 seconds.
import { useEffect, useState } from "react";
import QrCode from "../../components/QrCode";
import { fromBase64Url, toBase64Url } from "../../lib/link";
import { ARKIV_MAX_DAYS, GRANT_LATENCY_MARGIN_SECONDS } from "../../../shared/constants";
import { LANGUAGES, type GrantRequest, type Language } from "../../../shared/domain";
import type { HouseholdKeys } from "../../lib/keys";
import type { HouseholdState } from "../../lib/keys/store";
import { approveGrant, loadHousehold, type ApprovedGrant } from "../../lib/flows/approve-grant";
import { signIn } from "../../lib/flows/setup-household";

const LANGUAGE_NAME: Record<Language, string> = {
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  en: "English",
};

const DURATION_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 20, label: "20 seconds (stage)" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 1800, label: "30 minutes" },
  { seconds: 3600, label: "1 hour" },
];

export function formatDurationInWords(seconds: number): string {
  if (seconds === 1) return "1 second";
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds % 3600 === 0) {
    const hrs = seconds / 3600;
    return hrs === 1 ? "1 hour" : `${hrs} hours`;
  }
  if (seconds % 60 === 0) {
    const mins = seconds / 60;
    return mins === 1 ? "1 minute" : `${mins} minutes`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  return `${mins} min ${remSecs} sec`;
}

export function parseGrantRequestFragment(hash: string): GrantRequest | null {
  try {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return null;

    const bytes = fromBase64Url(raw);
    const jsonText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(jsonText);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const allowedTopKeys = new Set([
      "requester",
      "purpose",
      "language",
      "durationSeconds",
    ]);
    for (const k of Object.keys(obj)) {
      if (!allowedTopKeys.has(k)) return null;
    }

    if (
      !obj.requester ||
      typeof obj.requester !== "object" ||
      Array.isArray(obj.requester)
    ) {
      return null;
    }

    const reqObj = obj.requester as Record<string, unknown>;
    for (const k of Object.keys(reqObj)) {
      if (k !== "displayName" && k !== "ensName") return null;
    }

    if (
      typeof reqObj.displayName !== "string" ||
      !reqObj.displayName.trim() ||
      reqObj.displayName.trim().length > 120
    ) {
      return null;
    }

    if (
      reqObj.ensName !== undefined &&
      (typeof reqObj.ensName !== "string" ||
        !reqObj.ensName.trim() ||
        reqObj.ensName.trim().length > 120)
    ) {
      return null;
    }

    if (
      typeof obj.purpose !== "string" ||
      !obj.purpose.trim() ||
      obj.purpose.trim().length > 200
    ) {
      return null;
    }

    if (
      typeof obj.language !== "string" ||
      !LANGUAGES.includes(obj.language as Language)
    ) {
      return null;
    }

    const maxDuration =
      ARKIV_MAX_DAYS * 86_400 - GRANT_LATENCY_MARGIN_SECONDS;
    if (
      typeof obj.durationSeconds !== "number" ||
      !Number.isSafeInteger(obj.durationSeconds) ||
      obj.durationSeconds <= 0 ||
      obj.durationSeconds > maxDuration
    ) {
      return null;
    }

    return {
      requester: {
        displayName: reqObj.displayName.trim(),
        ...(reqObj.ensName ? { ensName: reqObj.ensName.trim() } : {}),
      },
      purpose: obj.purpose.trim(),
      language: obj.language as Language,
      durationSeconds: obj.durationSeconds,
    };
  } catch {
    return null;
  }
}

export function encodeGrantRequestFragment(req: GrantRequest): string {
  const json = JSON.stringify(req);
  const bytes = new TextEncoder().encode(json);
  return `#${toBase64Url(bytes)}`;
}

export default function ApprovePage() {
  const [keys, setKeys] = useState<HouseholdKeys | null>(null);
  const [household, setHousehold] = useState<HouseholdState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [noHousehold, setNoHousehold] = useState(false);

  const [rawHashPresent, setRawHashPresent] = useState(false);
  const [request, setRequest] = useState<GrantRequest | null>(null);
  const [malformedHash, setMalformedHash] = useState(false);

  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApprovedGrant | null>(null);
  const [copied, setCopied] = useState(false);

  // "Make a test request" builder form state (user types it; never hard-coded)
  const [testRequesterName, setTestRequesterName] = useState("");
  const [testPurpose, setTestPurpose] = useState("");
  const [testLanguage, setTestLanguage] = useState<Language>("hi");
  const [testDuration, setTestDuration] = useState<number>(20);
  const [testFormError, setTestFormError] = useState<string | null>(null);

  const syncFromLocationHash = () => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (!h || h === "#") {
      setRawHashPresent(false);
      setRequest(null);
      setMalformedHash(false);
      return;
    }
    setRawHashPresent(true);
    const parsed = parseGrantRequestFragment(h);
    if (!parsed) {
      setRequest(null);
      setMalformedHash(true);
    } else {
      setRequest(parsed);
      setMalformedHash(false);
    }
  };

  const boot = async () => {
    setBootError(null);
    try {
      const [k, state] = await Promise.all([signIn(), loadHousehold()]);
      setKeys(k);
      setHousehold(state);
      setNoHousehold(state === null);
    } catch {
      setBootError("Could not load your home's keys on this device.");
    }
  };

  useEffect(() => {
    void boot();
    syncFromLocationHash();
    const onHashChange = () => {
      setApproved(null);
      setApproveError(null);
      syncFromLocationHash();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleBuildTestRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const name = testRequesterName.trim();
    const purpose = testPurpose.trim();
    if (!name || !purpose) {
      setTestFormError("Please enter both who is asking and the purpose.");
      return;
    }
    setTestFormError(null);
    const built: GrantRequest = {
      requester: { displayName: name },
      purpose,
      language: testLanguage,
      durationSeconds: testDuration,
    };
    const frag = encodeGrantRequestFragment(built);
    window.location.hash = frag;
    setApproved(null);
    setApproveError(null);
    syncFromLocationHash();
  };

  const handleApprove = async () => {
    if (!keys || !household || !request) return;
    setApproving(true);
    setApproveError(null);
    try {
      const result = await approveGrant(keys, household, request);
      setApproved(result);
    } catch {
      setApproveError(
        "Could not create the courier link right now. Please tap Retry.",
      );
    } finally {
      setApproving(false);
    }
  };

  const handleShareOrCopy = async () => {
    if (!approved) return;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Door link for ${request?.requester.displayName ?? "Courier"}`,
          text: `Temporary door directions (${formatDurationInWords(request?.durationSeconds ?? 20)}):`,
          url: approved.courierLink,
        });
        return;
      } catch {
        // Fall back to clipboard copy if user cancels or share fails
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(approved.courierLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="inline-flex self-start items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
          {approved ? "Courier Link Ready" : "Door Access Consent"}
        </span>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
          {approved
            ? "Share Courier Link"
            : "Someone is asking for your address"}
        </h1>
        <p className="text-sm text-[#6E655A]">
          {approved
            ? "Anyone with this link can find your door until it ends."
            : "Review who is asking and how long they can see your exact door."}
        </p>
      </div>

      {bootError && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-4">
          <p className="text-xs font-medium text-[#8A2522]">{bootError}</p>
          <button
            type="button"
            onClick={() => void boot()}
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Retry
          </button>
        </div>
      )}

      {noHousehold && (
        <section
          role="alert"
          className="flex flex-col gap-2.5 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-xs"
        >
          <h2 className="text-sm font-bold text-[#1F1C18]">Set up your home first</h2>
          <p className="text-xs leading-relaxed text-[#6E655A]">
            This phone has no home yet, so there is no door to share.
          </p>
          <a
            href="/setup"
            className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
          >
            Set up my home
          </a>
        </section>
      )}

      {/* Malformed #fragment warning */}
      {rawHashPresent && malformedHash && (
        <section
          role="alert"
          className="rounded-2xl border border-[#D9534F]/40 bg-[#FDF3F2] p-4 shadow-xs"
        >
          <h2 className="text-sm font-bold text-[#8A2522]">
            This address request is invalid
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#6E2A27]">
            The request link is missing required details or was corrupted. You
            can make a fresh test request below.
          </p>
        </section>
      )}

      {/* Incoming GrantRequest Card + Approval OR Approved Link + QR View */}
      {request && !approved && (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
          {/* Destination Household Badge */}
          <div className="flex items-center justify-between border-b border-[#E6DAC6] pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#046A38] text-sm font-bold text-[#FFFDF9]">
                🚪
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                  Your Home&apos;s Name
                </p>
                <p className="font-mono text-sm font-bold text-[#1F1C18]">
                  {household?.name ?? "—"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#E3F2E8] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#046A38] uppercase">
              Exact Door
            </span>
          </div>

          {/* 2x2 Bento Grid of Request Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Who Is Asking
              </p>
              <p className="mt-1 text-sm font-bold text-[#1F1C18]">
                {request.requester.displayName}
              </p>
              {request.requester.ensName && (
                <p className="mt-0.5 font-mono text-[11px] text-[#046A38]">
                  {request.requester.ensName}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Purpose
              </p>
              <p className="mt-1 text-sm font-bold text-[#1F1C18]">
                {request.purpose}
              </p>
            </div>

            <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Courier&apos;s Language
              </p>
              <p className="mt-1 text-sm font-bold text-[#1F1C18]">
                {LANGUAGE_NAME[request.language]}
              </p>
            </div>

            <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Duration
              </p>
              <p className="mt-1 text-sm font-bold text-[#B8862D]">
                {formatDurationInWords(request.durationSeconds)}
              </p>
            </div>
          </div>

          {/* Mandatory Prominent Bearer-Secret Warning (ADR 0006) */}
          <div className="rounded-xl bg-[#1F1C18] p-4 text-[#FAF5EC] shadow-xs">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B8862D] text-xs font-bold text-[#FFFDF9]">
                !
              </span>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-[#E6B85C] uppercase">
                  Privacy Notice
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-[#FFFDF9]">
                  Anyone with this link can find your door until it ends.
                </p>
              </div>
            </div>
          </div>

          {approveError && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-3.5">
              <p className="text-xs font-medium text-[#8A2522]">
                {approveError}
              </p>
              <button
                type="button"
                onClick={() => void handleApprove()}
                className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
              >
                Retry Approval
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={approving || !keys || !household}
            onClick={() => void handleApprove()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D] disabled:opacity-50"
          >
            {approving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFFDF9] border-t-transparent" />
                <span>Creating temporary link…</span>
              </>
            ) : (
              <>
                <span>Approve &amp; Create Link</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* Approved View: Share Button + Local QR Code */}
      {request && approved && (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Shared With
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#1F1C18]">
                {request.requester.displayName}
              </p>
              <p className="text-xs text-[#6E655A]">{request.purpose}</p>
            </div>

            <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
              <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Valid For
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#B8862D]">
                {formatDurationInWords(request.durationSeconds)}
              </p>
              <p className="text-xs text-[#6E655A]">
                {LANGUAGE_NAME[request.language]}
              </p>
            </div>
          </div>

          {/* Local QR Code */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D8CCB8] bg-[#FAF5EC] py-5">
            <QrCode value={approved.courierLink} size={216} />
            <p className="mt-2.5 text-xs font-medium text-[#6E655A]">
              Scan to open the door directions while the link is live
            </p>
          </div>

          {/* Courier Link Box */}
          <div className="rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3">
            <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
              Courier Link
            </p>
            <p className="mt-1 break-all font-mono text-xs text-[#1F1C18]">
              {approved.courierLink}
            </p>
          </div>

          {/* Prominent Bearer Warning */}
          <div className="rounded-xl bg-[#1F1C18] p-3.5 text-[#FAF5EC]">
            <p className="text-xs font-semibold text-[#FFFDF9]">
              Anyone with this link can find your door until it ends.
            </p>
          </div>

          {/* Share / Copy CTA */}
          <button
            type="button"
            onClick={() => void handleShareOrCopy()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D]"
          >
            <span>{copied ? "✓ Link Copied" : "Share Courier Link"}</span>
          </button>

          <a
            href={approved.courierLink}
            className="text-center text-xs font-semibold text-[#046A38] underline"
          >
            Open courier link on this phone →
          </a>
        </section>
      )}

      {/* "Make a test request" Builder Form */}
      <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base font-bold text-[#1F1C18]">
            Make a test request
          </h2>
          <span className="rounded-md bg-[#F2ECE1] px-2 py-0.5 text-[10px] font-semibold text-[#6E655A] uppercase">
            Builds #fragment
          </span>
        </div>
        <p className="mt-1 text-xs text-[#6E655A]">
          Type a requester and purpose below to build a request fragment in the
          address bar.
        </p>

        <form
          onSubmit={handleBuildTestRequest}
          className="mt-3.5 flex flex-col gap-3"
        >
          <div>
            <label
              htmlFor="test-requester"
              className="block text-xs font-semibold text-[#4A433B]"
            >
              Requester name
            </label>
            <input
              id="test-requester"
              type="text"
              value={testRequesterName}
              onChange={(e) => setTestRequesterName(e.target.value)}
              placeholder="Type requester name…"
              className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2 text-sm text-[#1F1C18] placeholder-[#8C8275] focus:border-[#046A38] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="test-purpose"
              className="block text-xs font-semibold text-[#4A433B]"
            >
              Purpose
            </label>
            <input
              id="test-purpose"
              type="text"
              value={testPurpose}
              onChange={(e) => setTestPurpose(e.target.value)}
              placeholder="Type delivery purpose…"
              className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2 text-sm text-[#1F1C18] placeholder-[#8C8275] focus:border-[#046A38] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="test-language"
                className="block text-xs font-semibold text-[#4A433B]"
              >
                Courier&apos;s language
              </label>
              <select
                id="test-language"
                value={testLanguage}
                onChange={(e) => setTestLanguage(e.target.value as Language)}
                className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3 py-2 text-sm text-[#1F1C18] focus:border-[#046A38] focus:outline-none"
              >
                <option value="hi">Hindi (हिंदी)</option>
                <option value="mr">Marathi (मराठी)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="test-duration"
                className="block text-xs font-semibold text-[#4A433B]"
              >
                Duration
              </label>
              <select
                id="test-duration"
                value={testDuration}
                onChange={(e) => setTestDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3 py-2 text-sm text-[#1F1C18] focus:border-[#046A38] focus:outline-none"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.seconds} value={opt.seconds}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {testFormError && (
            <p className="text-xs font-medium text-[#8A2522]" role="alert">
              {testFormError}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 rounded-xl border border-[#B8862D] bg-[#FAF5EC] px-4 py-2.5 text-xs font-semibold text-[#1F1C18] transition hover:bg-[#F2E6D0]"
          >
            Load Request into #fragment
          </button>
        </form>
      </section>
    </main>
  );
}
