"use client";
// Candidate pins → one confirmed pin (P0-7). Owner: frontend.
// Shows up to 3 CandidatePins on MapView with their landmark, relation and confidence (low/medium/high),
// lets the household pick one and drag it, or drop one by hand when there are none.
import { useState, useMemo } from "react";
import type { CandidatePin, LatLon } from "../../shared/domain";
import MapView from "./MapView";

type MapPinItem = { point: LatLon; label: string; draggable?: boolean };

export interface PinPickerProps {
  candidates: CandidatePin[];
  bbox: [number, number, number, number];
  onConfirm: (pin: LatLon, chosen: CandidatePin | null) => void;
}

const RELATION_LABEL: Record<CandidatePin["relation"], string> = {
  at: "At",
  opposite: "Opposite",
  behind: "Behind",
  near: "Near",
};

const CONFIDENCE_STYLE: Record<
  CandidatePin["confidence"],
  { label: string; className: string }
> = {
  high: {
    label: "HIGH",
    className:
      "bg-[#E3F2E8] text-[#046A38] border border-[#046A38]/20 font-semibold",
  },
  medium: {
    label: "MEDIUM",
    className:
      "bg-[#F9EFDB] text-[#8A5F14] border border-[#B8862D]/30 font-semibold",
  },
  low: {
    label: "LOW",
    className:
      "bg-[#F2ECE1] text-[#6E655A] border border-[#D8CCB8] font-semibold",
  },
};

export default function PinPicker({
  candidates,
  bbox,
  onConfirm,
}: PinPickerProps) {
  const visibleCandidates = useMemo(
    () => candidates.slice(0, 3),
    [candidates],
  );

  const bboxCenter = useMemo<LatLon>(
    () => ({
      // bbox is [west, south, east, north] (shared/api.ts RankResponse, map/config.ts).
      lat: (bbox[1] + bbox[3]) / 2,
      lon: (bbox[0] + bbox[2]) / 2,
    }),
    [bbox],
  );

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [customPoints, setCustomPoints] = useState<Record<number, LatLon>>({});
  const [manualPin, setManualPin] = useState<LatLon>(bboxCenter);

  const hasCandidates = visibleCandidates.length > 0;
  const activeCandidate = hasCandidates
    ? (visibleCandidates[selectedIndex] ?? visibleCandidates[0])
    : null;

  const activePoint: LatLon = hasCandidates
    ? (customPoints[selectedIndex] ?? activeCandidate!.point)
    : manualPin;

  const mapPins = useMemo<MapPinItem[]>(() => {
    if (!hasCandidates) {
      return [
        {
          point: manualPin,
          label: "Your Door (Drag to adjust)",
          draggable: true,
        },
      ];
    }
    return visibleCandidates.map((c, idx) => {
      const pt = customPoints[idx] ?? c.point;
      const isSelected = idx === selectedIndex;
      return {
        point: pt,
        label: isSelected
          ? `Pin #${idx + 1}: ${c.landmark.name} (Drag to adjust)`
          : `Pin #${idx + 1}: ${c.landmark.name}`,
        draggable: true,
      };
    });
  }, [hasCandidates, manualPin, visibleCandidates, customPoints, selectedIndex]);

  const handlePinMoved = (index: number, newPoint: LatLon) => {
    if (!hasCandidates) {
      setManualPin(newPoint);
      return;
    }
    setSelectedIndex(index);
    setCustomPoints((prev) => ({
      ...prev,
      [index]: newPoint,
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Map Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] shadow-sm">
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#1F1C18]/85 px-3.5 py-1 text-xs font-medium text-[#FAF5EC] shadow-md backdrop-blur-sm">
          {hasCandidates
            ? "Tap the map or drag the pin to your doorstep"
            : "Tap the map where your door is"}
        </div>

        <MapView
          center={activePoint}
          pins={mapPins}
          onPinMoved={handlePinMoved}
          onMapClick={(point) => handlePinMoved(hasCandidates ? selectedIndex : 0, point)}
        />

        <div className="flex items-center justify-between border-t border-[#E6DAC6] bg-[#FFFDF9] px-3.5 py-2 text-xs text-[#6E655A]">
          <span className="font-mono">
            {activePoint.lat.toFixed(4)}° N, {activePoint.lon.toFixed(4)}° E
          </span>
          <span className="font-medium text-[#B8862D]">
            {hasCandidates
              ? `Pin #${selectedIndex + 1} Selected`
              : "Manual Door Pin"}
          </span>
        </div>
      </div>

      {/* Candidate List or Empty Fallback Notice */}
      {hasCandidates ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-[#6E655A] uppercase">
              Verified Landmark References
            </span>
            <span className="text-xs font-medium text-[#046A38]">
              {visibleCandidates.length} Detected
            </span>
          </div>

          {visibleCandidates.map((c, idx) => {
            const isSelected = idx === selectedIndex;
            const conf = CONFIDENCE_STYLE[c.confidence];
            const isDragged = Boolean(customPoints[idx]);

            return (
              <button
                key={`${c.landmark.osmId}-${idx}`}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-[#B8862D] bg-[#FFFDF9] ring-2 ring-[#B8862D]/20 shadow-sm"
                    : "border-[#E6DAC6] bg-[#FFFDF9]/70 hover:border-[#D4C3A8] hover:bg-[#FFFDF9]"
                }`}
              >
                {/* Radio indicator */}
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? "border-[#B8862D] bg-[#B8862D]"
                      : "border-[#C8B99E] bg-transparent"
                  }`}
                >
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-[#FFFDF9]" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-[#1F1C18]">
                        {c.landmark.name}
                      </span>
                      <span className="rounded-md bg-[#F2ECE1] px-2 py-0.5 text-[11px] font-medium text-[#5A5248]">
                        {RELATION_LABEL[c.relation]}
                      </span>
                    </div>

                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] tracking-wider uppercase ${conf.className}`}
                    >
                      {conf.label}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-3 text-xs text-[#6E655A]">
                    <span className="font-mono">
                      Distance: {Math.round(c.metresFromLandmark)}m
                    </span>
                    {isDragged && (
                      <span className="text-[11px] font-medium text-[#B8862D]">
                        • Adjusted by hand
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E6DAC6] bg-[#FFFDF9] p-4">
          <p className="text-sm font-semibold text-[#1F1C18]">
            Drop a pin on your door
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#6E655A]">
            We could not match a nearby landmark automatically. Zoom in on the
            map above and tap your exact entrance, or drag the pin there.
          </p>
        </div>
      )}

      {/* Confirm CTA */}
      <button
        type="button"
        onClick={() => onConfirm(activePoint, activeCandidate)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#046A38] px-4 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm transition hover:bg-[#03562D] active:scale-[0.99]"
      >
        <span>Confirm Door Pin</span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
