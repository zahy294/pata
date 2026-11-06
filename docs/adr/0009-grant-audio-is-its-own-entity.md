# A grant's directions audio is its own Arkiv entity, in 8 kHz AAC

## Context

ADR 0007 puts a compressed clip of the directions inside each grant, assuming it fits beside the payload in one 128 KiB create.
Measured through the live Worker on 2026-11-06, Sarvam's `bulbul:v4-flash` MP3 is 128 kbps even at 16 kHz: a 20 s Hindi clip is about 340 KB. Its API has no bitrate setting. AAC at 8 kHz was the smallest output tried, at 104 KiB for 20.7 s (about 41 kbps). Base64 inside the JSON payload would add a third, so even that clip can't share the payload's budget.

## Decision

Synthesize as ADTS AAC at 8 kHz. At approval, create a `pata.grant-audio.v1` entity holding the clip sealed to the grant's session key, before the payload batch, and put its key in the payload and the household index. A clip may fill one entity (`MAX_VOICE_CLIP_BYTES`, 128 KiB minus the seal envelope, about 25 s). The entity expires 15 minutes after the first deadline, so an expiry retry reuses it. Revoke deletes it with the payload.

## Consequences

Full-length directions stay spoken, and courier reads still go through Anon-RPC. Approval makes one more Arkiv write. If a later step fails, a stray audio entity stays until it expires, sealed to a discarded session key. Each poll's payload read is small, and the courier view reads the clip once per link. 8 kHz is telephone quality. Swarm was considered for the Arkiv + Swarm bonus, but courier reads from a Swarm gateway would bypass Anon-RPC.
