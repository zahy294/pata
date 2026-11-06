"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "./PageTransition.css";

// Arrival only: never retain a departing courier view or delay router navigation.
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const content = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!content.current || !edge.current || !content.current.animate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const timing = { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
    const reveal = content.current.animate(
      [
        { opacity: 0.94, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      timing,
    );
    const accent = edge.current.animate(
      [
        { opacity: 0, transform: "scaleY(0.3)" },
        { opacity: 0.65, transform: "scaleY(1)", offset: 0.3 },
        { opacity: 0, transform: "scaleY(1)" },
      ],
      timing,
    );
    const cancel = () => {
      reveal.cancel();
      accent.cancel();
    };
    const preferenceChanged = () => {
      if (reduced.matches) cancel();
    };
    reduced.addEventListener("change", preferenceChanged);
    return () => {
      cancel();
      reduced.removeEventListener("change", preferenceChanged);
    };
  }, [pathname]);

  return (
    <div className="pata-page-transition">
      <span ref={edge} className="pata-page-transition__edge" aria-hidden="true" />
      <div ref={content}>{children}</div>
    </div>
  );
}
