"use client";
// Records the way to the door with MediaRecorder (≤ 30 s, Sarvam's REST limit). Owner: frontend (P0-7).
// Needs HTTPS on phones, so test on the deployed preview, not localhost (SETUP.md §4).
export interface RecorderProps {
  onRecorded: (audio: Blob) => void;
  maxSeconds?: number;
}

export default function Recorder(props: RecorderProps) {
  void props;
  return <button disabled>Record (not built yet, P0-7)</button>;
}
