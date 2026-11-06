"use client";
// Plays the directions clip from MP3 bytes (a blob: URL, revoked on unmount). Owner: frontend (P0-11).
// Fallback when there's no clip: speechSynthesis reading the directions text (ADR 0007).
import { useEffect, useRef, useState } from "react";

export interface AudioPlayerProps {
  mp3Base64?: string;
  mp3Bytes?: Uint8Array;
  fallbackText?: string;
  lang: string;
  label?: string;
}

const BCP47_MAP: Record<string, string> = {
  hi: "hi-IN",
  mr: "mr-IN",
  en: "en-IN",
};

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function AudioPlayer({
  mp3Base64,
  mp3Bytes,
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

    let bytes: Uint8Array | null = null;
    if (mp3Bytes && mp3Bytes.byteLength > 0) {
      bytes = mp3Bytes;
    } else if (mp3Base64 && mp3Base64.length > 0) {
      try {
        bytes = decodeBase64(mp3Base64);
      } catch {
        bytes = null;
      }
    }

    if (bytes && bytes.byteLength > 64) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy.buffer], { type: "audio/mpeg" });
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
  }, [mp3Base64, mp3Bytes]);

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

  const disabled = !mp3Base64 && !mp3Bytes && !fallbackText;

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
