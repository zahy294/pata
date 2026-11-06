import { describe, expect, it, vi } from "vitest";
import { describeTypedAddress, locateHome, locateHomeError, LocateError } from "./setup-household";

const fields = {
  localityName: "  Dharavi  ",
  pinCode: "400 017",
  landmark: " Hanuman   Mandir ",
  doorNotes: "Blue iron gate, second lane on the left.",
};

describe("describeTypedAddress", () => {
  it("builds the way to the door, the public locality and one landmark phrase without a model call", () => {
    expect(describeTypedAddress(fields)).toEqual({
      ok: true,
      wayToTheDoor: "Blue iron gate, second lane on the left, near Hanuman Mandir, Dharavi 400017",
      locality: { name: "Dharavi", pinCode: "400017" },
      landmarkPhrases: ["Hanuman Mandir"],
    });
  });

  it("leaves the landmark out when it's blank", () => {
    expect(describeTypedAddress({ ...fields, landmark: "  " })).toMatchObject({
      ok: true,
      wayToTheDoor: "Blue iron gate, second lane on the left, Dharavi 400017",
      landmarkPhrases: [],
    });
  });

  it.each([
    ["a blank area", { localityName: " " }, /area/],
    ["an area over 80 characters", { localityName: "a".repeat(81) }, /area/],
    ["a 5-digit PIN code", { pinCode: "40001" }, /PIN code/],
    ["letters in the PIN code", { pinCode: "4000l7" }, /PIN code/],
    ["blank door notes", { doorNotes: " \n " }, /door/],
    ["a landmark over 80 characters", { landmark: "b".repeat(81) }, /landmark/],
    ["door notes over 1000 characters", { doorNotes: "c".repeat(1001) }, /door/],
  ])("refuses %s with a plain sentence", (_, change, problem) => {
    const result = describeTypedAddress({ ...fields, ...change });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toMatch(problem);
  });
});

function fakeGeolocation(answer: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
  const getCurrentPosition = vi.fn(
    (ok: PositionCallback, fail?: PositionErrorCallback | null, options?: PositionOptions) => {
      void options;
      answer(ok, fail!);
    },
  );
  return { geolocation: { getCurrentPosition } as unknown as Geolocation, getCurrentPosition };
}

function position(lat: number, lon: number, accuracy: number) {
  return { coords: { latitude: lat, longitude: lon, accuracy } } as GeolocationPosition;
}

describe("locateHome", () => {
  it("returns the phone's fix with its accuracy, asking for a fresh high-accuracy reading", async () => {
    const { geolocation, getCurrentPosition } = fakeGeolocation((ok) => ok(position(19.0421, 72.8538, 18)));
    await expect(locateHome(geolocation)).resolves.toEqual({
      pin: { lat: 19.0421, lon: 72.8538 },
      accuracyMetres: 18,
    });
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("maps geolocation error code %i to %s", async (code, reason) => {
    const { geolocation } = fakeGeolocation((_, fail) => fail({ code } as GeolocationPositionError));
    await expect(locateHome(geolocation)).rejects.toMatchObject({ reason });
  });

  it("refuses a fix outside the DIGIPIN grid, which can't be encoded", async () => {
    const { geolocation } = fakeGeolocation((ok) => ok(position(51.5, -0.12, 10)));
    await expect(locateHome(geolocation)).rejects.toMatchObject({ reason: "outside" });
  });

  it("says unsupported when the browser has no geolocation", async () => {
    await expect(locateHome(undefined)).rejects.toMatchObject({ reason: "unsupported" });
  });
});

describe("locateHomeError", () => {
  it("gives each failure its own plain sentence that offers the typed landmark instead", () => {
    const reasons = ["unsupported", "denied", "unavailable", "timeout", "outside"] as const;
    const sentences = reasons.map((reason) => locateHomeError(new LocateError(reason)));
    expect(new Set(sentences).size).toBe(reasons.length);
    for (const sentence of sentences) expect(sentence).toMatch(/landmark/);
    expect(locateHomeError(new Error("raw"))).toBe(locateHomeError(new LocateError("unavailable")));
  });
});
