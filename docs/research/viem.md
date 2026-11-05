# viem

Checked: 2026-11-03 · Version: 2.57.14 (`npm view viem version`, published 2026-11-01, `latest` tag; `next` carries 3.0.0-next.14, a prerelease we don't use) · Status: test at kick-off
Feeds: idea.md "Why this model and architecture?" (private lookups; grants that stop resolving), Stack rows Names, Private RPC, Data and Encryption; scope ladder P0 "Anon-RPC for every read" and "an expiring grant with its Arkiv payload", P1 "Writes through Anon-RPC", "Keys derived from the passkey" and "the `*.digipin.eth` wildcard resolver"; Risks row "If a write stalls, retry it directly and say so"

Sources read:
- the npm tarball `viem@2.57.14`. File paths below are inside it; the same files sit under `src/` in [wevm/viem](https://github.com/wevm/viem).
- the tarballs `@arkiv-network/sdk@1.0.0`, `@anon-rpc/browser-harness@0.4.0` and `@anon-rpc/harness-core@0.4.0`.
- [ENS deployments](https://docs.ens.domains/learn/deployments) and ENS's `llms-full.txt` (saved as `docs/research/sources/viem-ens-llms-full.txt`).
- read-only `cast` calls against Sepolia (`https://ethereum-sepolia-rpc.publicnode.com`) and Rabdi (`https://rpc.rabdi.db-chain.testnet.arkiv.network`).

No package code was run. Context7 lists viem as `/wevm/viem`; this note relies on the source of the exact version instead.

## Install and setup

- **Install:** `npm i viem@2.57.14`.
  - Runtime dependencies (pinned): `@noble/curves 1.9.1`, `@noble/hashes 1.8.0`, `@scure/bip32 1.7.0`, `@scure/bip39 1.6.0`, `abitype 1.2.3`, `ox 0.14.59`, `ws`, `isows`.
  - Peer dependency: `typescript >=5.0.4` (`npm view viem dependencies peerDependencies`, 2026-11-02).
- **One copy of viem:** `@arkiv-network/sdk@1.0.0` has viem as a peer dependency (`^2.0.0`), so the SDK uses the app's own viem. Check that `npm ls viem` shows a single copy; with two, viem's `Transport` and `Chain` types won't match (inferred).
- **Entry points:**
  - `viem`: clients, transports, actions and utilities.
  - `viem/chains`: `sepolia`.
  - `viem/ens`: `normalize`, `namehash`, `labelhash`, `packetToBytes`, `getEnsText`, `getEnsAddress`, `getEnsResolver`.
  - `viem/accounts`: `generatePrivateKey`, `privateKeyToAccount`, `signMessage`, `signTypedData`, `signTransaction`.
  - `viem/nonce`: `createNonceManager`, `jsonRpc`.

  Source: `package.json` `exports`, `accounts/index.ts`, `nonce/index.ts`.
- **Two chains, two client pairs, one transport factory:**
  - Sepolia: viem's `createPublicClient` and `createWalletClient`.
  - Rabdi: `createPublicClient` and `createWalletClient` from `@arkiv-network/sdk`. They call viem's `createClient`, add Arkiv actions, and take an ordinary viem `transport` (`@arkiv-network/sdk` `src/clients/createPublicClient.ts`).
  - The SDK has no `fetch(` call of its own: queries go through `client.request` as `arkiv_query`, `arkiv_getEntity` and `arkiv_getBlockTiming` (grep of `src/`). The transport therefore carries all Arkiv traffic.

## What Pata calls

### 1. Clients and transports (every read and write; idea.md "Private lookups → Anon-RPC")

**The worker's `fetch` goes in `http(url, { fetchFn })`.**
- `@anon-rpc/browser-harness` declares `AnonRpcWorker.fetch: AnonFetch`, typed `(input: string | URL | Request, init?: RequestInit & { anonOptions?: AnonOptions }) => Promise<Response>`, with the comment "Assignable to `typeof fetch`" (`@anon-rpc/harness-core` `src/spec-types.ts`; harness `dist/types/host/AnonRpcWorker.d.ts`).
- Its README says it is "A standard fetch, routed through the sandboxed anon-client. It is this-bound, so passing it around as a free function is fine."
- viem's `fetchFn` has the matching type, `(input: string | URL | Request, init?: RequestInit) => Promise<Response>` (`utils/rpc/http.ts`, `HttpRpcClientOptions`). So the call is:

  `http('<real upstream RPC URL>', { fetchFn: worker.fetch, timeout, retryCount })`.

How viem calls it:
- **Arguments:** `fetchFn(url, { body: <JSON string>, headers: { 'Content-Type': 'application/json', … }, method: 'POST', signal })` (`utils/rpc/http.ts`, `getHttpRpcClient`).
- **The URL:** pass the real Sepolia or Rabdi URL, because the worker forwards to whatever URL it is given (README example: `worker.fetch("https://rpc.example/", …)`).
- **Per-call isolation:** `anonOptions: { isolationKey }` is read by the worker, not sent to the RPC (harness README, "Per-call options"). viem's `fetchOptions` type omits it, so a wrapper is needed: `fetchFn: (u, i) => worker.fetch(u, { ...i, anonOptions: { isolationKey } })`. Use one transport per isolation key, e.g. household vs courier (inferred).
- **The bootstrap read:** `WorkerInit.preExisting.rpcProvider` is a "Minimal EIP-1193-ish provider" `{ request({ method, params }) }` (`spec-types.ts`). A viem `PublicClient` on a direct `http(SEPOLIA_RPC_URL)` has that `request` method, so it can serve as the one sanctioned direct call (inferred from the types).

**Don't use `custom()` for the worker.**
- `custom(provider)` takes an EIP-1193 `{ request }` object, not a fetch (`clients/transports/custom.ts`).
- It sets no timeout, so a stalled mixnet call would hang for ever.

**Other `http` options** (`clients/transports/http.ts`):
- `batch`: `true` or `{ batchSize: 1000, wait: 0 }`.
- `fetchOptions`: extra `RequestInit` fields, such as headers.
- `maxResponseBodySize`: 10,485,760 bytes.
- hooks `onFetchRequest` and `onFetchResponse`.
- `retryCount`, `retryDelay`, `timeout` (10,000 ms by default).
- `methods`: `{ include }` or `{ exclude }`.

`timeout` and `retryCount` go on the transport. `createClient` passes the transport only `{ account, chain, pollingInterval }` (`clients/createClient.ts`).

**`fallback` and "retry a stalled write directly"** (`clients/transports/fallback.ts`):
- `fallback([a, b], { retryCount, retryDelay, rank, shouldThrow })` moves to `b` on any error that `shouldThrow` doesn't flag. It flags only user rejection, `-32003`, execution reverted and CAIP 5000.
- The child transports run with `retryCount: 0`; the fallback's own retries re-run the whole chain.
- The fallback's `onResponse(fn)` reports which child answered each request. viem puts it on `client.transport`, because `createClient` spreads the transport's value there.

Consequences for Pata:
- A plain `fallback([anon, direct])` would silently send **reads** direct as well. That breaks the CLAUDE.md invariant and the Anon-RPC score.
- If `fallback` is used, limit the direct child with `http(directUrl, { methods: { include: ['eth_sendRawTransaction'] } })`. The fallback only moves on when a later child includes the method, so reads fail rather than leak.
- Never set `rank`. It pings every child with `net_listening` every `pollingInterval` and reorders them, which could put the direct child first.
- **Recommended (inferred): sign once, send the same bytes twice.**
  1. A local account signs on the device and broadcasts with `eth_sendRawTransaction` (`actions/wallet/sendTransaction.ts`, the `account?.type === 'local'` branch).
  2. Prepare and sign with `prepareTransactionRequest` and `signTransaction`. The hash, `keccak256(serialized)`, is known before sending.
  3. Send with `sendRawTransaction` through the worker.
  4. On a stall, send **the same serialized transaction** through a separate direct client and tell the user. Identical bytes can't double-spend; "already known" means it is already in the mempool.
  5. Wait with `waitForTransactionReceipt({ hash })`.

**Polling for 12 s and 2 s blocks** (`clients/createClient.ts`):
- `pollingInterval = min(max(blockTime / 2, 500), 4000)`. `blockTime` defaults to 12,000 ms when the chain doesn't set it.
- `cacheTime = min(pollingInterval, blockTime / 2)`.
- viem's `sepolia` sets no `blockTime`, so it polls every **4,000 ms**. That is fine for 12 s blocks.
- The Arkiv SDK's `rabdi()` sets no `blockTime` either, so it **also polls every 4,000 ms**, though Rabdi's blocks are 2 s (on-chain below).
  - Set `pollingInterval: 1_000` on the Arkiv clients, or spread the chain and add `blockTime: 2_000`.
  - Otherwise a revoke or an expiry shows up to ~4 s late.

### 2. Chains

**`sepolia`** (`chains/definitions/sepolia.ts`):
- id 11155111; `testnet: true`; no `blockTime`.
- default RPC `https://11155111.rpc.thirdweb.com`. Pata never uses it.
- `multicall3`: `0xca11bde05977b3631167028862be2a173976ca11`.
- `ensUniversalResolver`: `0xeeeeeeee14d718c2b47d9923deab1335e144eeee` (block 8,928,790).

**That Universal Resolver is ENSv2's.**
- The deployments page says Sepolia's ENSv1 contracts "still exist on Sepolia but are no longer in use: the Universal Resolver and the ENS apps for Sepolia are linked against the ENSv2 deployment".
- It lists `ManagedUniversalResolverProxy` `0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1` and `UniversalResolverV2` `0x24e1d8e068620b647ca097f961a61055f4f42d72` ([deployments](https://docs.ens.domains/learn/deployments), read 2026-11-03).

On-chain checks, 2026-11-02 18:57 UTC (2026-11-03 IST):
- `cast call 0xeeeeeeee14d718c2b47d9923deab1335e144eeee 'isENSv2()(bool)'` → `true`. ENS's Universal Resolver V2 page calls `isENSv2` the "Marker distinguishing the v2 Universal Resolver from v1".
- `cast storage 0xeeee…eeee 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` (the ERC-1967 implementation slot) → `0x6d80…e6f1`.
- The same slot on `0x6d80…e6F1` → `0x24e1…2d72`, and `isENSv2()` on that address → `true`.

So viem's built-in `sepolia` resolves through ENSv2's Universal Resolver with no override. Passing `universalResolverAddress` explicitly still guards against a viem upgrade changing it (inferred).

**Rabdi:** `@arkiv-network/sdk@1.0.0` already exports it, as a function: `import { rabdi } from '@arkiv-network/sdk/chains'`, then `rabdi({ accessKey })` (`src/chains/rabdi.ts`).
- It returns `defineChain` with:
  - id `7794095`, name `Rabdi`;
  - currency `tGLM`, 18 decimals;
  - HTTP URL `https://rpc.rabdi.db-chain.testnet.arkiv.network/<accessKey>`, plus a `wss://` URL;
  - explorer `https://rabdi.explorer.arkiv.network`;
  - `testnet: true`.
- `accessKey: ''` means the public, "heavily rate limited" endpoint. A missing key throws `MissingAccessKeyError`.
- It sets no `blockTime`, `fees` or `multicall3`.
- On-chain, 2026-11-03 00:44 UTC:
  - `cast chain-id` → 7794095; `web3_clientVersion` → `reth/v2.7.0`.
  - Blocks: 2.0 s apart on average over the last 100 (`cast block -f timestamp`).
  - Fees: `baseFeePerGas` 1,000,000,000 (1 gwei, flat in `eth_feeHistory`); `eth_maxPriorityFeePerGas` → `0x0`; gas limit 30,000,000.
  - `cast codesize 0xca11bde05977b3631167028862be2a173976ca11` → `0`, so **no multicall3**.
- So Rabdi is an EIP-1559 chain, and viem's default fee estimate works there: 1.2 × base fee + 0 tip.
- The SDK's JSDoc says the access key "is not a secret, as it ships with any app that talks to the chain, but restrict it to your origins or IPs". The handoff records that Arkiv's docs say to keep the key on a server; the Arkiv note settles which applies.

### 3. ENS utilities (household name, grant lookup, courier view, `*.digipin.eth`)

All come from `viem/ens` (`ens/index.ts`).

| Function | Does | Notes |
|---|---|---|
| `normalize(name)` | ENSIP-15, via `ox/Ens` | Apply to anything a person types (`utils/ens/normalize.ts`) |
| `namehash(name)` | EIP-137 namehash | Doesn't normalize. A `[64-hex]` label is read as an already-hashed label |
| `labelhash(label)` | keccak256 of one label | Same `[hash]` rule |
| `packetToBytes(name)` | **DNS-encodes** a name, returning a `Uint8Array` | This is the exported DNS encoder. Wrap it in `toHex()` for an ABI `bytes` argument. Labels over 255 bytes become `[labelhash]`. Example: `'awkweb.eth'` → `0x0661776b7765620365746800` |
| `getEnsAddress(client, { name, coinType?, universalResolverAddress?, strict?, gatewayUrls?, blockNumber?, blockTag? })` | `resolveWithGateways(dnsName, addr(node), ['x-batch-gateway:true'])` | Returns `Address \| null` |
| `getEnsText(client, { name, key, universalResolverAddress?, strict?, … })` | The same call with `text(node, key)` | Returns `string \| null`; an empty record is `null` |
| `getEnsResolver(client, { name, universalResolverAddress? })` | `findResolver(dnsName)` | Returns the zero address when there's no resolver |

Sources: `actions/ens/getEnsAddress.ts`, `getEnsText.ts`, `getEnsResolver.ts`.

- **Null results** (`utils/ens/errors.ts`): without `strict`, viem returns `null` when:
  - the Universal Resolver reverts with `HttpError`, `ResolverError`, `ResolverNotContract`, `ResolverNotFound`, `ReverseAddressMismatch` or `UnsupportedResolverProfile`;
  - or the result is `0x`, the zero address, or an empty string.

  Any other error throws.
- **Checked on-chain**, 2026-11-02 18:58–18:59 UTC, with viem's exact call:
  - `pata.eth` (unregistered): `cast call 0xeeee…eeee 'resolveWithGateways(bytes,bytes,string[])(bytes,address)' 0x04706174610365746800 $(cast calldata 'addr(bytes32)' $(cast namehash pata.eth)) '["x-batch-gateway:true"]'` reverts `ResolverNotFound(bytes)`, selector `0x77209fe8`. That matches viem's ABI entry (`constants/abis.ts`), so viem returns `null`.
  - `vitalik.eth` → `0xd8da6bf26964af9d7eed9e03e53415d37aa96045`, via ENSv2's `ENSV1Resolver` `0x322b…9cb0`, with no `OffchainLookup` round trip.
  - `findResolver(pata.eth)` → the zero address.
- **Wildcards (ENSIP-10):** viem sends the whole DNS-encoded name and does nothing more. Finding the parent's resolver and calling ENSIP-10's `resolve(bytes,bytes)` happen inside URv2, which "walks down the registry tree … looking for the deepest resolver along the path" (ENS docs, Universal Resolver V2). So `getEnsText({ name: '39j49ll8t4.digipin.eth', … })` needs nothing special from viem.
- **Expired ENSv2 names:** viem has no concept of expiry (inferred from its code and the ENS docs).
  - Per ENS's docs, an expired name's registry entry returns `address(0)`.
  - But URv2 uses the deepest resolver on the path. An expired grant `k3f9x2qa.sana.pata.eth` could therefore fall through to the household's resolver at `sana.pata.eth`.
  - If that resolver implements ENSIP-10 and still holds records for the grant's node, viem returns those records.
  - So the courier view must decide "expired" from the registry (expiry or owner), not from a `null` record. Test at kick-off.
- **CCIP-Read bypasses the transport.**
  - On an `OffchainLookup` revert, viem fetches the gateway URLs with the **global `fetch`**, unless the client sets `ccipRead.request` (`utils/ccip.ts`, `actions/public/call.ts`).
  - The Universal Resolver's `x-batch-gateway:true` is answered locally, but any real gateway URL would be fetched outside Anon-RPC.
  - Pata's resolvers are all on-chain, so set `ccipRead: false` on the Sepolia client: an unexpected lookup then fails instead of leaking.

### 4. Contracts (registry, resolver, `unregister`, the digipin resolver)

- **Calls:**
  - `readContract({ address, abi, functionName, args, blockTag? })`;
  - `simulateContract({ …, account })`, whose returned `request` goes to `writeContract(request)`;
  - `encodeFunctionData({ abi, functionName, args })`;
  - `getLogs({ address, event, args, fromBlock, toBlock })`.

  Declare ABIs `as const` so abitype infers the argument and return types (viem's standard pattern; `abitype 1.2.3`).
- **What a write costs in round trips** (`actions/wallet/prepareTransactionRequest.ts`):
  - By default it fills `chainId`, `fees`, `gas`, `nonce` and `type`.
  - It first tries `eth_fillTransaction`. If the node rejects the method, it remembers that per client.
  - Then it calls `getBlock('latest')` (the base fee decides EIP-1559 vs legacy), `getTransactionCount(blockTag: 'pending')`, `eth_maxPriorityFeePerGas` and `eth_estimateGas`. If the priority-fee call fails, it uses `gasPrice − baseFee`.
  - `maxFeePerGas` = base fee × `chain.fees.baseFeeMultiplier`, which defaults to **1.2** (`actions/public/estimateFeesPerGas.ts`), plus the priority fee.
  - Through a mixnet each call is slow. Passing `chainId`, `nonce`, `gas`, `maxFeePerGas` and `maxPriorityFeePerGas` skips them (inferred).
  - `sendTransaction` may also call `eth_chainId` to check the chain (`sendTransaction.ts`, `getChainId`/`assertCurrentChain`); which conditions trigger it is a kick-off test.
- **`waitForTransactionReceipt({ hash })` defaults** (`actions/public/waitForTransactionReceipt.ts`): `confirmations: 1`, `retryCount: 6`, `retryDelay: 200 × 2^count` ms, `timeout: 180_000` ms, polling at the client's `pollingInterval`.
- **`watchContractEvent`** (`actions/public/watchContractEvent.ts`):
  - It first creates a filter (`eth_newFilter`, then `eth_getFilterChanges`), and falls back to `getLogs` if filters aren't supported.
  - Filters live on one node. If the mixnet's exit nodes differ between requests, the filter may vanish (inferred).
  - Prefer `getLogs` polling, or plain reads, for the live-access screen.

### 5. Keys (passkey sign-in, household key, relay top-ups)

- **Accounts:** `generatePrivateKey()` returns 32 random bytes as hex. `privateKeyToAccount(key, { nonceManager? })` gives a local account with `signMessage`, `signTypedData` and `signTransaction`. It derives the public key with `@noble/curves`' `secp256k1.getPublicKey` (`accounts/privateKeyToAccount.ts`), which throws for a key outside [1, n−1] (inferred from noble).
- **One key, both chains:** the same account signs for Sepolia and Rabdi, since both are EVM chains with secp256k1 (inferred; matches idea.md's Stack).
- **From WebAuthn PRF output to a key:** viem has no KDF.
  - viem provides `keccak256`, `sha256`, `toHex` and `hexToBytes`.
  - HKDF exists in `@noble/hashes` (a viem dependency, but not part of viem's API, so add it as our own dependency) and in WebCrypto (`HKDF`).
  - Suggested derivation: take the 32 PRF bytes; use HKDF-SHA256 with a per-purpose `info` string (e.g. one for the chain key, one for the encryption key) to get 32 bytes; check the result is in range, retrying with a counter otherwise (the odds of a retry are negligible); then call `privateKeyToAccount`. This is inference; the passkeys note owns the decision.
- **Relay nonces:** `createNonceManager({ source: jsonRpc() })` from `viem/nonce`, passed to `privateKeyToAccount(relayKey, { nonceManager })`. `prepareTransactionRequest` then calls `nonceManager.consume({ address, chainId, client })` instead of fetching the pending count (`prepareTransactionRequest.ts`). The counts live in memory, so run a single relay process per key, or the nonces collide (inferred).

### 6. Encryption

- viem has no encryption API: a grep of viem's `accounts`, `utils`, `actions` and `clients` source for `encrypt`, `decrypt`, `aes-gcm` and `getSharedSecret` finds nothing.
- It bundles `@noble/curves` (secp256k1, including ECDH `getSharedSecret`, which viem doesn't expose) and `@noble/hashes` (keccak, SHA-2, HKDF). It does **not** bundle `@noble/ciphers`, so there is no AES in the dependency tree.
- Per-grant session-key encryption must therefore come from elsewhere: WebCrypto `AES-GCM` with a random 256-bit key per grant, and for the household key, ECDH plus HKDF plus AES-GCM (inferred; the decision goes in an ADR).

## Limits

- **Timeout:** `http` waits 10,000 ms per request, including the body read (`utils/rpc/http.ts`). `custom` has no timeout.
- **Retries** (`utils/buildRequest.ts`, `withRetry.ts`):
  - Defaults: `retryCount` 3 and `retryDelay` 150 ms, doubling each time: 150, 300 and 600 ms. A `Retry-After` header overrides the delay.
  - Retried: HTTP 403, 408, 413, 429, 500, 502, 503 and 504; JSON-RPC codes −1, −32005, −32603, 429 and −32007; and any error with neither a code nor a status, which includes `TimeoutError` and network failures.
  - So a stalled mixnet request takes about **41 s** to fail by default (4 × 10 s + 1.05 s; inferred arithmetic). Lower `timeout` and `retryCount` on the worker transport.
- **Response size:** 10 MiB by default. Arkiv's entity cap is 128 KiB.
- **JSON-RPC batching:** off by default. `batch: true` sends arrays of up to 1,000 calls. Leave it off until the worker and Arkiv are shown to accept arrays.
- **Multicall batching:** `batch: { multicall: true }` uses multicall3, which works on Sepolia. Rabdi has no multicall3, so use `deployless` there or leave it off.
- **Polling:** Sepolia 4,000 ms by default. Set Arkiv to 1,000 ms.

## Gotchas

- **Errors carry the request.** `HttpRequestError`, `RpcRequestError` and `TimeoutError` include `URL: …` and `Request body: …` in their messages (`errors/request.ts`).
  - An ENS `eth_call` body contains the DNS-encoded name being resolved; a raw-transaction body is the whole signed transaction.
  - Never ship viem error messages to a server log; log `name` and `shortMessage` only (inferred, from the invariants).
- **URL redaction covers only `user:pass@`** (`errors/utils.ts`, `getUrl`). The Arkiv SDK puts the access key in the URL path, so every Arkiv error message prints it. Prefer the `X-API-KEY` header via `fetchOptions.headers`, since headers aren't printed (inferred).
- **`fallback` is silent and covers reads**, and `rank` sends direct pings (section 1).
- **CCIP-Read uses the global `fetch`:** set `ccipRead: false` (section 3).
- **`http()` without a URL uses the chain's default RPC** (thirdweb, for `sepolia`), which bypasses the worker. Always pass the URL.
- **Normalize first:** `normalize` before `namehash`, `labelhash` or `packetToBytes`, none of which normalize. `packetToBytes` returns bytes, not hex.
- **Stale ENS text:** ENS's Universal Resolver guide still says `0xeeee…eeee` "will be upgraded to support ENSv2 in the future". On Sepolia the upgrade has already happened (on-chain check above).
- **BigInt** (inferred, standard viem behaviour): expiries and amounts come back as `bigint`.
  - Pass seconds as `BigInt(Math.floor(Date.now() / 1000))`; `Date.now()` is in milliseconds.
  - `JSON.stringify` throws on a bigint, so encode it before putting it in a payload or a link.
- **Fees:** both chains are EIP-1559, so no legacy fallback is needed. If a chain's blocks lacked `baseFeePerGas`, viem would switch to legacy `gasPrice` (`prepareTransactionRequest.ts`).

## Values to copy

| Name | Value | Source |
|---|---|---|
| viem version | `2.57.14` | `npm view viem version`, 2026-11-02 |
| Sepolia chain id | `11155111` | `sepolia.ts`; `cast chain-id`, 2026-11-02 |
| Sepolia Universal Resolver (viem's default; ENSv2) | `0xeeeeeeee14d718c2b47d9923deab1335e144eeee` | `sepolia.ts`; `isENSv2()` → `true` |
| → ManagedUniversalResolverProxy | `0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1` | deployments page; ERC-1967 slot |
| → UniversalResolverV2 | `0x24e1d8e068620b647ca097f961a61055f4f42d72` | deployments page; ERC-1967 slot |
| ENSv2 `ENSV1Resolver` | `0x322b7581ca210a69c6d0e0d7c88a7688d2789cb0` | deployments page; `findResolver(vitalik.eth)` |
| Sepolia multicall3 | `0xca11bde05977b3631167028862be2a173976ca11` | `sepolia.ts` |
| Local batch gateway | `x-batch-gateway:true` | `utils/ens/localBatchGatewayRequest.ts` |
| `ResolverNotFound(bytes)` selector | `0x77209fe8` | `cast sig`; the revert above |
| Rabdi chain id | `7794095` | SDK `rabdi.ts`; `cast chain-id`, 2026-11-03 |
| Rabdi RPC | `https://rpc.rabdi.db-chain.testnet.arkiv.network` (the SDK appends `/<accessKey>`) | SDK `rabdi.ts` |
| Rabdi block time | 2 s | `cast block -f timestamp` over 100 blocks, 2026-11-03 |
| Rabdi base fee / tip | 1 gwei / 0 | `cast block -f baseFeePerGas`, `eth_maxPriorityFeePerGas`, 2026-11-03 |
| Polling: Sepolia default / Arkiv to set | 4,000 ms / 1,000 ms | `createClient.ts` |
| `http` timeout default | 10,000 ms | `http.ts` |
| Retry defaults | 3 retries, 150 ms base, doubling | `buildRequest.ts` |
| Receipt wait defaults | 180,000 ms timeout, 6 retries, 1 confirmation | `waitForTransactionReceipt.ts` |
| Base-fee multiplier | 1.2 | `estimateFeesPerGas.ts` |

## Contradictions with idea.md

- **"a `fetch` becomes viem's transport".** idea.md, Sponsor plan: "Integration is one package, `@anon-rpc/browser-harness`, whose `worker.fetch` becomes viem's transport".
  - In viem a fetch function isn't a transport. It goes into `http(url, { fetchFn: worker.fetch })`; `custom()` takes an EIP-1193 `request` object instead (`clients/transports/http.ts`, `custom.ts`).
  - The harness's `fetch` is "Assignable to `typeof fetch`" (`@anon-rpc/harness-core` `src/spec-types.ts`).
  - This is a wording fix: the integration is still one line.
- **Timing claims hold only with tuning.** Not contradictions, but they need settings:
  - "deleting the payload takes one 2-second Arkiv block": true on-chain (2 s blocks), but with the SDK's `rabdi()` the app notices up to 4 s later unless `pollingInterval` is 1,000 ms (`createClient.ts`, SDK `rabdi.ts`).
  - "If a write stalls in the mixnet, the app retries it directly": viem's defaults take ~41 s to report a stall, and its `fallback` transport would retry silently and for reads too. Build the retry by hand (section 1).
- No other contradictions found.

## Test at kick-off

- [ ] `http(sepoliaUrl, { fetchFn: worker.fetch })`: `getBlockNumber` and `getEnsText` succeed, and the network panel shows no direct request to the RPC host.
- [ ] The same factory on Rabdi via the Arkiv SDK clients: `getChainId`, an entity read, and an `arkiv_query`.
- [ ] Whether the `rabdi()` URL with the key in its path works through the worker, or whether the `X-API-KEY` header is needed.
- [ ] Time requests through the mixnet; pick `timeout` and `retryCount` so a stall is detected in seconds.
- [ ] Whether the worker accepts JSON-RPC batch arrays and `eth_fillTransaction`, and how many polling requests a minute it tolerates.
- [ ] Stalled-write path: sign once, send through the worker, re-send the same bytes direct, handle "already known", find the receipt.
- [ ] Passing `chainId`, `nonce`, `gas` and fees: count the RPC calls a write makes, and whether `sendTransaction` still calls `eth_chainId`.
- [ ] An expired 20 s grant: what `getEnsText` returns for it, and that the courier view flips on the registry's answer.
- [ ] `getEnsText` on a `*.digipin.eth` name once our ENSIP-10 resolver is deployed.
- [ ] With `ccipRead: false`, all of Pata's resolution still works.
- [ ] `watchContractEvent` vs `getLogs` polling through the worker: whether filters survive.
- [ ] A uint64 expiry and a uint8 status come back as `bigint` and `number` (abitype's mapping; not read in source).
- [ ] The relay's nonce manager under several top-ups in a row on both chains.
- [ ] PRF → HKDF → `privateKeyToAccount` gives the same address on two devices with the same synced passkey.
