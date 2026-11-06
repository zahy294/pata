"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      reducedMotion.current = media.matches;
    };
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => {
      clearTimeout(timer.current);
      media.removeEventListener("change", updateMotion);
    };
  }, []);
  const finish = () => {
    clearTimeout(timer.current);
    setPhase("home");
  };
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
    timer.current = setTimeout(finish, 950);
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
          <div
            className={`pata-intro__door pata-intro__left`}
            aria-hidden="true"
            onTransitionEnd={(event) => {
              if (
                event.target === event.currentTarget &&
                event.propertyName === "transform" &&
                phase === "opening"
              )
                finish();
            }}
          />
          <div className={`pata-intro__door pata-intro__right`} aria-hidden="true" />
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
                <h1 className="pata-intro__wordmark">Pata</h1>
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
