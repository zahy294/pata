# Blockchain: Codex prompts

You own keys, encryption, the one Anon-RPC module, ENS, Arkiv, the grant flows and the DigipinResolver contract: `src/lib/{keys,seal,rpc,ens,arkiv}`, `src/lib/flows/{approve-grant,courier,revoke}.ts`, `signIn` and `createHousehold` in `src/lib/flows/setup-household.ts`, `contracts/src` and `contracts/test`, and `arkiv/schema.md`.

You're on the critical path: the first household name on Sepolia is due at **hour 10 (Fri 07:00)**. Post "Unblocks: …" in the team chat each time a function the others wait on works.

## Completion checklist

- [x] P0-5 keys and seal: device root and household state storage, deterministic household/grant identities with frozen vectors, AES-GCM-256 round trips and rejection tests. See `docs/plans/P0-5.md`.
- [x] P0-5 RPC module: Nox clients, routing/logging tests and real localhost reads on both chains. See `docs/plans/P0-5-rpc.md`.
- [x] P0-8 ENS module: pinned ABIs, roles, names, household deployments and locality update; verified on Sepolia. See `docs/plans/P0-8-ens.md`.
- [ ] P0-8 ENS end-to-end: owner's `/register`, then verify `getEnsText` through universal resolution (user explicitly deferred registration).
- [x] P0-8 Arkiv module: four schemas, ADR 0008, sealed home/voice create/read functions and owner/schema/error tests. See `docs/plans/P0-8-arkiv.md`.
- [ ] P0-8 Arkiv live home round-trip: runner ready; development Rabdi wallet remains unfunded on-chain. Read-only 182/183-day lifetime probes pass.
- [ ] P0-3 follow-up: repeat with an Arkiv access key on the OnePlus 11 preview; five funded Nox write measurements per chain (deferred by the user until device, preview and funds are ready).

For testing on Sepolia and Rabdi you need your own development wallet (SETUP.md §3), funded from the faucets. Its key goes in your `.env.local` only; Codex must never read or print it. Household keys come from the app itself.

The owner registers `pata.eth` (P0-2) and posts `NEXT_PUBLIC_PATA_REGISTRY` in the chat; put it in your `.env.local`. The owner's Worker does `/topup` and `/register`.

---

### Prompt 1: keys and seal (start now)

```
Read AGENTS.md, docs/team/blockchain.md, docs/research/passkeys.md, docs/research/viem.md (accounts, HKDF, "no encryption in viem") and docs/adr/0004-grant-identity-from-the-session-key.md.
Ticket: P0-5 (keys, seal). Use the tdd skill. Write docs/plans/P0-5.md first and commit it.
1. src/lib/seal: sealBytes/openBytes with WebCrypto AES-GCM-256, wire format 0x01 || 12-byte IV || ciphertext+tag. Tests from seal.test.ts first.
2. src/lib/keys: newRandomRoot, deriveHouseholdKeys, newSessionKey, deriveGrantIdentity exactly as the header says. HKDF-SHA256 via WebCrypto (or @noble/hashes/hkdf) with HKDF_SALT and the HKDF_INFO strings. Account keys: reduce the 32 HKDF bytes into [1, n-1] for secp256k1 before privateKeyToAccount. Labels: 8 chars of RFC 4648 base32 lowercase (a-z2-7) from the HKDF bytes. Seal keys: import as non-extractable AES-GCM.
3. Freeze vectors: one fixed root -> address, one fixed session key -> label + owner address. These must never change once a link is shared.
4. src/lib/keys/store.ts: IndexedDB (a tiny wrapper, no new package) for the device root and HouseholdState. Browser-only: guard every call with typeof indexedDB.
Done when npm run check passes. Small commits, push. Post "Unblocks: keys, seal".
```

### Prompt 2: the Anon-RPC module (with the owner's hour-0 tests)

