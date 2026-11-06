/** Portable bounded container inspection; no decoding, network, storage or browser globals. */
export class RecordingInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 422 = 400,
  ) {
    super(message);
  }
}
export const MAX_RECORDING_BYTES = 2 * 1024 * 1024;
type Element = { id: number; start: number; end: number };

function webmSeconds(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let budget = 20_000;
  function vint(at: number, end: number, marker = false) {
    if (at >= end || !bytes[at]) throw new Error();
    let length = 1;
    while (length <= 8 && !(bytes[at] & (1 << (8 - length)))) length++;
    if (length > 8 || at + length > end || (marker && length > 4)) throw new Error();
    let value = bytes[at] & (marker ? 255 : (1 << (8 - length)) - 1);
    for (let i = 1; i < length; i++) value = value * 256 + bytes[at + i];
    return { value, length, unknown: !marker && value === 2 ** (7 * length) - 1 };
  }
  function children(start: number, end: number): Element[] {
    const elements: Element[] = [];
    while (start < end) {
      if (--budget < 0) throw new Error();
      const id = vint(start, end, true);
      const size = vint(start + id.length, end);
      const body = start + id.length + size.length;
      if (size.unknown && ![0x18538067, 0x1f43b675].includes(id.value)) throw new Error();
      const next = size.unknown ? end : body + size.value;
      if (!Number.isSafeInteger(next) || next > end || next < body) throw new Error();
      elements.push({ id: id.value, start: body, end: next });
      start = next;
    }
    return elements;
  }
  function uint(element: Element): number {
    if (element.end - element.start > 6) throw new Error();
    let value = 0;
    for (let i = element.start; i < element.end; i++) value = value * 256 + bytes[i];
    return value;
  }
  const roots = children(0, bytes.length);
  if (
    roots.filter((e) => e.id === 0x1a45dfa3).length !== 1 ||
    roots.filter((e) => e.id === 0x18538067).length !== 1
  )
    throw new Error();
  const header = roots.find((e) => e.id === 0x1a45dfa3);
  const segment = roots.find((e) => e.id === 0x18538067);
  if (!header || !segment) throw new Error();
  const docType = children(header.start, header.end).find((e) => e.id === 0x4282);
  if (!docType || new TextDecoder().decode(bytes.subarray(docType.start, docType.end)) !== "webm")
    throw new Error();
  const top = children(segment.start, segment.end);
  if (top.some((e) => e.id === 0x1a45dfa3 || e.id === 0x18538067)) throw new Error();
  const info = top.find((e) => e.id === 0x1549a966);
  let scale = 1_000_000;
  let declared = 0;
  if (info)
    for (const field of children(info.start, info.end)) {
      if (field.id === 0x2ad7b1) scale = uint(field);
      if (field.id === 0x4489) {
        const length = field.end - field.start;
        if (length !== 4 && length !== 8) throw new Error();
        declared = length === 4 ? view.getFloat32(field.start) : view.getFloat64(field.start);
      }
    }
  if (!Number.isFinite(declared) || declared < 0 || scale <= 0) throw new Error();
  const tracks = top.find((e) => e.id === 0x1654ae6b);
  if (!tracks) throw new Error();
  const entries = children(tracks.start, tracks.end).filter((e) => e.id === 0xae);
  if (entries.length !== 1) throw new Error();
  const fields = children(entries[0].start, entries[0].end);
  const type = fields.find((e) => e.id === 0x83);
  const codec = fields.find((e) => e.id === 0x86);
  const number = fields.find((e) => e.id === 0xd7);
  if (
    !type ||
    uint(type) !== 2 ||
    !codec ||
    !number ||
    new TextDecoder().decode(bytes.subarray(codec.start, codec.end)) !== "A_OPUS"
  )
    throw new Error();
  const track = uint(number);
  let packetEnd = 0;
  let codedSeconds = 0;
  let packets = 0;
  function block(element: Element, timestamp: number) {
    const number = vint(element.start, element.end);
    const at = element.start + number.length;
    if (number.value !== track || at + 4 > element.end) throw new Error();
    // Recorder profile: non-laced Opus blocks. Unsupported lacing fails closed.
    if (bytes[at + 2] & 6) throw new Error();
    const packet = at + 3;
    const toc = bytes[packet];
    const config = toc >> 3;
    const frameMs =
      config >= 16
        ? 2.5 * 2 ** (config & 3)
        : config >= 12
          ? 10 * 2 ** (config & 1)
          : (config & 3) === 3
            ? 60
            : 10 * 2 ** (config & 3);
    const code = toc & 3;
    if (code === 3 && packet + 1 >= element.end) throw new Error();
    const count = code === 0 ? 1 : code === 3 ? bytes[packet + 1] & 63 : 2;
    if (!count || frameMs * count > 120) throw new Error();
    codedSeconds += (frameMs * count) / 1000;
    packetEnd = Math.max(
      packetEnd,
      ((timestamp + view.getInt16(at)) * scale) / 1e9 + (frameMs * count) / 1000,
    );
    packets++;
  }
  function cluster(element: Element, depth = 0) {
    if (depth > 16) throw new Error();
    let timestamp = 0;
    for (const field of children(element.start, element.end)) {
      if (field.id === 0xe7) timestamp = uint(field);
      if (field.id === 0x1a45dfa3 || field.id === 0x18538067) throw new Error();
      if (field.id === 0xa3) block(field, timestamp);
      if (field.id === 0xa0)
        for (const item of children(field.start, field.end)) if (item.id === 0xa1) block(item, timestamp);
      // Streaming unknown-size clusters can end when a sibling cluster starts.
      if (field.id === 0x1f43b675) cluster(field, depth + 1);
    }
  }
  for (const element of top) if (element.id === 0x1f43b675) cluster(element);
  if (!packets) throw new Error();
  // Conservative coded timeline includes end padding; never trust a shorter header.
  return Math.max((declared * scale) / 1e9, packetEnd, codedSeconds);
}

