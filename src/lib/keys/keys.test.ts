// P0-5 (blockchain). Fixed roots in, fixed outputs out: these vectors freeze the HKDF info strings.
import { describe, it } from "vitest";

describe("keys", () => {
  it.todo("the same root always gives the same household address");
  it.todo("two different roots give different addresses");
  it.todo("the household seal key is non-extractable AES-GCM");
  it.todo("a session key gives an 8-char a-z2-7 label and an owner address, deterministically");
  it.todo("the grant label and grant owner differ between two session keys");
  it.todo("freezes one known root -> address vector and one session key -> label vector");
});
