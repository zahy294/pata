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

/** Returns the full URL. `origin` is the stable host (ADR 0001), e.g. https://pata.pages.dev */
export function formatCourierLink(origin: string, link: CourierLink): string {
  void origin;
  void link;
  void COURIER_LINK_VERSION;
  throw new Error("formatCourierLink: not implemented (P0-10)");
}

/** Parses the `#` part (with or without the leading "#"). Returns null for anything malformed. */
export function parseCourierFragment(fragment: string): CourierLink | null {
  void fragment;
  throw new Error("parseCourierFragment: not implemented (P0-11)");
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
