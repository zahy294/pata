"use client";

import { useState } from "react";
import MapView from "../../components/MapView";
import type { LatLon } from "../../../shared/domain";

// Set up a household (P0-7, P0-8, P0-9). Owner: frontend; logic in src/lib/flows/setup-household.ts.
export default function SetupPage() {
  const [pin, setPin] = useState<LatLon>({ lat: 19.0432, lon: 72.8541 });

  const handlePinMoved = (index: number, newPoint: LatLon) => {
    void index;
    setPin(newPoint);
    console.log("Pin moved to new LatLon:", newPoint);
  };

  return (
    <main className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          Set up your home
        </h1>
        <p className="text-sm text-neutral-500">
          Drag the pin to your exact doorway.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <MapView
          center={pin}
          pins={[
            {
              point: pin,
              label: "Your Door",
              draggable: true,
            },
          ]}
          onPinMoved={handlePinMoved}
        />
      </div>

      <div className="rounded-lg bg-neutral-100 p-3 text-xs font-mono text-neutral-700">
        Lat: {pin.lat.toFixed(6)}, Lon: {pin.lon.toFixed(6)}
      </div>
    </main>
  );
}
