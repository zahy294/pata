# Arkiv friction log

One line per surprise, as it happens, with the date and what we did. This file is 25% of Arkiv's judging.

- 2026-11-03: The 182.5-day maximum lifetime (`ExpiryBeyondMaxLifetime`, 7,884,000 blocks) isn't on the limits page or in the JSON-RPC error table; we found it by simulating a one-year create. We create at 182 days and extend.
- 2026-11-03: The docs contradict SDK 1.0.0: `llms.txt` and the generated API reference still list `tiramisu`, `ne`, `not`, cursors and the payload helpers. We pinned 1.0.0 and read the SDK source.
- 2026-11-06: Installed SDK 1.0.0 represents `fromDays(182)` as `minLifetime=7862400`, `expiresAt=0`; the node counts that relative floor from the inclusion block. The research note's blanket description of expiry fixed before sending applies to absolute deadlines, not this duration. Tests assert the relative floor and inspect the live created/expiry block difference.
- 2026-11-06: A 100 KiB MP3 becomes 136,536 base64 characters before grant JSON, two AES-GCM envelopes and the household index, exceeding the shared 128 KiB grant bytes budget even though a separate voice record fits. Batch validation checks the combined sealed payload/index before sending; AI/ML must shorten clips against the final grant size rather than only the raw voice size.
