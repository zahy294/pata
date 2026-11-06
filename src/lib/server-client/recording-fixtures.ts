import { readFile } from "node:fs/promises";

/** Synthetic silence only, generated independently with FFmpeg; see fixtures/manifest.json. */
export async function recordingFixture(name = "live-webm-2.webm"): Promise<ArrayBuffer> {
  const bytes = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
