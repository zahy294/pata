/** Transport ceiling, separate from the smaller sealed clip budget (MAX_VOICE_CLIP_BYTES). */
export const MAX_AUDIO_RESPONSE_BYTES = 1024 * 1024;

/**
 * Check the first ADTS header Sarvam returns for `output_audio_codec: "aac"` at 8 kHz:
 * sync word, AAC LC, sampling-frequency index 11 (8,000 Hz) and a plausible frame length.
 */
export function assertAac(bytes: Uint8Array): void {
  if (bytes.length > MAX_AUDIO_RESPONSE_BYTES || bytes.length < 7) throw new Error("Invalid AAC response");
  const frameLength = ((bytes[3] & 0x03) << 11) | (bytes[4] << 3) | (bytes[5] >> 5);
  if (
    bytes[0] !== 0xff ||
    (bytes[1] & 0xf6) !== 0xf0 ||
    ((bytes[2] >> 6) & 3) !== 1 ||
    ((bytes[2] >> 2) & 0x0f) !== 11 ||
    frameLength < 7 ||
    frameLength > bytes.length
  ) {
    throw new Error("Invalid AAC response");
  }
}