```
Read AGENTS.md, docs/team/blockchain.md, docs/research/anon-rpc.md (all of it), docs/research/viem.md and docs/research/arkiv.md ("Install and setup").
Ticket: P0-5 (rpc) and the Nox rows of the P0-3 hour-0 table. Write docs/plans/P0-5-rpc.md first and commit it.
1. src/lib/rpc/index.ts as its header says: one lazy AnonRpcWorker (NOX_SPECIFIER, config undefined) with a bootstrap rpcProvider that calls Sepolia directly (the one allowed direct read); viem clients for Sepolia (chain sepolia, ccipRead: false) and for Arkiv via @arkiv-network/sdk createPublicClient/createWalletClient with chain rabdi({ accessKey: env.arkivAccessKey }); transports http(url, { fetchFn: worker.fetch, timeout: 30_000, retryCount: 0 }); Rabdi pollingInterval 1000. Writes use a direct transport while env.directWrites is true. Record every method in rpcLog (method name and chain only, never params).
2. A dev-only page is not allowed in the build; instead add an e2e/rpc.spec.ts Playwright test (or a button on /lookup behind ?debug=1) that boots the worker and runs: eth_chainId on both chains, one eth_call (ETHRegistry getStatus of "pata"), one Arkiv query. Run it on the laptop, then on the OnePlus 11 via the deployed preview.
3. Write results into docs/plans/P0-3.md under the Nox rows: does Nox reach Sepolia and Rabdi (with the access key in the URL path)? Latency of a Sepolia write and an Arkiv create through Nox (5 tries each: median and worst). If Nox can't reach Rabdi, Arkiv calls go direct and README says so: write that in the plan.
Done when reads through Nox work in the browser on both chains. Commit, push. Post "Unblocks: rpc".
```

### Prompt 3: ENS household contracts

```
Read AGENTS.md, docs/team/blockchain.md, docs/research/ens-v2.md (all of it), docs/adr/0002, 0003 and 0004.
Ticket: P0-8 (ENS part). Write docs/plans/P0-8-ens.md first and commit it. Use the tdd skill for the pure parts.
1. src/lib/ens/abis.ts: copy only the functions/events listed in the file from contracts-v2@07e55a05's contracts/deployments/sepolia/*.json (curl the raw files; cite each). Unit-test src/lib/ens/roles.ts bitmaps against the values in ens-v2.md.
2. src/lib/ens/names.ts: suggestHouseholdLabel (two short common English words joined by "-", always valid; a word list in the file) and dnsEncode (viem packetToBytes); finish names.test.ts.
3. src/lib/ens/household.ts: householdLabelStatus (getStatus on NEXT_PUBLIC_PATA_REGISTRY); deployHouseholdContracts: VerifiableFactory.deployProxy of a PermissionedResolver (salt convention from ens-v2.md, initialize grants the household all resolver roles on root, and calls = setText for location and eth.pata.pincode on the household's own name) and of a UserRegistry for grants (salt with namehash(fullName), initialize with GRANT_REGISTRY_ROOT_ROLES for the household); read the addresses from ProxyDeployed. setLocality for later edits.
4. Test on Sepolia with a throwaway household key funded from your dev wallet (a script under scripts/dev/, gitignored, or a Vitest file named *.fork.test.ts excluded from check). Record gas per call in docs/plans/P0-3.md (the relay's top-up size depends on it).
Done when a throwaway household deploys both contracts and its locality text resolves through getEnsText after the owner's /register. Commit, push.
```

### Prompt 4: Arkiv records

```
Read AGENTS.md, docs/team/blockchain.md, docs/research/arkiv.md (all of it) and arkiv/schema.md.
Ticket: P0-8 (Arkiv part). Write docs/plans/P0-8-arkiv.md first and commit it.
1. Write docs/adr/0008-grant-entity-has-a-household-index.md recording the two-column pata.grant.v1 decision at the top of src/lib/arkiv/index.ts (context, decision, consequences; 10–15 lines like the other ADRs). Update arkiv/schema.md if anything changes.
2. src/lib/arkiv: defineSchema for the four types (names in shared/constants.ts ARKIV_SCHEMAS; bytes columns only, nothing indexed). createHomeRecord/readHomeRecord (182 days, sealed JSON), createVoiceRecord/readVoiceRecord (182 days, sealed MP3). Every read filters ownedBy(household) or checks $owner.
3. Test against Rabdi with a throwaway key: create, read back, check that the stored bytes are ciphertext (no substring of the plaintext), and check fromDays(183) is rejected. Log every surprise in arkiv/friction.md, one dated line each.
Done when a home record round-trips on Rabdi. Commit, push.
```

### Prompt 5: first household, end to end (due hour 10)

```
Read AGENTS.md, docs/team/blockchain.md, docs/plan.md ("Set up a household", step 7–8) and src/lib/flows/setup-household.ts.
Ticket: P0-8. Write docs/plans/P0-8.md first and commit it.
1. signIn: loadDeviceRoot or newRandomRoot + saveDeviceRoot; deriveHouseholdKeys.
2. createHousehold: topup (sepolia and arkiv) → deployHouseholdContracts → registerName (owner's /register) → wait until the name resolves → createHomeRecord with digipin (encodeDigipin), pin, locality, roomNumber, writtenAddress, directions, voiceKeys → saveHouseholdState. Each step reports progress through a callback the screen can show; each is safe to retry.
3. Run it from the frontend's /setup screen with the real flows (coordinate with frontend).
Done when the first household name exists on Sepolia, created through the app. Post it in the team chat with the Etherscan link. Commit, push.
```

