"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import "./MorphLoader.css";

export const MORPH_SHAPES = [
  "soft-burst",
  "cookie-9-sided",
  "pentagon",
  "pill",
  "sunny",
  "cookie-4-sided",
  "oval",
  "location",
  "flower",
] as const;
export type MorphShape = (typeof MORPH_SHAPES)[number];

// Equal point counts keep interpolation smooth without a path-morphing runtime.
function outline(shape: MorphShape): string {
  return `polygon(${Array.from({ length: 64 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 32;
    let radius = 23;
    let x: number;
    let y: number;
    if (shape === "pentagon") {
      const segment = (Math.PI * 2) / 5;
      const local = ((((angle + Math.PI / 2 + segment / 2) % segment) + segment) % segment) - segment / 2;
      radius = (24 * Math.cos(Math.PI / 5)) / Math.cos(local);
    } else if (shape === "soft-burst") radius = 21 + 3 * Math.cos(12 * angle);
    else if (shape === "cookie-9-sided") radius = 21 + 2.5 * Math.cos(9 * angle);
    else if (shape === "sunny") radius = 20 + 5 * Math.cos(8 * angle);
    else if (shape === "cookie-4-sided") radius = 21 + 3 * Math.cos(4 * angle);
    else if (shape === "flower") radius = 19 + 5 * Math.cos(6 * angle);
    if (shape === "pill") {
      const sine = Math.abs(Math.sin(angle));
      const cosine = Math.abs(Math.cos(angle));
      radius =
        sine > 0 && (15 * cosine) / sine <= 10 ? 15 / sine : 10 * cosine + Math.sqrt(225 - 100 * sine * sine);
    }
    x = radius * Math.cos(angle);
    y = radius * Math.sin(angle);
    if (shape === "oval" || shape === "location") {
      x = 19 * Math.cos(angle);
      y = 25 * Math.sin(angle);
    }
    return `${(50 + (x * 100) / 64).toFixed(2)}% ${(50 + (y * 100) / 64).toFixed(2)}%`;
  }).join(",")})`;
}
const OUTLINES = Object.fromEntries(MORPH_SHAPES.map((shape) => [shape, outline(shape)]));
const motionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotion = () => true;
const subscribeMotion = (changed: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
};

/** Compact web counterpart of the supplied native loader. Adjacent text names the loading state. */
export default function MorphLoader({
  size = 20,
  color = "currentColor",
  shapes = MORPH_SHAPES,
}: {
  size?: number;
  color?: string;
  shapes?: readonly MorphShape[];
}) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotion);
  const shape = reducedMotion ? "location" : (shapes[index % shapes.length] ?? "location");
  useEffect(() => {
    if (shapes.length < 2 || reducedMotion) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const resume = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible")
        timer = setInterval(() => setIndex((value) => value + 1), 850);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [shapes.length, reducedMotion]);
  return (
    <span className="pata-morph-loader" aria-hidden="true" style={{ width: size, height: size, color }}>
      <span
        className="pata-morph-loader__shape"
        style={{
          clipPath: OUTLINES[shape],
          opacity: shape === "location" ? 0 : 1,
          transform: `rotate(${index * 40}deg)`,
        }}
      />
      <span className="pata-morph-loader__pin" style={{ opacity: shape === "location" ? 1 : 0 }} />
    </span>
  );
}