function mp4Seconds(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  type Box = { type: string; start: number; end: number };
  let budget = 20_000;
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start < end) {
      if (--budget < 0 || start + 8 > end) throw new Error();
      let size = view.getUint32(start);
      const type = String.fromCharCode(...bytes.subarray(start + 4, start + 8));
      let header = 8;
      if (size === 1) {
        if (start + 16 > end) throw new Error();
        size = Number(view.getBigUint64(start + 8));
        header = 16;
      }
      if (size === 0) size = end - start;
      if (!Number.isSafeInteger(size) || size < header || start + size > end) throw new Error();
      result.push({ type, start: start + header, end: start + size });
      start += size;
    }
    return result;
  }
  function child(box: Box, type: string): Box {
    const result = boxes(box.start, box.end).find((entry) => entry.type === type);
    if (!result) throw new Error();
    return result;
  }
  function read(box: Box, offset: number, wide = false): number {
    if (box.start + offset + (wide ? 8 : 4) > box.end) throw new Error();
    const value = wide ? Number(view.getBigUint64(box.start + offset)) : view.getUint32(box.start + offset);
    if (!Number.isSafeInteger(value)) throw new Error();
    return value;
  }
  const top = boxes(0, bytes.length);
  if (
    top.filter((box) => box.type === "ftyp").length !== 1 ||
    top.filter((box) => box.type === "moov").length !== 1
  )
    throw new Error();
  const moov = top.find((box) => box.type === "moov");
  if (
    !top.some((box) => box.type === "ftyp") ||
    !moov ||
    !top.some((box) => box.type === "mdat" && box.end > box.start)
  )
    throw new Error();
  const tracks = boxes(moov.start, moov.end).filter((box) => box.type === "trak");
  if (tracks.length !== 1) throw new Error();
  const track = tracks[0];
  const mdia = child(track, "mdia");
  const handler = child(mdia, "hdlr");
  if (read(handler, 8) !== 0x736f756e) throw new Error(); // soun, audio only
  const mdhd = child(mdia, "mdhd");
  const version = bytes[mdhd.start];
  if (version > 1) throw new Error();
  const scale = read(mdhd, version ? 20 : 12);
  let duration = read(mdhd, version ? 24 : 16, version === 1);
  const stbl = child(child(mdia, "minf"), "stbl");
  const stsd = child(stbl, "stsd");
  if (read(stsd, 4) !== 1 || boxes(stsd.start + 8, stsd.end)[0]?.type !== "mp4a") throw new Error();
  const stts = child(stbl, "stts");
  const count = read(stts, 4);
  if (count > 20_000 || stts.start + 8 + count * 8 !== stts.end) throw new Error();
  let sampleDuration = 0;
  for (let i = 0; i < count; i++) sampleDuration += read(stts, 8 + i * 8) * read(stts, 12 + i * 8);
  duration = Math.max(duration, sampleDuration);
  const fragments = top.filter((box) => box.type === "moof");
  if (fragments.length) {
    const tkhd = child(track, "tkhd");
    if (bytes[tkhd.start] > 1) throw new Error();
    const trackId = read(tkhd, bytes[tkhd.start] ? 20 : 12);
    const trex = child(child(moov, "mvex"), "trex");
    if (read(trex, 4) !== trackId) throw new Error();
    const defaultDuration = read(trex, 12);
    let samples = 0;
    let codedTicks = 0;
    for (const fragment of fragments) {
      const trafs = boxes(fragment.start, fragment.end).filter((box) => box.type === "traf");
      if (trafs.length !== 1) throw new Error();
      const traf = trafs[0];
      const tfhd = child(traf, "tfhd");
      if (read(tfhd, 4) !== trackId) throw new Error();
      const flags = read(tfhd, 0) & 0xffffff;
      const offset = 8 + (flags & 1 ? 8 : 0) + (flags & 2 ? 4 : 0);
      const sampleDefault = flags & 8 ? read(tfhd, offset) : defaultDuration;
      const tfdt = child(traf, "tfdt");
      if (bytes[tfdt.start] > 1) throw new Error();
      let cursor = read(tfdt, 4, bytes[tfdt.start] === 1);
      const firstTick = cursor;
      const runs = boxes(traf.start, traf.end).filter((box) => box.type === "trun");
      if (!runs.length) throw new Error();
      for (const run of runs) {
        const flags = read(run, 0) & 0xffffff;
        const count = read(run, 4);
        samples += count;
        if (!count || samples > 20_000) throw new Error();
        let at = 8 + (flags & 1 ? 4 : 0) + (flags & 4 ? 4 : 0);
        for (let i = 0; i < count; i++) {
          const length = flags & 0x100 ? read(run, at) : sampleDefault;
          if (!length) throw new Error();
          cursor += length;
          if (flags & 0x100) at += 4;
          if (flags & 0x200) at += 4;
          if (flags & 0x400) at += 4;
          if (flags & 0x800) {
            if (read(run, at) !== 0) throw new Error();
            at += 4;
          }
        }
        if (run.start + at !== run.end) throw new Error();
      }
      codedTicks += cursor - firstTick;
      duration = Math.max(duration, cursor, codedTicks);
    }
  }
  const edts = boxes(track.start, track.end).find((box) => box.type === "edts");
  if (edts) {
    const edit = child(edts, "elst");
    const wide = bytes[edit.start] === 1;
    if (bytes[edit.start] > 1 || read(edit, 4) !== 1) throw new Error();
    // Remove initial encoder priming; do not trust a shortened edit to hide long audio.
    const offset = read(edit, wide ? 16 : 12, wide);
    if (read(edit, wide ? 24 : 16) !== 0x00010000) throw new Error();
    duration -= offset;
  }
  if (scale <= 0 || !Number.isSafeInteger(duration) || duration <= 0) throw new Error();
  return duration / scale;
}

export function inspectRecording(audio: ArrayBuffer): {
  seconds: number;
  contentType: "audio/webm" | "audio/mp4";
  extension: string;
} {
  if (audio.byteLength > MAX_RECORDING_BYTES)
    throw new RecordingInputError("Recording must be at most 2 MiB", 413);
  try {
    const bytes = new Uint8Array(audio);
    if (bytes.length < 12) throw new Error();
    const webm = new DataView(audio).getUint32(0) === 0x1a45dfa3;
    const seconds = webm ? webmSeconds(bytes) : mp4Seconds(bytes);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error();
    if (seconds > 30) throw new RecordingInputError("Recording must be at most 30 seconds", 422);
    return { seconds, contentType: webm ? "audio/webm" : "audio/mp4", extension: webm ? "webm" : "mp4" };
  } catch (error) {
    if (error instanceof RecordingInputError) throw error;
    throw new RecordingInputError("Invalid or unsupported speech recording");
  }
}