### Prompt 6: approve a grant

```
Read AGENTS.md, docs/team/blockchain.md, docs/plan.md ("Approve a grant"), docs/research/ens-v2.md §4 and Gotcha 5, docs/research/arkiv.md (batches, atDate) and src/lib/flows/approve-grant.ts.
Ticket: P0-10. Write docs/plans/P0-10.md first and commit it. Use the tdd skill for grantEnd and payload building.
1. sepoliaNow and mintGrant in src/lib/ens/grants.ts (register(label, owner, 0x0, 0x0, GRANT_ROLES, grantEnd); retry once on CannotSetPastExpiry with a fresh grantEnd).
2. createGrantBatch in src/lib/arkiv: one executeBatch with the grant entity (payload column sealed to the session key, index column sealed to the household) using ExpirationTime.atDate(grantEnd), plus the readonly "issued" history entry. Read keys from createdEntities.
3. approveGrant: session key → identity → grantEnd = sepoliaNow() + durationSeconds + GRANT_LATENCY_MARGIN_SECONDS → read the voice clip in the request's language → GrantPayload → batch → mint → formatCourierLink(location.origin, ...). Drop the session key reference after building the link.
4. Hour-0 rows (docs/plans/P0-3.md): a 20 s grant expires on Sepolia; unregister works on a live one and reverts LabelExpired on an expired one; a grant owner can't create subnames or set records; transfer reverts.
Done when the consent screen produces a working courier link. Commit, push. Post "Unblocks: approveGrant".
```

### Prompt 7: courier checks and revoke

```
Read AGENTS.md, docs/team/blockchain.md, docs/plan.md ("Open a courier link", "Revoke"), docs/adr/0002 and 0005, src/lib/flows/courier.ts and revoke.ts.
Tickets: P0-11 (checks) and P0-12. Write docs/plans/P0-11.md and docs/plans/P0-12.md first and commit them.
1. lookupLocality, householdOwner (src/lib/ens/lookup.ts); grantStatusByName via UniversalHelper.findExactOwner on the DNS-encoded full grant name.
2. readGrantPayload (null on NoEntityFoundError) and checkCourierLink: parse → locality → ENS owner must equal deriveGrantIdentity(sessionKey).owner.address → payload $owner must equal householdOwner → open the payload. Either check failing or the payload missing → "ended"; malformed → "invalid". Never decide liveness from resolution failing (ADR 0002).
3. Revoke: unregisterGrant (status read first; already-ended needs no tx), deleteGrantPayload, createHistoryEntry("revoked"). Also listLiveGrants from the index column (needed by the access screen in P1-2, but revoke needs the label + payload key now).
Done when the 20 s stage grant flips the courier view to the locality by itself, and a revoke flips it within one Sepolia block. Commit, push.
```

### P1 prompts (only after every P0 ticket is done)

```
P1-1 grid names. Read AGENTS.md, docs/research/digipin.md (Solidity decoding), docs/research/ens-v2.md §7 and docs/research/foundry.md. Use the tdd skill with forge tests in contracts/test/DigipinResolver.t.sol: the Dak Bhawan vector, vectors.json via vm.readFile (add fs_permissions), fuzzed round-trips inside the bounds, rejection of bad labels, text(bytes32,string) for eth.pata.latlon and location, revert for other profiles. Implement contracts/src/DigipinResolver.sol. The owner deploys it and sets it as digipin.eth's resolver. Then resolveGridName in src/lib/ens/lookup.ts.
```

```
P1-3 passkey keys. Read docs/research/passkeys.md (all of it) and docs/research/playwright.md (virtual authenticator with PRF). rootFromPasskey with the PRF extension and the two-prompt sign-up fallback; signIn prefers it when PRF is available. Playwright test with the CDP virtual authenticator. Then re-make the demo household on the OnePlus 11 on the final host.
```

```
P1-4 writes through Nox. Read docs/research/anon-rpc.md ("Writes"). Route all household writes through the worker; implement sendSignedWithStallRetry (receipt check, then the same signed bytes directly, onDirectRetry so the UI says so); keep NEXT_PUBLIC_DIRECT_WRITES=1 as the stage switch, disclosed in the README.
```

```
P1-2 data and P1-8 upkeep. listHistory (sorted in JS), and extendExpiringRecords at sign-in for home, voice and history records with under ARKIV_EXTEND_BELOW_DAYS left.
```

```
P1-5 seller name and proof. Give the mock seller an ENS name with agent-context and agent-endpoint[web] (ENSIP-26) and a "prove you hold the grant" check: the seller signs a challenge with the grant owner key from the link; anyone verifies it against findExactOwner.
```
