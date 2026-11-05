"use client";
// Candidate pins → one confirmed pin (P0-7). Owner: frontend.
// Shows up to 3 CandidatePins on MapView with their landmark, relation and confidence (low/medium/high),
// lets the household pick one and drag it, or drop one by hand when there are none.
import type { CandidatePin, LatLon } from "../../shared/domain";

export interface PinPickerProps {
  candidates: CandidatePin[];
  bbox: [number, number, number, number];
  onConfirm: (pin: LatLon, chosen: CandidatePin | null) => void;
}

export default function PinPicker(props: PinPickerProps) {
  void props;
  return <div>Pin picker (not built yet, P0-7)</div>;
}
