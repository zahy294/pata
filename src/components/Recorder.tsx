"use client";
// Records the way to the door with MediaRecorder (≤ 30 s, Sarvam's REST limit). Owner: frontend (P0-7).
// Needs HTTPS on phones, so test on the deployed preview, not localhost (SETUP.md §4).
import { useEffect, useRef, useState } from "react";

export interface RecorderProps {
  onRecorded: (audio: Blob) => void;
  maxSeconds?: number;
}

export default function Recorder({
  onRecorded,
  // Sarvam and inspectRecording reject anything over 30 s, and the timer below checks every 250 ms and the
  // recorder flushes after stop, so stopping at 30 produced ~30.2 s files that always failed. Stop at 28.
  maxSeconds = 28,
}: RecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    setError(null);
    setHasRecorded(false);
    setElapsed(0);
    chunksRef.current = [];

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice recording isn't available on this browser. Please type above.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        cleanup();
        setRecording(false);
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) {
          setHasRecorded(true);
          onRecorded(blob);
        }
      };

      recorder.start();
      setRecording(true);

      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        if (secs >= maxSeconds) {
          setElapsed(maxSeconds);
          stopRecording();
        } else {
          setElapsed(secs);
        }
      }, 250);
    } catch {
      cleanup();
      setRecording(false);
      setError("Could not use the microphone. Check permission or type above.");
    }
  };

  const formatSecs = (s: number) => `0:${String(s).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-[#E6DAC6] bg-[#FAF5EC]/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1F1C18]">
            Spoken Directions
          </span>
        </div>
        <span className="rounded-md bg-[#EFE5D4] px-2 py-0.5 font-mono text-xs text-[#6B5E4C]">
          {recording
            ? `${formatSecs(elapsed)} / ${formatSecs(maxSeconds)}`
            : `${formatSecs(maxSeconds)} max`}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? "Stop recording" : "Record voice directions"}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-md transition active:scale-95 ${
            recording
              ? "animate-pulse bg-[#C83E2B] ring-4 ring-[#C83E2B]/25"
              : "bg-[#B8862D] hover:bg-[#A37422]"
          }`}
        >
          {recording ? (
            <span className="h-4 w-4 rounded-sm bg-white" />
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"
              />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <div className="mb-1.5 flex h-6 items-center gap-1" aria-hidden="true">
            {[3, 6, 4, 8, 5, 9, 4, 7, 3, 6, 8, 4, 5].map((h, i) => (
              <span
                key={i}
                style={{ height: `${recording ? Math.max(25, ((elapsed + i) % 4) * 25 + 20) : h * 10}%` }}
                className={`w-1 rounded-full transition-all duration-200 ${
                  recording
                    ? "bg-[#B8862D]"
                    : hasRecorded
                      ? "bg-[#046A38]"
                      : "bg-[#D5C5AC]"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-[#6B5E4C]">
            {recording
              ? "Listening… Tap the square button when done."
              : hasRecorded
                ? "Voice note recorded. Tap mic to record again."
                : "Tap mic to speak how people find your door."}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-[#B43B28]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
