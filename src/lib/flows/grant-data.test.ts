import { expect, it } from "vitest";
import { calculateGrantEnd, buildGrantPayload } from "./grant-data";
import type { HomeRecord, GrantRequest } from "../../../shared/domain";
import { ARKIV_MAX_BYTES, MAX_VOICE_CLIP_BYTES } from "../../../shared/constants";
import { deriveHouseholdKeys } from "../keys";
import { sealJson } from "../seal";

const key = `0x${"12".repeat(32)}` as const;
const home: HomeRecord = {
  version: 1,
  digipin: "39J49LL8T4",
  pin: { lat: 28.622788, lon: 77.213033 },
  locality: { name: "Test locality", pinCode: "110001" },
  roomNumber: "Room 731",
  writtenAddress: "Private test address",
  directions: { hi: "हिंदी", mr: "मराठी", en: "Take the test door" },
  voiceKeys: { hi: key, mr: key, en: key },
};
const request: GrantRequest = {
  requester: { displayName: "Test courier", ensName: "courier.eth" },
  purpose: "Delivery",
  language: "en",
  durationSeconds: 20,
};

it("adds the requested duration and the 30-second stage margin to Sepolia time", () => {
  expect(calculateGrantEnd(1_800_000_000, 20)).toBe(1_800_000_050);
});

it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
  "rejects invalid or overflowing durations (%s)",
  (duration) => {
    expect(() => calculateGrantEnd(1_800_000_000, duration)).toThrow("Invalid grant duration");
  },
);

it("rejects a duration beyond the supported Arkiv lifetime before approval can send writes", () => {
  expect(() => calculateGrantEnd(1_800_000_000, 183 * 86_400)).toThrow("Invalid grant duration");
});

it("builds only the requested language's payload and base64 audio, without voice entity keys", () => {
  expect(buildGrantPayload(home, request, new Uint8Array([0, 1, 2, 255]), 1_800_000_050)).toEqual({
    version: 1,
    requester: request.requester,
    purpose: "Delivery",
    language: "en",
    digipin: "39J49LL8T4",
    pin: home.pin,
    locality: home.locality,
    roomNumber: "Room 731",
    writtenAddress: "Private test address",
    directions: "Take the test door",
    audioMp3Base64: "AAEC/w==",
    grantEnd: 1_800_000_050,
  });
});

it("handles a large clip without a spread-stack failure and exposes base64's real size", () => {
  const payload = buildGrantPayload(home, request, new Uint8Array(100 * 1024), 1_800_000_050);
  expect(payload.audioMp3Base64).toHaveLength(136_536);
});

it("builds a text-only payload when setup kept no clip for the language (ADR 0007)", () => {
  const payload = buildGrantPayload(home, request, null, 1_800_000_050);
  expect(payload).not.toHaveProperty("audioMp3Base64");
  expect(payload.directions).toBe("Take the test door");
});

it("fits the largest allowed clip with 300-character Devanagari directions in one grant batch", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const directions = "द".repeat(300);
  const longHome = {
    ...home,
    writtenAddress: "Room 12, Building 4, ".repeat(25),
    directions: { hi: directions, mr: directions, en: directions },
  };
  const longRequest = { ...request, language: "hi" as const, purpose: "Delivery ".repeat(20) };
  const payload = buildGrantPayload(
    longHome,
    longRequest,
    new Uint8Array(MAX_VOICE_CLIP_BYTES),
    1_800_000_050,
  );
  const index = {
    grantLabel: "abcdefgh",
    requester: longRequest.requester,
    purpose: longRequest.purpose,
    grantEnd: 1,
  };
  const sealed =
    (await sealJson(keys.sealKey, payload)).length + (await sealJson(keys.sealKey, index)).length;
  expect(sealed).toBeLessThanOrEqual(ARKIV_MAX_BYTES);
});
