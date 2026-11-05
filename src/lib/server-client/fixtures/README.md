# Synthetic speech recording fixtures

These files contain generated silence, not speech or household data. `manifest.json` records FFmpeg version, commands, hashes and independently probed last packet end times. Short recordings use 2 seconds of source silence; long recordings use 31 seconds. Codec delay/padding means encoded timelines can be slightly longer. No provider or key is needed to run these tests.

From the repository root, with FFmpeg and ffprobe installed:

```bash
python3 - <<'PY'
import json, subprocess
from pathlib import Path
root = Path('src/lib/server-client/fixtures')
for case in json.loads((root / 'manifest.json').read_text())['cases']:
    subprocess.run(case['command'], check=True)
    packets = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_packets', '-show_entries',
        'packet=pts_time,duration_time', '-of', 'json', str(root / case['file'])
    ]))['packets']
    end = max(float(p.get('pts_time', 0)) + float(p.get('duration_time', 0)) for p in packets)
    print(case['file'], 'last packet end:', end)
PY
```

Regeneration may change container IDs/hashes or codec padding between FFmpeg builds; review changes and refresh the manifest deliberately. Ordinary tests use committed bytes, run offline, and do not require FFmpeg. `-live 1` produces WebM without a declared duration. The fragmented MP4 command uses an empty initial movie plus one-second fragments, exercising sample timing instead of an initial movie duration.

The bounded inspector supports a narrow recorder profile: one Opus track in non-laced WebM blocks, or one AAC (`mp4a`) track in MP4, including fragmented sample timing. It rejects unsupported structures, inconsistent bounds, excessive metadata work and indeterminate durations. It does not decode audio or prove codec payload validity; Sarvam performs decoding. Coded timelines are conservative about padding: stop recording at about 28 seconds as the speech research recommends. Actual phone compatibility and Worker CPU still require live verification.

Format references: [Matroska elements](https://www.matroska.org/technical/elements.html), [Opus RFC 6716 §3](https://www.rfc-editor.org/rfc/rfc6716.html#section-3), [ISO BMFF byte stream structure](https://www.w3.org/TR/mse-byte-stream-format-isobmff/).
