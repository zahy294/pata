"use client";
// Plays the directions clip from AAC bytes (a blob: URL with audio/aac, revoked on unmount). Owner: frontend (P0-11).
// Fallback when there's no clip: speechSynthesis reading the directions text (ADR 0007, ADR 0009).
import { useEffect, useRef, useState } from "react";

export interface AudioPlayerProps {
  audioBytes?: Uint8Array | null;
  fallbackText?: string;
  lang: string;
  label?: string;
}

const BCP47_MAP: Record<string, string> = {
  hi: "hi-IN",
  mr: "mr-IN",
  en: "en-IN",
};

export default function AudioPlayer({
  audioBytes,
  fallbackText,
  lang,
  label = "Play",
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (audioBytes && audioBytes.byteLength > 64) {
      const copy = new Uint8Array(audioBytes.byteLength);
      copy.set(audioBytes);
      const blob = new Blob([copy.buffer], { type: "audio/aac" });
      blobUrlRef.current = URL.createObjectURL(blob);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioBytes]);

  const speakFallback = () => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !fallbackText
    ) {
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(fallbackText);
    utterance.lang = BCP47_MAP[lang] ?? lang;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggle = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    if (blobUrlRef.current) {
      const audio = new Audio(blobUrlRef.current);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        speakFallback();
      };
      setIsPlaying(true);
      audio.play().catch(() => {
        speakFallback();
      });
      return;
    }

    speakFallback();
  };

  const disabled = (!audioBytes || audioBytes.byteLength === 0) && !fallbackText;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      aria-label={isPlaying ? `Stop ${label}` : `Play ${label}`}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#B8862D] text-[#FFFDF9] shadow-sm transition hover:bg-[#9E7122] active:scale-95 disabled:opacity-40"
    >
      {isPlaying ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg
          className="ml-0.5 h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
      )}
    </button>
  );
}
