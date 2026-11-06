"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import "./HomeIntro.css";
const SESSION_KEY = "pata.intro.seen.v1";
const serverSeen = () => false;
const sessionSeen = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};
const subscribeSession = (changed: () => void) => {
  window.addEventListener("storage", changed);
  return () => window.removeEventListener("storage", changed);
};

/** Home-only welcome: courier and other direct links never pass through this component. */
export default function HomeIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"intro" | "opening" | "home">("intro");
  // The server snapshot keeps browser storage out of static rendering.
  const seen = useSyncExternalStore(subscribeSession, sessionSeen, serverSeen);
  const entered = phase === "home" || (phase === "intro" && seen);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const stopMotion = useRef<(() => void) | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotion = useRef(false);
  const finish = useCallback(() => {
    clearTimeout(timer.current);
    stopMotion.current?.();
    stopMotion.current = undefined;
    setPhase("home");
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      reducedMotion.current = media.matches;
      if (media.matches && stopMotion.current) finish();
    };
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => {
      clearTimeout(timer.current);
      stopMotion.current?.();
      media.removeEventListener("change", updateMotion);
    };
  }, [finish]);
  useEffect(() => {
    if (phase !== "opening") return;
    let disposed = false;
    const frame = requestAnimationFrame(() => {
      const wordmark = wordmarkRef.current;
      const dialog = dialogRef.current;
      const target = document.querySelector<HTMLElement>(".pata-header-wordmark");
      if (!wordmark || !dialog || !target || !wordmark.animate || reducedMotion.current) {
        finish();
        return;
      }
      const animations: Animation[] = [];
      const oldVisibility = target.style.visibility;
      const oldWordmarkStyle = wordmark.getAttribute("style");
      const cancel = () => {
        disposed = true;
        animations.forEach((animation) => animation.cancel());
        target.style.visibility = oldVisibility;
        if (oldWordmarkStyle === null) wordmark.removeAttribute("style");
        else wordmark.setAttribute("style", oldWordmarkStyle);
        window.removeEventListener("resize", finish);
      };
      stopMotion.current = cancel;
      try {
        const from = wordmark.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        if (!from.width || !to.width) {
          finish();
          return;
        }
        const x = to.left - from.left;
        const y = to.top - from.top;
        const scale = to.width / from.width;
        const originX = from.left + from.width / 2;
        const originY = from.top + from.height / 2;
        dialog.style.setProperty("--intro-origin-x", `${originX}px`);
        dialog.style.setProperty("--intro-origin-y", `${originY}px`);
        dialog.dataset.flight = "true";
        Object.assign(wordmark.style, {
          position: "fixed",
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          margin: "0",
          transformOrigin: "top left",
          zIndex: "3",
        });
        target.style.visibility = "hidden";
        const timing: KeyframeAnimationOptions = {
          duration: 900,
          easing: "cubic-bezier(0.65, 0, 0.2, 1)",
          fill: "forwards",
        };
        const flight = wordmark.animate(
          [
            { transform: "translate(0, 0) scale(1)" },
            {
              transform: `translate(${x * 0.5}px, ${y * 0.64}px) scale(${1 - (1 - scale) * 0.5})`,
              offset: 0.5,
            },
            { transform: `translate(${x}px, ${y}px) scale(${scale})` },
          ],
          timing,
        );
        animations.push(flight);
        // Switch to the header's ink as the cream home surface opens beneath it.
        animations.push(
          wordmark.animate([{ color: "#FAF5EC" }, { color: getComputedStyle(target).color }], {
            duration: 200,
            delay: 90,
            fill: "forwards",
            easing: "ease-out",
          }),
        );
        const masthead = dialog.querySelector(".pata-intro__masthead");
        if (masthead)
          animations.push(
            masthead.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: 280,
              fill: "forwards",
              easing: "ease-out",
            }),
          );
        const directions = [
          [-1, -1],
          [1, -1],
          [1, -0.35],
          [1, 1],
          [0.35, 1],
          [-1, 1],
          [-1, 0.35],
          [-1, -0.35],
        ];
        dialog.querySelectorAll<HTMLElement>(".pata-intro__sector").forEach((sector, i) => {
          const [dx, dy] = directions[i];
          animations.push(
            sector.animate(
              [
                { transform: "translate(0,0)", opacity: 1 },
                { opacity: 1, offset: 0.3 },
                {
                  transform: `translate(${dx * innerWidth * 0.85}px,${dy * innerHeight * 0.85}px)`,
                  opacity: 0,
                },
              ],
              { ...timing, duration: 820, delay: (i % 3) * 20 },
            ),
          );
        });
        for (const [selector, transform] of [
          [".pata-intro__logo", "translate(-48px,-80px)"],
          [".pata-intro__hindi", "translate(48px,-80px)"],
          [".pata-intro__message", "translateY(100px)"],
          [".pata-intro__actions", "translateY(140px)"],
          [".pata-intro__doorway", "scale(1.3)"],
        ]) {
          const part = dialog.querySelector(selector);
          if (part)
            animations.push(
              part.animate(
                [
                  { opacity: 1, transform: "none" },
                  { opacity: 0, transform },
                ],
                { ...timing, duration: 380, easing: "cubic-bezier(0.4, 0, 1, 1)" },
              ),
            );
        }
        window.addEventListener("resize", finish, { once: true });
        timer.current = setTimeout(finish, 1200);
        void flight.finished.then(
          () => {
            if (!disposed) finish();
          },
          () => {},
        );
      } catch {
        finish();
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer.current);
      stopMotion.current?.();
      stopMotion.current = undefined;
    };
  }, [phase, finish]);
  const enter = (immediate = false) => {
    if (phase === "opening" && !immediate) return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* Best effort only. */
    }
    if (immediate || reducedMotion.current) {
      finish();
      return;
    }
    setPhase("opening");
  };
  useEffect(() => {
    if (entered) {
      const heading = homeRef.current?.querySelector("h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.close();
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [entered]);
  return (
    <>
      {!entered && (
        <dialog
          ref={dialogRef}
          open
          aria-label="Welcome to Pata"
          aria-describedby="intro-tagline"
          className="pata-intro"
          data-opening={phase === "opening"}
          onCancel={(event) => {
            event.preventDefault();
            enter(true);
          }}
        >
          <div className="pata-intro__surface" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="pata-intro__sector" />
            ))}
          </div>
          <div className="pata-intro__composition">
            <div className="pata-intro__masthead">
              <Image
                className="pata-intro__logo"
                src="/pata-app-icon.svg"
                alt="Pata app icon"
                width={48}
                height={48}
                priority
              />
              <span lang="hi" className="pata-intro__hindi">
                पता
              </span>
            </div>
            <div className="pata-intro__center">
              <div className="pata-intro__hero">
                <svg className="pata-intro__doorway" viewBox="0 0 320 380" fill="none" aria-hidden="true">
                  <path d="M36 374V145a124 124 0 0 1 248 0v229M52 374V145a108 108 0 0 1 216 0v229" />
                  <path d="M16 374h288M160 24V8M28 145H12m296 0h-16" />
                  <circle cx="160" cy="8" r="3" />
                </svg>
                <h1 ref={wordmarkRef} className="pata-intro__wordmark">
                  Pata
                </h1>
              </div>
              <div className="pata-intro__message">
                <h2 id="intro-tagline">
                  Your door.
                  <br />
                  <em>Your say.</em>
                </h2>
              </div>
            </div>
            <div className="pata-intro__actions">
              <button
                className="pata-intro__enter"
                type="button"
                disabled={phase === "opening"}
                onClick={() => enter()}
              >
                <span>Enter Pata</span>
                <span className="pata-intro__arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </dialog>
      )}
      <div ref={homeRef} inert={!entered} aria-hidden={!entered ? true : undefined}>
        {children}
      </div>
    </>
  );
}
