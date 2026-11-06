# P0-9 live checks — pending

No paid provider requests or deployment were made for Prompt 6. Code tests use mocked provider HTTP, a synthetic silence fixture and public test signing keys. Do not mark the ticket complete until these checks pass.

1. Before integrating, merge the owner's latest main into feat/ai-ml with a merge commit. Resolve conflicts only in AI/ML-owned functions; stop for other ownership conflicts. The local owner NewHousehold/createHousehold still uses the old voiceKeys contract/stub; its owner must reconcile it with raw partial clips. Do not bypass funding or write Arkiv records from makeDirections.
2. Use `npm run server:dev` with credentials configured privately by the human. Use the signed app flow or a local signed harness; navigating directly to a Worker route is unsigned and should fail auth. Do not relax authentication. Only the owner deploys.
3. Use a consented test description and confirmed pin, with no typed room number in the description. Call makeDirections once. Confirm hi/mr/en directions are correct and short enough for approximately 20 seconds; ask native speakers to review Hindi/Marathi.
4. Confirm three Uint8Array MP3s on success. Play each on both demo phones. Record actual duration, byte count and the sealed size using the owner's sealBytes. Each sealed clip must be strictly below 131072 bytes. Do not commit real household directions or clips.
5. With speech HTTP mocked to fail, verify directions remain usable and missing clips trigger the courier's browser speech fallback. With oversized test audio, verify one shorter retry only, and matching returned text/audio. These automated cases already pass; final UI fallback is frontend-owned.
6. Owner createHousehold must top up first, then encrypt/persist the available clips. Check this integration in the owner branch; this AI/ML flow makes no RPC or Arkiv calls.

Record phone models, languages, durations, raw/sealed sizes and review outcomes in docs/plans/P0-9.md. Keep credentials and real address/audio data out of git. Prompt 5's hour-0 checks remain separate and pending.
