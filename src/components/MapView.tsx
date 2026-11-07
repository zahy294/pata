"use client";
// Client-only map. Owner: frontend (P0-7). Read docs/research/maps.md.
// Pattern (nextjs-pwa.md): this wrapper does dynamic(() => import("./MapViewInner"), { ssr: false }),
// because MapLibre needs `window`. MapViewInner registers the pmtiles protocol, uses @protomaps/basemaps
// for the style, calls setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)),
// starts at DEMO_BBOX's centre (no clamp: the tiles are worldwide) and shows ATTRIBUTION (src/lib/map/config.ts).
import dynamic from "next/dynamic";
import MorphLoader from "./MorphLoader";
import type { MapViewProps } from "./MapViewInner";

const MapViewInner = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-96 w-full items-center justify-center gap-3 rounded-xl bg-neutral-100 text-sm text-neutral-400"
      aria-label="Loading map…"
    >
      <MorphLoader size={28} color="#046A38" />
      <span>Loading map…</span>
    </div>
  ),
});

export default function MapView(props: MapViewProps) {
  return <MapViewInner {...props} />;
}

export type { MapViewProps };
