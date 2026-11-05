"use client";
// Client-only map. Owner: frontend (P0-7). Read docs/research/maps.md.
// Pattern (nextjs-pwa.md): this wrapper does dynamic(() => import("./MapViewInner"), { ssr: false }),
// because MapLibre needs `window`. MapViewInner registers the pmtiles protocol, uses @protomaps/basemaps
// for the style, calls setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)),
// clamps to DEMO_BBOX and shows ATTRIBUTION (src/lib/map/config.ts).
import type { LatLon } from "../../shared/domain";

export interface MapViewProps {
  center?: LatLon;
  pins?: { point: LatLon; label: string; draggable?: boolean }[];
  onPinMoved?: (index: number, point: LatLon) => void;
  bbox?: [number, number, number, number];
}

export default function MapView(props: MapViewProps) {
  void props;
  return <div className="h-72 w-full rounded bg-neutral-100" aria-label="Map (not built yet, P0-7)" />;
}
