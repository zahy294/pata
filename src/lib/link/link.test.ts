// P0-10/P0-11 (frontend).
import { describe, it } from "vitest";

describe("courier link (ADR 0006)", () => {
  it.todo("formats https://host/c#1~sana.pata.eth~<payload key>~<session key>");
  it.todo("parses what it formats (round trip)");
  it.todo("accepts the fragment with or without the leading #");
  it.todo("returns null for a wrong version, missing fields, bad base64url or wrong key lengths");
  it.todo("base64url has no + / or = characters");
});
