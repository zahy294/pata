"use client";
// Set up a household (P0-7, P0-8, P0-9). Owner: frontend; logic in src/lib/flows/setup-household.ts.
// Steps:
// 1. Sign in (device root / passkey) → flows.signIn().
// 2. "How do people find your door?": Recorder OR textarea; language picker (hi/mr/en);
//    separate input "Room or flat number" ("Stays on this phone"). → flows.describeTheWay(...).
//    If locality is null, ask for the area and PIN code.
// 3. → flows.findCandidatePins(...). PinPicker shows up to 3 candidates on MapView (or manual drop).
// 4. Confirm → show the DIGIPIN with formatDigipin.
// 5. → flows.makeDirections(...): show the three directions texts with play buttons (AudioPlayer).
// 6. Name: suggestHouseholdLabel() as a default, an input for her own with the rule from
//    isValidHouseholdLabel (ADR 0006) and a warning that names are public; check availability with householdLabelStatus.
// 7. → flows.createHousehold(...) with a progress list ("Reserving your name…", "Saving your home, locked…").
//    Then go to /.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Recorder from "../../components/Recorder";
import PinPicker from "../../components/PinPicker";
import AudioPlayer from "../../components/AudioPlayer";
import { encodeDigipin, formatDigipin } from "../../lib/digipin";
import { DEMO_BBOX } from "../../lib/map/config";
import { PROVIDER_NAME } from "../../../shared/constants";
import type {
  CandidatePin,
  DirectionsText,
  Language,
  LatLon,
  Locality,
  OsmFeature,
  Relation,
} from "../../../shared/domain";
import type { HouseholdKeys } from "../../lib/keys";
import type { SetupStep } from "../../lib/flows/setup-household";
import * as flows from "../../lib/flows/setup-household";

type FlowScreen = "signin" | "describe" | "pin" | "directions" | "name";

const LANGUAGE_LABELS: { code: Language; label: string; sub: string }[] = [
  { code: "hi", label: "हिंदी", sub: "Hindi" },
  { code: "mr", label: "मराठी", sub: "Marathi" },
  { code: "en", label: "English", sub: "English" },
];

const QUICK_CHIPS = [
  "Opposite Hanuman Mandir",
  "Blue iron gate",
  "Past the chai stall",
  "2nd floor staircase",
];

