"use client";

import { useEffect, useRef } from "react";
import {
  Map,
  Marker,
  setWorkerUrl,
  addProtocol,
  LngLatBounds,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { ATTRIBUTION, DEMO_BBOX } from "../lib/map/config";
import type { LatLon } from "../../shared/domain";

export interface MapViewProps {
  center?: LatLon;
  pins?: { point: LatLon; label: string; draggable?: boolean }[];
  onPinMoved?: (index: number, point: LatLon) => void;
  /** A tap on the map itself (not on a pin): the pin picker moves the active pin there. */
  onMapClick?: (point: LatLon) => void;
  bbox?: [number, number, number, number];
}

let protocolRegistered = false;
function ensureProtocol() {
  if (!protocolRegistered && typeof window !== "undefined") {
    try {
      const protocol = new Protocol();
      addProtocol("pmtiles", protocol.tile);
      protocolRegistered = true;
    } catch {
      // Protocol might already be added
    }
  }
}

export default function MapViewInner({
  center,
  pins,
  onPinMoved,
  onMapClick,
  bbox,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      setWorkerUrl(
        new URL(
          "maplibre-gl/dist/maplibre-gl-worker.mjs",
          import.meta.url,
        ).toString(),
      );
    } catch {
      // Worker fallback
    }
    ensureProtocol();

    // Default center inside DEMO_BBOX (Dharavi)
    const initialCenterLng = center?.lon ?? (DEMO_BBOX[0] + DEMO_BBOX[2]) / 2;
    const initialCenterLat = center?.lat ?? (DEMO_BBOX[1] + DEMO_BBOX[3]) / 2;

    const map = new Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [initialCenterLng, initialCenterLat],
      zoom: 14,
      minZoom: 11,
      maxZoom: 19,
      // No maxBounds: tiles come from OpenFreeMap worldwide, and clamping to the demo box hid the pin for
      // any home outside Dharavi/BKC.
      attributionControl: {
        customAttribution: ATTRIBUTION,
      },
    });

    mapRef.current = map;
    map.on("click", (event) => {
      onMapClickRef.current?.({ lat: event.lngLat.lat, lon: event.lngLat.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fit the locality once per bbox, and follow the pin without undoing the household's zoom. (One effect
  // for both re-fitted the whole locality after every drag, so a precise placement snapped back out.)
  const bboxKey = bbox?.join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bbox) return;
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 30, maxZoom: 16 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxKey]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center || bbox) return;
    map.easeTo({ center: [center.lon, center.lat], zoom: Math.max(map.getZoom(), 15) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lon]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) {
      m.remove();
    }
    markersRef.current = [];

    if (!pins || pins.length === 0) return;

    pins.forEach((pin, index) => {
      const el = document.createElement("div");
      el.className =
        "group relative flex flex-col items-center cursor-pointer";

      if (pin.label) {
        const labelEl = document.createElement("div");
        labelEl.className =
          "mb-1 whitespace-nowrap rounded-md bg-neutral-900/90 px-2 py-0.5 text-xs font-medium text-white shadow-md pointer-events-none";
        labelEl.textContent = pin.label;
        el.appendChild(labelEl);
      }

      const pinIcon = document.createElement("div");
      pinIcon.className =
        "h-6 w-6 rounded-full border-2 border-white bg-blue-600 shadow-md transition-transform group-hover:scale-110";
      if (pin.draggable) {
        pinIcon.className =
          "h-7 w-7 rounded-full border-2 border-white bg-emerald-600 shadow-lg ring-2 ring-emerald-300 transition-transform group-hover:scale-110";
      }
      el.appendChild(pinIcon);

      const marker = new Marker({
        element: el,
        draggable: pin.draggable ?? false,
      })
        .setLngLat([pin.point.lon, pin.point.lat])
        .addTo(map);

      if (pin.draggable) {
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          onPinMoved?.(index, { lat: lngLat.lat, lon: lngLat.lng });
        });
      }

      markersRef.current.push(marker);
    });

    if (!center && !bbox && pins.length > 1) {
      const bounds = new LngLatBounds();
      pins.forEach((p) => bounds.extend([p.point.lon, p.point.lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
    }
  }, [pins, onPinMoved, center, bbox]);

  return (
    <div
      ref={containerRef}
      className="relative h-72 w-full overflow-hidden rounded-xl bg-neutral-100 shadow-sm"
      aria-label="Map view"
    />
  );
}
