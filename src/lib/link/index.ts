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
  void bytes;
  throw new Error("toBase64Url: not implemented");
}

export function fromBase64Url(text: string): Uint8Array {
  void text;
  throw new Error("fromBase64Url: not implemented");
}
