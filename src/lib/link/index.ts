// Courier link format (ADR 0006): https://<host>/c#1~<household name>~<payload key>~<session key>
// Keys are base64url (no padding). "~" never appears in a household label. Owner: frontend (P0-10, P0-11).
// Plain code; write link.test.ts first (TDD). Once a link is shared its format can't change: a new
// format gets a new leading version, and version 1 must keep parsing forever.
import { COURIER_LINK_VERSION } from "../../../shared/constants";

export interface CourierLink {
  householdName: string;
  /** Arkiv entity key of the payload, 32 bytes. */
  payloadKey: `0x${string}`;
  /** The grant's session key, 32 bytes. */
  sessionKey: Uint8Array;
}

const B64URL_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const B64URL_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64URL_CHARS.length; i++) {
  B64URL_LOOKUP[B64URL_CHARS[i]] = i;
}

function hexToBytes(hex: `0x${string}`): Uint8Array {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (raw.length !== 64 || /[^0-9a-fA-F]/.test(raw)) {
    throw new Error("Invalid payloadKey: expected 32-byte 0x-hex string");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  let hex = "0x";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex as `0x${string}`;
}

/** Returns the full URL. `origin` is the stable host (ADR 0001), e.g. https://pata.pages.dev */
export function formatCourierLink(origin: string, link: CourierLink): string {
  const base = origin.replace(/\/+$/, "");
  const payloadBytes = hexToBytes(link.payloadKey);
  const payloadB64 = toBase64Url(payloadBytes);
  const sessionB64 = toBase64Url(link.sessionKey);
  return `${base}/c#${COURIER_LINK_VERSION}~${link.householdName}~${payloadB64}~${sessionB64}`;
}

/** Parses the `#` part (with or without the leading "#"). Returns null for anything malformed. */
export function parseCourierFragment(fragment: string): CourierLink | null {
  try {
    const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
    const parts = raw.split("~");
    if (parts.length !== 4) {
      return null;
    }
    const [version, householdName, payloadB64, sessionB64] = parts;
    if (version !== COURIER_LINK_VERSION) {
      return null;
    }
    if (!householdName || householdName.trim() === "") {
      return null;
    }

    const payloadBytes = fromBase64Url(payloadB64);
    if (payloadBytes.length !== 32) {
      return null;
    }

    const sessionKey = fromBase64Url(sessionB64);
    if (sessionKey.length !== 32) {
      return null;
    }

    const payloadKey = bytesToHex(payloadBytes);
    return {
      householdName,
      payloadKey,
      sessionKey,
    };
  } catch {
    return null;
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const hasB1 = i + 1 < len;
    const b1 = hasB1 ? bytes[i + 1] : 0;
    const hasB2 = i + 2 < len;
    const b2 = hasB2 ? bytes[i + 2] : 0;

    const c0 = b0 >> 2;
    const c1 = ((b0 & 3) << 4) | (b1 >> 4);
    result += B64URL_CHARS[c0] + B64URL_CHARS[c1];

    if (hasB1) {
      const c2 = ((b1 & 15) << 2) | (b2 >> 6);
      result += B64URL_CHARS[c2];
      if (hasB2) {
        const c3 = b2 & 63;
        result += B64URL_CHARS[c3];
      }
    }
  }
  return result;
}

export function fromBase64Url(text: string): Uint8Array {
  if (/[^A-Za-z0-9_-]/.test(text)) {
    throw new Error("Invalid base64url characters");
  }
  const len = text.length;
  if (len % 4 === 1) {
    throw new Error("Invalid base64url length");
  }
  const padding = (4 - (len % 4)) % 4;
  const totalChars = len + padding;
  const byteLen = (totalChars * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLen);

  let byteIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const v0 = B64URL_LOOKUP[text[i]];
    const v1 = i + 1 < len ? B64URL_LOOKUP[text[i + 1]] : 0;
    const v2 = i + 2 < len ? B64URL_LOOKUP[text[i + 2]] : 0;
    const v3 = i + 3 < len ? B64URL_LOOKUP[text[i + 3]] : 0;

    if (byteIdx < byteLen) bytes[byteIdx++] = (v0 << 2) | (v1 >> 4);
    if (i + 2 < len && byteIdx < byteLen) {
      bytes[byteIdx++] = ((v1 & 15) << 4) | (v2 >> 2);
    }
    if (i + 3 < len && byteIdx < byteLen) {
      bytes[byteIdx++] = ((v2 & 3) << 6) | v3;
    }
  }
  return bytes;
}
