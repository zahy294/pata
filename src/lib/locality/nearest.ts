// A location fix → a suggested locality, on the device (ADR 0012). The household checks both fields;
// this only saves typing. Data: mumbai.json, built by scripts/build-locality-table.mjs from OpenStreetMap.
import type { LatLon } from "../../../shared/domain";
import { distanceMetres } from "../../../shared/geo";

export interface LocalityTable {
  source: string;
  /** [name, lat, lon] of each place=suburb node. */
  suburbs: [string, number, number][];
  /** PIN code → flat [lat × 1000, lon × 1000, …] of features tagged with it, one per ~110 m cell. */
  pins: Record<string, number[]>;
}

export interface SuggestedLocality {
  name: string | null;
  pinCode: string | null;
}

/** Nearest features voted on for the PIN code; 5 within 1.5 km was right for 86% of Mumbai's cells. */
const PIN_VOTERS = 5;
const PIN_RADIUS_METRES = 1500;
const SUBURB_RADIUS_METRES = 4000;

export function nearestLocality(table: LocalityTable, point: LatLon): SuggestedLocality {
  let name: string | null = null;
  let nameDistance = SUBURB_RADIUS_METRES;
  for (const [suburb, lat, lon] of table.suburbs) {
    const metres = distanceMetres(point, { lat, lon });
    if (metres <= nameDistance) {
      name = suburb;
      nameDistance = metres;
    }
  }

  const voters: { pinCode: string; metres: number }[] = [];
  for (const [pinCode, cells] of Object.entries(table.pins)) {
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const metres = distanceMetres(point, { lat: cells[i] / 1000, lon: cells[i + 1] / 1000 });
      if (metres <= PIN_RADIUS_METRES) voters.push({ pinCode, metres });
    }
  }
  voters.sort((a, b) => a.metres - b.metres);
  const votes = new Map<string, number>();
  // Closer features count for more; the 50 m floor keeps one feature at the door from outvoting the rest.
  for (const { pinCode, metres } of voters.slice(0, PIN_VOTERS))
    votes.set(pinCode, (votes.get(pinCode) ?? 0) + 1 / (metres + 50));
  let pinCode: string | null = null;
  let best = 0;
  for (const [candidate, weight] of votes)
    if (weight > best) {
      pinCode = candidate;
      best = weight;
    }
  return { name, pinCode };
}
