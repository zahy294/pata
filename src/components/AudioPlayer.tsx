"use client";
// Plays the directions clip from MP3 bytes (a blob: URL, revoked on unmount). Owner: frontend (P0-11).
// Fallback when there's no clip: speechSynthesis reading the directions text (ADR 0007).
export interface AudioPlayerProps {
  mp3Base64?: string;
  fallbackText?: string;
  lang: string;
}

export default function AudioPlayer(props: AudioPlayerProps) {
  void props;
  return <button disabled>Play directions (not built yet, P0-11)</button>;
}
