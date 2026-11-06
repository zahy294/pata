// P0-10/P0-11 (frontend).
import { describe, expect, it } from "vitest";
import {
  formatCourierLink,
  fromBase64Url,
  parseCourierFragment,
  toBase64Url,
  type CourierLink,
} from "./index";

describe("courier link (ADR 0006)", () => {
  // Deterministic 32-byte fixtures
  const samplePayloadKey =
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const;
  const sampleSessionKey = new Uint8Array([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  ]);

  const sampleLink: CourierLink = {
    householdName: "sana.pata.eth",
    payloadKey: samplePayloadKey,
    sessionKey: sampleSessionKey,
  };

  it("base64url has no + / or = characters", () => {
    // Array designed to produce +, /, and padding '=' in standard base64
    const testBytes = new Uint8Array([251, 255, 254, 255]);
    const b64url = toBase64Url(testBytes);
    expect(b64url).not.toMatch(/[+/=]/);
    expect(fromBase64Url(b64url)).toEqual(testBytes);
  });

  it("formats https://host/c#1~sana.pata.eth~<payload key>~<session key>", () => {
    const formatted = formatCourierLink("https://pata.pages.dev", sampleLink);
    expect(formatted.startsWith("https://pata.pages.dev/c#1~sana.pata.eth~")).toBe(
      true,
    );
    const fragment = formatted.split("#")[1];
    const parts = fragment.split("~");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("1");
    expect(parts[1]).toBe("sana.pata.eth");
    // Keys must be base64url without padding
    expect(parts[2]).not.toMatch(/[+/=]/);
    expect(parts[3]).not.toMatch(/[+/=]/);
  });

  it("parses what it formats (round trip)", () => {
    const formatted = formatCourierLink("https://pata.app", sampleLink);
    const fragment = formatted.split("#")[1];
    const parsed = parseCourierFragment(fragment);
    expect(parsed).not.toBeNull();
    expect(parsed?.householdName).toBe(sampleLink.householdName);
    expect(parsed?.payloadKey).toBe(sampleLink.payloadKey);
    expect(parsed?.sessionKey).toEqual(sampleLink.sessionKey);
  });

  it("accepts the fragment with or without the leading #", () => {
    const formatted = formatCourierLink("https://pata.app", sampleLink);
    const fragmentWithHash = "#" + formatted.split("#")[1];
    const fragmentWithoutHash = formatted.split("#")[1];

    const parsedWith = parseCourierFragment(fragmentWithHash);
    const parsedWithout = parseCourierFragment(fragmentWithoutHash);

    expect(parsedWith).not.toBeNull();
    expect(parsedWithout).not.toBeNull();
    expect(parsedWith).toEqual(parsedWithout);
  });

  it("supports a household name with a hyphen", () => {
    const hyphenLink: CourierLink = {
      householdName: "sana-home.pata.eth",
      payloadKey: samplePayloadKey,
      sessionKey: sampleSessionKey,
    };
    const formatted = formatCourierLink("https://pata.app", hyphenLink);
    const parsed = parseCourierFragment(formatted.split("#")[1]);
    expect(parsed).not.toBeNull();
    expect(parsed?.householdName).toBe("sana-home.pata.eth");
  });

  it("returns null for a wrong version, missing fields, bad base64url or wrong key lengths", () => {
    // Missing fields
    expect(parseCourierFragment("1~sana.pata.eth~abc")).toBeNull();
    // Bad base64url characters
    expect(parseCourierFragment("1~sana.pata.eth~invalid+key~session")).toBeNull();
  });

  it("returns null for version '2' (rejected)", () => {
    const formatted = formatCourierLink("https://pata.app", sampleLink);
    const v2Fragment = formatted.split("#")[1].replace(/^1~/, "2~");
    expect(parseCourierFragment(v2Fragment)).toBeNull();
  });

  it("returns null for extra '~' fields (rejected)", () => {
    const formatted = formatCourierLink("https://pata.app", sampleLink);
    const extraFieldsFragment = formatted.split("#")[1] + "~extra";
    expect(parseCourierFragment(extraFieldsFragment)).toBeNull();
  });

  it("returns null for a 31-byte key (rejected)", () => {
    const shortSessionKey = new Uint8Array(31).fill(7);
    const shortPayloadKeyBytes = new Uint8Array(31).fill(9);
    const validSessionB64 = toBase64Url(sampleSessionKey);
    const validPayloadB64 = toBase64Url(
      new Uint8Array(32).fill(1),
    );

    // 31-byte payload key
    const badPayloadFrag = `1~sana.pata.eth~${toBase64Url(shortPayloadKeyBytes)}~${validSessionB64}`;
    expect(parseCourierFragment(badPayloadFrag)).toBeNull();

    // 31-byte session key
    const badSessionFrag = `1~sana.pata.eth~${validPayloadB64}~${toBase64Url(shortSessionKey)}`;
    expect(parseCourierFragment(badSessionFrag)).toBeNull();
  });
});
