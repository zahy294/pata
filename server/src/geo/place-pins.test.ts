import { expect, it } from "vitest";
import { placeCandidatePins } from "./place-pins";
import type { OsmFeature } from "../../../shared/domain";
import type { Street } from "./overpass";

const landmark: OsmFeature = {
  osmId: "node/1",
  name: "Temple",
  kind: "amenity=place_of_worship",
  point: { lat: 0.001, lon: 0 },
};
const street: Street = {
  osmId: "way/2",
  coords: [
    [-0.01, 0],
    [0.01, 0],
  ],
};

it("places an at candidate on the nearest street segment with a computed distance", () => {
  const [pin] = placeCandidatePins(
    [{ osmId: "node/1", relation: "at", confidence: "high" }],
    [landmark],
    [
      {
        osmId: "way/3",
        coords: [
          [-0.01, 0.01],
          [0.01, 0.01],
        ],
      },
      street,
    ],
  );
  expect(pin).toMatchObject({ point: { lat: 0, lon: 0 }, landmark, relation: "at", confidence: "high" });
  expect(pin.metresFromLandmark).toBeCloseTo(111.1950802, 5);
});

it("orders confidence stably, deduplicates within ten metres, skips unknown ids and caps at three", () => {
  const features = [
    landmark,
    ...[0.00104, 0.002, 0.003, 0.004].map((lat, index) => ({
      ...landmark,
      osmId: `node/${index + 2}`,
      point: { lat, lon: 0 },
    })),
  ];
  const result = placeCandidatePins(
    [
      { osmId: "node/1", relation: "near", confidence: "low" },
      { osmId: "node/2", relation: "near", confidence: "high" },
      { osmId: "node/3", relation: "near", confidence: "high" },
      { osmId: "node/4", relation: "near", confidence: "medium" },
      { osmId: "node/5", relation: "near", confidence: "low" },
      { osmId: "node/404", relation: "near", confidence: "high" },
    ],
    features,
    [],
  );
  expect(result.map(({ landmark }) => landmark.osmId)).toEqual(["node/2", "node/3", "node/4"]);
  expect(result.every(({ metresFromLandmark }) => metresFromLandmark === 0)).toBe(true);
});

it("reflects opposite across the nearest street and puts behind ten metres away from it", () => {
  const [opposite] = placeCandidatePins(
    [{ osmId: "node/1", relation: "opposite", confidence: "medium" }],
    [landmark],
    [street],
  );
  expect(opposite.point.lat).toBeCloseTo(-0.001, 9);
  expect(opposite.point.lon).toBeCloseTo(0, 9);
  expect(opposite.metresFromLandmark).toBeCloseTo(222.3901605, 5);
  const [behind] = placeCandidatePins(
    [{ osmId: "node/1", relation: "behind", confidence: "high" }],
    [landmark],
    [street],
  );
  expect(behind.point.lat).toBeCloseTo(0.00108993204, 10);
  expect(behind.metresFromLandmark).toBeCloseTo(10, 6);
});

it.each(["at", "opposite", "behind", "near"] as const)(
  "retains the landmark for %s when no usable street exists",
  (relation) => {
    const [pin] = placeCandidatePins(
      [{ osmId: "node/1", relation, confidence: "low" }],
      [landmark],
      [{ osmId: "way/9", coords: [] }],
    );
    expect(pin.point).toEqual(landmark.point);
    expect(pin.metresFromLandmark).toBe(0);
  },
);

it.each(["opposite", "behind"] as const)(
  "does not invent a direction for %s when the landmark is on the street",
  (relation) => {
    const onStreet = { ...landmark, point: { lat: 0, lon: 0 } };
    expect(
      placeCandidatePins([{ osmId: "node/1", relation, confidence: "low" }], [onStreet], [street])[0].point,
    ).toEqual(onStreet.point);
  },
);

it("returns no pins without ranked known landmarks", () => {
  expect(placeCandidatePins([], [landmark], [street])).toEqual([]);
  expect(
    placeCandidatePins([{ osmId: "node/999", relation: "at", confidence: "high" }], [landmark], [street]),
  ).toEqual([]);
});