export default function SetupPage() {
  const router = useRouter();

  // Step 1: Sign in
  const [screen, setScreen] = useState<FlowScreen>("signin");
  const [keys, setKeys] = useState<HouseholdKeys | null>(null);
  const [signInLoading, setSignInLoading] = useState(true);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Step 2: Describe the way
  const [language, setLanguage] = useState<Language>("en");
  const [typedWay, setTypedWay] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);

  // Step 2b: Missing locality prompt (when describeTheWay returns locality: null)
  const [wayToTheDoor, setWayToTheDoor] = useState("");
  const [landmarkPhrases, setLandmarkPhrases] = useState<string[]>([]);
  const [needsLocalityPrompt, setNeedsLocalityPrompt] = useState(false);
  const [manualArea, setManualArea] = useState("");
  const [manualPinCode, setManualPinCode] = useState("");
  const [locality, setLocality] = useState<Locality | null>(null);

  // Step 3: Candidate pins
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidatePin[]>([]);
  const [bbox, setBbox] = useState<[number, number, number, number]>(DEMO_BBOX);

  // Step 4 & 5: Confirmed pin + DIGIPIN + Directions
  const [confirmedPin, setConfirmedPin] = useState<LatLon | null>(null);
  const [chosenCandidate, setChosenCandidate] = useState<CandidatePin | null>(
    null,
  );
  const [digipinCopied, setDigipinCopied] = useState(false);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const [directions, setDirections] = useState<DirectionsText | null>(null);
  const [voiceClips, setVoiceClips] = useState<
    Partial<Record<Language, Uint8Array>>
  >({});

  // Step 6: Household Name
  const [suggestedLabel, setSuggestedLabel] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "error"
  >("idle");

  // Step 7: Create household
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState<SetupStep | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  // createHousehold resumes from a checkpoint and refuses changed details, so the name locks once it starts.
  const [setupStarted, setSetupStarted] = useState(false);

  // Run Step 1 automatically on mount
  const handleSignIn = async () => {
    setSignInLoading(true);
    setSignInError(null);
    try {
      const k = await flows.signIn();
      setKeys(k);
      const initialSuggestion = flows.suggestHouseholdLabel();
      setSuggestedLabel(initialSuggestion);
      setLabelInput(initialSuggestion);
      setScreen("describe");
    } catch {
      setSignInError(
        "Could not prepare your device keys. Please tap Retry to try again.",
      );
    } finally {
      setSignInLoading(false);
    }
  };

  useEffect(() => {
    void handleSignIn();
  }, []);

  // Step 3 helper: fetch candidate pins once we have wayToTheDoor and a valid locality
  const runFindCandidatePins = async (
    activeKeys: HouseholdKeys,
    way: string,
    loc: Locality,
    phrases: string[],
  ) => {
    setPinsLoading(true);
    setPinsError(null);
    try {
      const ranked = await flows.findCandidatePins(
        activeKeys,
        way,
        loc,
        phrases,
      );
      setCandidates(ranked.candidates);
      setBbox(ranked.bbox);
      setScreen("pin");
    } catch (failure) {
      if (flows.isLocalityNotFound(failure)) {
        // Neither "area, PIN" nor the PIN alone is on the map: let the household correct them.
        setManualArea(loc.name);
        setManualPinCode(loc.pinCode);
        setNeedsLocalityPrompt(true);
        setPinsError(
          `We couldn't find "${loc.name}, ${loc.pinCode}" on the map. Check the area name and 6-digit PIN code below.`,
        );
      } else {
        setPinsError(
          "We could not search for nearby landmarks right now. Please tap Retry.",
        );
      }
    } finally {
      setPinsLoading(false);
    }
  };

  // Step 2 handler: describeTheWay
  const handleDescribeSubmit = async () => {
    if (!keys) return;
    const blobOrText: Blob | string = recordedBlob ?? typedWay.trim();
    if (!blobOrText || (typeof blobOrText === "string" && !blobOrText)) {
      setDescribeError(
        "Please record a short voice note or type how people find your door.",
      );
      return;
    }

    setDescribeLoading(true);
    setDescribeError(null);
    try {
      const result = await flows.describeTheWay(keys, blobOrText, language);
      setWayToTheDoor(result.wayToTheDoor);
      setLandmarkPhrases(result.landmarkPhrases);

      if (!result.locality) {
        setNeedsLocalityPrompt(true);
        return;
      }

      setLocality(result.locality);
      setNeedsLocalityPrompt(false);
      await runFindCandidatePins(
        keys,
        result.wayToTheDoor,
        result.locality,
        result.landmarkPhrases,
      );
    } catch (failure) {
      setDescribeError(flows.describeTheWayError(failure));
    } finally {
      setDescribeLoading(false);
    }
  };

  // Step 2b handler: when locality was null and user enters area + PIN code
  const handleManualLocalitySubmit = async () => {
    if (!keys) return;
    const trimmedArea = manualArea.trim();
    const trimmedPin = manualPinCode.trim();
    if (!trimmedArea || !/^\d{6}$/.test(trimmedPin)) {
      setDescribeError(
        "Please enter your neighbourhood name and a 6-digit PIN code.",
      );
      return;
    }
    const loc: Locality = { name: trimmedArea, pinCode: trimmedPin };
    setLocality(loc);
    setNeedsLocalityPrompt(false);
    setDescribeError(null);
    await runFindCandidatePins(keys, wayToTheDoor, loc, landmarkPhrases);
  };

  // Step 5 helper: makeDirections
  const runMakeDirections = async (
    pin: LatLon,
    chosen: CandidatePin | null,
  ) => {
    if (!keys) return;
    setDirectionsLoading(true);
    setDirectionsError(null);
    try {
      const landmarksArg: { feature: OsmFeature; relation: Relation }[] = chosen
        ? [{ feature: chosen.landmark, relation: chosen.relation }]
        : candidates.map((c) => ({
            feature: c.landmark,
            relation: c.relation,
          }));

      const res = await flows.makeDirections(
        keys,
        wayToTheDoor,
        pin,
        landmarksArg,
      );
      setDirections(res.directions);
      setVoiceClips(res.clips);
    } catch {
      setDirectionsError(
        "Could not prepare spoken directions right now. Please tap Retry.",
      );
    } finally {
      setDirectionsLoading(false);
    }
  };

  // Step 4 handler: confirm pin from PinPicker
  const handlePinConfirmed = (pin: LatLon, chosen: CandidatePin | null) => {
    setConfirmedPin(pin);
    setChosenCandidate(chosen);
    setScreen("directions");
    void runMakeDirections(pin, chosen);
  };

  // Step 6: Check availability whenever labelInput changes and is valid
  const checkAvailability = async (candidateLabel: string) => {
    const normalized = candidateLabel.trim().toLowerCase();
    if (!flows.isValidHouseholdLabel(normalized)) {
      setAvailabilityStatus("invalid");
      return;
    }
    setAvailabilityStatus("checking");
    try {
      const status = await flows.checkHouseholdName(normalized);
      setAvailabilityStatus(status);
    } catch {
      setAvailabilityStatus("error");
    }
  };

  useEffect(() => {
    // After registration this household owns the name, so "taken" would wrongly block a resume.
    if (screen !== "name" || setupStarted) return;
    const normalized = labelInput.trim().toLowerCase();
    if (!flows.isValidHouseholdLabel(normalized)) {
      setAvailabilityStatus("invalid");
      return;
    }
    const timer = setTimeout(() => {
      void checkAvailability(normalized);
    }, 250);
    return () => clearTimeout(timer);
  }, [labelInput, screen, setupStarted]);

  // Step 7: Create household
  const handleCreateHousehold = async () => {
    if (!keys || !locality || !confirmedPin || !directions) return;
    const normalizedLabel = labelInput.trim().toLowerCase();
    if (!flows.isValidHouseholdLabel(normalizedLabel)) {
      setCreateError(
        "Use 3–32 lowercase letters, numbers, or single hyphens.",
      );
      return;
    }

    setCreating(true);
    setSetupStarted(true);
    setCreateError(null);
    setCreateStep("topup-sepolia");

    try {
      await flows.createHousehold(
        keys,
        {
          label: normalizedLabel,
          locality,
          confirmedPin,
          roomNumber: roomNumber.trim(),
          writtenAddress: wayToTheDoor,
          directions,
          voiceClips,
          candidates,
        },
        (step) => {
          setCreateStep(step);
        },
      );
      router.push("/");
    } catch {
      setCreateError(
        "Could not finish saving your home right now. Tap Retry to resume from where it stopped.",
      );
    } finally {
      setCreating(false);
    }
  };

  const formattedDigipin = confirmedPin
    ? formatDigipin(encodeDigipin(confirmedPin))
    : "";

  const normalizedLabel = labelInput.trim().toLowerCase();
  const isLabelValid = flows.isValidHouseholdLabel(normalizedLabel);

  const isReservingDone =
    createStep === "voice-records" ||
    createStep === "home-record" ||
    createStep === "save" ||
    createStep === "complete";
  const isReservingActive =
    creating &&
    (createStep === "topup-sepolia" ||
      createStep === "topup-arkiv" ||
      createStep === "deploy" ||
      createStep === "register" ||
      createStep === "resolve");
  const isSavingDone = createStep === "complete";
  const isSavingActive =
    creating &&
    (createStep === "voice-records" ||
      createStep === "home-record" ||
      createStep === "save");

  return (
    <main className="flex flex-col gap-5 pb-8">
      {/* STEP 1: SIGN IN */}
      {screen === "signin" && (
        <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-6 shadow-sm">
          <span className="inline-flex items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
            Step 1 of 4 • Device Key
          </span>
          <h1 className="mt-3 font-serif text-2xl font-bold text-[#1F1C18]">
            Set up your home
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6E655A]">
            Creating a private key on this phone so only you can unlock your
            exact doorstep.
          </p>

          {signInLoading && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-4 text-sm font-medium text-[#1F1C18]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#046A38] border-t-transparent" />
              <span>Preparing your private device key…</span>
            </div>
          )}

          {signInError && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-4">
              <p className="text-sm text-[#8A2522]">{signInError}</p>
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="self-start rounded-lg bg-[#046A38] px-4 py-2 text-xs font-semibold text-[#FFFDF9]"
              >
                Retry Sign In
              </button>
            </div>
          )}
        </section>
      )}

      {/* STEP 2: HOW DO PEOPLE FIND YOUR DOOR? */}
      {screen === "describe" && (
        <div className="flex flex-col gap-4">
          {/* Header & Language Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
                Step 1 of 4 • Arrival Guidance
              </span>

              <div
                className="inline-flex rounded-full border border-[#E6DAC6] bg-[#FFFDF9] p-0.5"
                role="group"
                aria-label="Language picker"
              >
                {LANGUAGE_LABELS.map((lang) => {
                  const active = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-[#046A38] text-[#FFFDF9]"
                          : "text-[#6E655A] hover:text-[#1F1C18]"
                      }`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
              How do people find your door?
            </h1>
            <p className="text-sm text-[#6E655A]">
              Add recognizable landmarks and physical cues for swift delivery.
            </p>
          </div>

          {/* Ground Route Notes Card (Textarea) */}
          <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label
                htmlFor="way-textarea"
                className="text-sm font-bold text-[#1F1C18]"
              >
                Ground Route Notes
              </label>
              <span className="rounded-md bg-[#F2ECE1] px-2 py-0.5 text-[11px] font-medium text-[#6E655A]">
                Spoken or typed
              </span>
            </div>

            <textarea
              id="way-textarea"
              rows={3}
              value={typedWay}
              onChange={(e) => setTypedWay(e.target.value)}
              placeholder="e.g., Opposite Hanuman Mandir, Kumbharwada Lane 4, blue gate, Dharavi 400017"
              className="mt-2.5 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3 text-sm text-[#1F1C18] placeholder-[#8C8275] focus:border-[#046A38] focus:outline-none"
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#6E655A]">
                Add quickly:
              </span>
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() =>
                    setTypedWay((prev) =>
                      prev.trim() ? `${prev.trim()}, ${chip}` : chip,
                    )
                  }
                  className="rounded-full border border-[#E6DAC6] bg-[#FAF5EC] px-2.5 py-1 text-[11px] font-medium text-[#4A433B] transition hover:border-[#B8862D]"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </section>

          {/* Spoken Directions (Recorder) */}
          <Recorder
            onRecorded={(blob) => {
              setRecordedBlob(blob);
              setDescribeError(null);
            }}
          />

          {/* Separate Room or Flat Number Card — Deep Emerald Privacy Vault */}
          <section className="rounded-2xl bg-[#046A38] p-4 text-[#FFFDF9] shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFDF9]/15 text-xs">
                  🔒
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#FFFDF9]">
                    Room or flat number
                  </h2>
                  <p className="text-[11px] text-[#D2EBD9]">
                    Locked on this device — never sent to any AI or map server
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-[#FFFDF9]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#FFFDF9] uppercase">
                Stays on this phone
              </span>
            </div>

            <div className="mt-3">
              <label htmlFor="room-number-input" className="sr-only">
                Room or flat number
              </label>
              <input
                id="room-number-input"
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g., Room 14, Chawl 3, 2nd Floor"
                className="w-full rounded-xl bg-[#FFFDF9] px-3.5 py-2.5 text-sm font-medium text-[#1F1C18] placeholder-[#8C8275] focus:outline-none"
              />
            </div>
          </section>

          {/* Fallback prompt when locality is null */}
          {needsLocalityPrompt && (
            <section className="rounded-2xl border-2 border-[#B8862D] bg-[#FFFDF9] p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#1F1C18]">
                Add your area and PIN code
              </h3>
              <p className="mt-1 text-xs text-[#6E655A]">
                We could not spot your neighbourhood or 6-digit PIN code in the
                description. Please confirm them below:
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="manual-area"
                    className="block text-xs font-semibold text-[#4A433B]"
                  >
                    Area / Locality
                  </label>
                  <input
                    id="manual-area"
                    type="text"
                    value={manualArea}
                    onChange={(e) => setManualArea(e.target.value)}
                    placeholder="e.g., Dharavi"
                    className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3 py-2 text-sm text-[#1F1C18]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="manual-pincode"
                    className="block text-xs font-semibold text-[#4A433B]"
                  >
                    6-digit PIN Code
                  </label>
                  <input
                    id="manual-pincode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={manualPinCode}
                    onChange={(e) => setManualPinCode(e.target.value)}
                    placeholder="e.g., 400017"
                    className="mt-1 w-full rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3 py-2 font-mono text-sm text-[#1F1C18]"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={pinsLoading}
                onClick={() => void handleManualLocalitySubmit()}
                className="mt-3 w-full rounded-xl bg-[#B8862D] px-4 py-2.5 text-xs font-semibold text-[#FFFDF9] transition hover:bg-[#9E7122] disabled:opacity-50"
              >
                {pinsLoading
                  ? "Searching neighbourhood…"
                  : "Continue with Area & PIN →"}
              </button>
            </section>
          )}

          {/* Error Banner + Retry */}
          {(describeError || pinsError) && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-3.5">
              <p className="text-xs font-medium text-[#8A2522]">
                {describeError ?? pinsError}
              </p>
              <button
                type="button"
                onClick={() =>
                  needsLocalityPrompt
                    ? void handleManualLocalitySubmit()
                    : void handleDescribeSubmit()
                }
                className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Primary CTA */}
          {!needsLocalityPrompt && (
            <button
              type="button"
              disabled={describeLoading || pinsLoading}
              onClick={() => void handleDescribeSubmit()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D] disabled:opacity-50"
            >
              {describeLoading || pinsLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFFDF9] border-t-transparent" />
                  <span>Finding nearby landmarks…</span>
                </>
              ) : (
                <>
                  <span>Find My Door</span>
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* STEP 3: PICK & DRAG YOUR DOOR PIN */}
      {screen === "pin" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-[#F9EFDB] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#8A5F14] uppercase">
              Step 2 of 4 • Door Pin
            </span>
            {locality && (
              <span className="font-mono text-xs font-semibold text-[#6E655A] uppercase">
                {locality.name}, {locality.pinCode}
              </span>
            )}
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
              Pick & Drag Your Door Pin
            </h1>
            <p className="mt-1 text-sm text-[#6E655A]">
              Select the closest landmark match or drag the pin to your exact
              doorstep.
            </p>
          </div>

          <PinPicker
            candidates={candidates}
            bbox={bbox}
            onConfirm={handlePinConfirmed}
          />

          <button
            type="button"
            onClick={() => setScreen("describe")}
            className="self-center text-xs font-medium text-[#6E655A] underline hover:text-[#1F1C18]"
          >
            ← Edit door description
          </button>
        </div>
      )}

      {/* STEP 4 & 5: CONFIRMED DIGIPIN + SPOKEN DIRECTIONS */}
      {screen === "directions" && confirmedPin && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
              Step 3 of 4 • Door Code & Audio
            </span>
            {locality && (
              <span className="font-mono text-xs font-semibold text-[#6E655A] uppercase">
                {locality.name}, {locality.pinCode}
              </span>
            )}
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
              Your Door Code & Directions
            </h1>
            <p className="mt-1 text-sm text-[#6E655A]">
              Check your 4m × 4m DIGIPIN grid code and listen to the directions
              couriers will hear.
            </p>
          </div>

          {/* Official Civic DIGIPIN Card */}
          <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#046A38] uppercase">
                ✓ Official Civic DIGIPIN
              </span>
              <span className="rounded-md bg-[#F2ECE1] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#6E655A]">
                GRID 4M×4M
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-[#6E655A] uppercase">
                  Door Code
                </p>
                <p className="mt-0.5 font-mono text-xl font-bold tracking-wider text-[#1F1C18]">
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
                className="rounded-lg border border-[#D8CCB8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#1F1C18] shadow-2xs transition hover:border-[#B8862D]"
              >
                {digipinCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>

          {/* Spoken Directions in 3 Languages */}
          <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm">
            <h2 className="text-xs font-bold tracking-wider text-[#6E655A] uppercase">
              Doorstep Audio Instructions
            </h2>

            {directionsLoading && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#FAF5EC] p-4 text-sm text-[#1F1C18]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#B8862D] border-t-transparent" />
                <span>Generating Hindi, Marathi, and English voice guides…</span>
              </div>
            )}

            {directionsError && (
              <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-3.5">
                <p className="text-xs font-medium text-[#8A2522]">
                  {directionsError}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void runMakeDirections(confirmedPin, chosenCandidate)
                  }
                  className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
                >
                  Retry Directions
                </button>
              </div>
            )}

            {directions && !directionsLoading && (
              <div className="mt-3 flex flex-col gap-2.5">
                {LANGUAGE_LABELS.map((lang) => (
                  <div
                    key={lang.code}
                    className="flex items-start gap-3 rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] p-3"
                  >
                    <AudioPlayer
                      lang={lang.code}
                      label={`${lang.sub} directions`}
                      audioBytes={voiceClips[lang.code]}
                      fallbackText={directions[lang.code]}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1F1C18]">
                          {lang.label} ({lang.sub})
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#4A433B]">
                        {directions[lang.code]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button
            type="button"
            disabled={directionsLoading || !directions}
            onClick={() => setScreen("name")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D] disabled:opacity-50"
          >
            <span>Choose Your Home&apos;s Name</span>
            <span aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            onClick={() => setScreen("pin")}
            className="self-center text-xs font-medium text-[#6E655A] underline hover:text-[#1F1C18]"
          >
            ← Adjust door pin on map
          </button>
        </div>
      )}

      {/* STEP 6 & 7: CHOOSE YOUR HOME'S NAME + CREATE HOUSEHOLD */}
      {screen === "name" && confirmedPin && locality && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-[#E3F2E8] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#046A38] uppercase">
              Step 4 of 4 • Home Name
            </span>
            <span className="font-mono text-xs font-semibold text-[#046A38]">
              {formattedDigipin}
            </span>
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#1F1C18]">
              Choose Your Home&apos;s Name
            </h1>
            <p className="mt-1 text-sm text-[#6E655A]">
              A memorable name for deliveries and friends.
            </p>
          </div>

          {/* Name Input Card */}
          <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-[#6E655A] uppercase">
                Recommended Handle
              </span>
              <button
                type="button"
                disabled={setupStarted}
                onClick={() => {
                  const fresh = flows.suggestHouseholdLabel();
                  setSuggestedLabel(fresh);
                  setLabelInput(fresh);
                }}
                className="text-xs font-semibold text-[#046A38] hover:underline"
              >
                Suggest another
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2.5">
              <span className="font-mono text-sm font-bold text-[#1F1C18]">
                {suggestedLabel}.{PROVIDER_NAME}
              </span>
              <span className="rounded-full bg-[#046A38] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#FFFDF9] uppercase">
                Suggested
              </span>
            </div>

            <label
              htmlFor="household-label-input"
              className="mt-4 block text-[11px] font-semibold tracking-wider text-[#6E655A] uppercase"
            >
              Or customize your home&apos;s name
            </label>

            <div className="mt-1.5 flex items-center rounded-xl border border-[#E6DAC6] bg-[#FAF5EC] px-3.5 py-2.5 focus-within:border-[#046A38]">
              <input
                id="household-label-input"
                type="text"
                value={labelInput}
                disabled={creating || setupStarted}
                onChange={(e) => setLabelInput(e.target.value.toLowerCase())}
                placeholder="blue-gate"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold text-[#1F1C18] focus:outline-none"
              />
              <span className="font-mono text-xs text-[#6E655A]">
                .{PROVIDER_NAME}
              </span>
            </div>

            {/* Validation + Availability status */}
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-[#6E655A]">
                3–32 lowercase letters, numbers, or single hyphens
              </span>
              {!isLabelValid || availabilityStatus === "invalid" ? (
                <span className="font-semibold text-[#8A2522]">
                  Invalid format
                </span>
              ) : availabilityStatus === "checking" ? (
                <span className="font-medium text-[#8A5F14]">Checking…</span>
              ) : availabilityStatus === "available" ? (
                <span className="rounded-full bg-[#E3F2E8] px-2.5 py-0.5 font-semibold text-[#046A38]">
                  ✓ Available
                </span>
              ) : availabilityStatus === "taken" ? (
                <span className="rounded-full bg-[#FDF3F2] px-2.5 py-0.5 font-semibold text-[#8A2522]">
                  Already taken
                </span>
              ) : availabilityStatus === "error" ? (
                <button
                  type="button"
                  onClick={() => void checkAvailability(normalizedLabel)}
                  className="font-semibold text-[#B8862D] underline"
                >
                  Retry check
                </button>
              ) : null}
            </div>
          </section>

          {/* Public Label Warning Card (ADR 0006) */}
          <section className="rounded-2xl border border-[#E2D2B5] bg-[#F5EBDC] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B8862D] text-sm text-[#FFFDF9]">
                🛡️
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1F1C18]">
                  Public Name, Private Door
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#4A433B]">
                  Names and your locality (
                  <span className="font-mono font-semibold">
                    {locality.name}, {locality.pinCode}
                  </span>
                  ) are public. Your exact door, room number, and voice
                  directions stay locked until you share a temporary link.
                </p>
              </div>
            </div>
          </section>

          {/* Progress Checklist Card */}
          <section className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-[#6E655A] uppercase">
                Door Registration
              </span>
              <span className="text-xs font-semibold text-[#046A38]">
                {creating ? "In Progress…" : "Ready to Seal"}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isReservingDone
                      ? "bg-[#046A38] text-[#FFFDF9]"
                      : isReservingActive
                        ? "border-2 border-[#046A38] text-[#046A38]"
                        : "bg-[#F2ECE1] text-[#6E655A]"
                  }`}
                >
                  {isReservingDone ? "✓" : "1"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1F1C18]">
                    Reserving your name…
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isSavingDone
                      ? "bg-[#046A38] text-[#FFFDF9]"
                      : isSavingActive
                        ? "border-2 border-[#B8862D] text-[#B8862D]"
                        : "bg-[#F2ECE1] text-[#6E655A]"
                  }`}
                >
                  {isSavingDone ? "✓" : "2"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1F1C18]">
                    Saving your home, locked…
                  </p>
                </div>
              </div>
            </div>
          </section>

          {createError && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#D9534F]/30 bg-[#FDF3F2] p-3.5">
              <p className="text-xs font-medium text-[#8A2522]">{createError}</p>
              <button
                type="button"
                onClick={() => void handleCreateHousehold()}
                className="self-start rounded-lg bg-[#046A38] px-3 py-1.5 text-xs font-semibold text-[#FFFDF9]"
              >
                Retry Saving Home
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={
              creating ||
              !isLabelValid ||
              (!setupStarted &&
                (availabilityStatus === "taken" || availabilityStatus === "checking"))
            }
            onClick={() => void handleCreateHousehold()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D] disabled:opacity-50"
          >
            {creating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFFDF9] border-t-transparent" />
                <span>Saving your home…</span>
              </>
            ) : (
              <>
                <span>Save &amp; Finish Setup</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>
      )}
    </main>
  );
}
