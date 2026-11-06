import { expect, it } from "vitest";
import { nearestLocality, type LocalityTable } from "./nearest";
import mumbai from "./mumbai.json";

const table: LocalityTable = {
  source: "test",
  suburbs: [
    ["Dharavi", 19.04446, 72.85862],
    ["Bandra East", 19.06166, 72.84981],
  ],
  pins: {
    // Three cells of 400017 around the fix, one of 400051 a little further off.
    "400017": [19042, 72854, 19043, 72855, 19041, 72856],
    "400051": [19047, 72852],
  },
};

it("suggests the nearest suburb and the PIN code most nearby features carry", () => {
  expect(nearestLocality(table, { lat: 19.0421, lon: 72.8538 })).toEqual({
    name: "Dharavi",
    pinCode: "400017",
  });
});

it("lets a closer feature outweigh farther ones", () => {
  // Right on the 400051 cell; the 400017 cells are 500-700 m away.
  expect(nearestLocality(table, { lat: 19.047, lon: 72.852 }).pinCode).toBe("400051");
});

it("suggests nothing far from every suburb and feature", () => {
  expect(nearestLocality(table, { lat: 19.3, lon: 73.1 })).toEqual({ name: null, pinCode: null });
});

it("finds the demo areas in the bundled Mumbai table", () => {
  const data = mumbai as unknown as LocalityTable;
  expect(data.source).toMatch(/OpenStreetMap contributors, ODbL/);
  expect(nearestLocality(data, { lat: 19.0421, lon: 72.8538 })).toEqual({
    name: "Dharavi",
    pinCode: "400017",
  });
  expect(nearestLocality(data, { lat: 19.0665, lon: 72.8655 }).name).toBe("Bandra Kurla Complex");
});
