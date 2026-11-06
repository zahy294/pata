/** Transport ceiling, separate from the smaller sealed voice-record budget. */
export const MAX_MP3_RESPONSE_BYTES = 1024 * 1024;

/** Check a bounded ID3 prefix and the expected MPEG-2 Layer III / 16-kHz frame header. */
export function assertMp3(bytes: Uint8Array): void {
  if (bytes.length > MAX_MP3_RESPONSE_BYTES) throw new Error("Invalid MP3 response");
  let at = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    if (bytes.length < 10 || bytes[3] < 2 || bytes[3] > 4) throw new Error("Invalid MP3 response");
    let tagSize = 0;
    for (let i = 6; i < 10; i++) {
      if (bytes[i] & 0x80) throw new Error("Invalid MP3 response");
      tagSize = tagSize * 128 + bytes[i];
    }
    at = 10 + tagSize + (bytes[3] === 4 && bytes[5] & 0x10 ? 10 : 0);
  }
  if (
    at + 24 > bytes.length ||
    bytes[at] !== 0xff ||
    (bytes[at + 1] & 0xe0) !== 0xe0 ||
    ((bytes[at + 1] >> 3) & 3) !== 2 ||
    ((bytes[at + 1] >> 1) & 3) !== 1 ||
    ((bytes[at + 2] >> 2) & 3) !== 2 ||
    bytes[at + 2] >> 4 === 0 ||
    bytes[at + 2] >> 4 === 15
  ) {
    throw new Error("Invalid MP3 response");
  }
}
