# Anon-RPC

Checked: 2026-11-03 · Version: `@anon-rpc/browser-harness` 0.4.0, npm `latest` (published 2026-10-28, `gitHead` c8980fb; read with `npm view` and `npm pack`), implementing spec 0.4.0 of 2026-10-23 ([CHANGELOG](https://github.com/ethereum/anon-rpc/blob/main/CHANGELOG.md)) · Status: test at kick-off
Feeds: idea.md "Why this model and architecture?" (Private lookups → Anon-RPC), the EF Anon-RPC and CROPS track checklists, Stack row "Private RPC", Risks row "Anon-RPC's Tor gateway", scope ladder P0 "Anon-RPC for every read" and P1 "Writes through Anon-RPC"; the CLAUDE.md RPC invariant.

Sources, all read 2026-11-02/03: the [app guide](https://ethereum.github.io/anon-rpc/wallets/) and its source [docs/integrate-wallet.md](https://github.com/ethereum/anon-rpc/blob/main/docs/integrate-wallet.md); [SPEC.md](https://github.com/ethereum/anon-rpc/blob/main/SPEC.md) 0.4.0; [adopters.json5](https://github.com/ethereum/anon-rpc/blob/main/adopters.json5); the [network guide](https://github.com/ethereum/anon-rpc/blob/main/docs/integrate-network.md); the harness source in the npm tarball (same as [impl/browser-harness](https://github.com/ethereum/anon-rpc/tree/main/impl/browser-harness) at commit c8980fb); the worker packages the on-chain specifiers pin: [`@hisoka-io/anon-rpc-worker` 0.4.1](https://www.npmjs.com/package/@hisoka-io/anon-rpc-worker) (Nox, repo [hisoka-io/nox-sdk](https://github.com/hisoka-io/nox-sdk)), [`tor-js` 0.4.4](https://github.com/ethereum/tor-js), [`@nymproject/anon-rpc-worker` 0.1.0](https://github.com/nymtech/anon-rpc-worker); viem 2.57.14 source. Context7 has no Anon-RPC library (searched 2026-11-02). Raw copies: `docs/research/sources/anon-rpc-*`.

## Install and setup

**Package.** `npm install @anon-rpc/browser-harness`. ESM only (`"type": "module"`, `"sideEffects": false`), MIT. Runtime deps: `@anon-rpc/harness-core` 0.4.0 (pinned exactly), `@kpstreams/webrtc-client` ^0.2.1 (which pulls `@kpstreams/core` ^0.2.1), `@noble/hashes` ^1.5.0 (npm metadata and [package.json](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/package.json)). "Status: prototype-grade reference implementation of a draft spec; interfaces track the spec and may change" ([harness README](https://www.npmjs.com/package/@anon-rpc/browser-harness)).

**Create and boot.** One class:

```ts
const worker = new AnonRpcWorker({ address, config, preExisting: { rpcProvider } });
// worker.ready: Promise<void>; worker.fetch: AnonFetch; worker.acceptLog(); worker.close()
```

- `address` is the specifier contract; `config` is a plain value the worker defines (JSON plus `undefined`, `Uint8Array`, `ArrayBuffer`; anything else makes the constructor throw `TypeError`); `iframeUrl` is optional (CSP case, below); `preExisting.rpcProvider` is `{ request({ method, params }) }`, "minimal EIP-1193-ish" ([harness-core spec-types.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/harness-core/src/spec-types.ts)). Without `rpcProvider`, boot throws "preExisting.rpcProvider is required to read the specifier" and `ready` rejects ([AnonRpcWorker.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/AnonRpcWorker.ts), `#boot`).
- Boot sequence in the source: two `eth_call`s through `rpcProvider` (`workerHash()`, then `workerResolvers()`, both at `"latest"`), a download of the bundle from the first working resolver, a keccak-256 check against the pinned hash, then a hidden `<iframe sandbox="allow-scripts">` appended to `document.body`, whose bootstrap blob-spawns a Web Worker that `importScripts` the verified bundle ([specifier.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/harness-core/src/specifier.ts), [AnonRpcWorker.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/AnonRpcWorker.ts), [iframe-boot.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/iframe/iframe-boot.ts)).
- `fetch` calls made before `ready` are buffered in order; `fetch` is this-bound, so `worker.fetch` can be passed as a free function ([guide](https://ethereum.github.io/anon-rpc/wallets/), "Practical notes"; SPEC §5).
- "One `AnonRpcWorker` per network, long-lived; don't construct per request." `close()` fails anything in flight; create a fresh instance to reconnect ([guide](https://ethereum.github.io/anon-rpc/wallets/)). "Network" there means the anonymizing network, not the chain: `worker.fetch` takes any URL, so one worker can carry Sepolia and Arkiv calls (SPEC §9.1; that both chains share one worker is our reading, consistent with idea.md).

**Choosing the worker type** is choosing the specifier `address` (plus its `config`). See "Worker types" under Limits and the Values table.

**Handing it to viem.** The guide: "pass it as a free function to anything that accepts a custom `fetch` or transport (a viem custom transport, …)" ([guide](https://ethereum.github.io/anon-rpc/wallets/)). viem's `http` transport takes a `fetchFn` option ([http.ts](https://github.com/wevm/viem/blob/viem@2.57.14/src/clients/transports/http.ts) line 39), used as `fetchFn = options.fetchFn ?? fetch` ([utils/rpc/http.ts](https://github.com/wevm/viem/blob/viem@2.57.14/src/utils/rpc/http.ts) line 105). So `http(rpcUrl, { fetchFn: worker.fetch })` keeps viem's timeout, retries and batching and only swaps the network layer (inferred as the best fit; the guide names no viem option). Two viem clients (Sepolia, Arkiv) can share the one `worker.fetch`.

**Browser features required** (from the source unless marked):
- Web Workers, a sandboxed `allow-scripts` iframe, `MessageChannel` and transferable streams (harness; [impl/README.md](https://github.com/ethereum/anon-rpc/blob/main/impl/README.md)).
- IndexedDB for worker storage, with an in-memory fallback ([idb-storage.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/idb-storage.ts); "persists across reloads", guide).
- WebRTC, for KPS: tor-js and Nox reach their networks only through `anonRpcWorker.kps`, which the host bridges over `@kpstreams/webrtc-client` ([kps-bridge-host.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/kps-bridge-host.ts); tor-js `src/anon-rpc-worker/worker.ts`; Nox README).
- WebAssembly: tor-js (Arti), Nym (smolmix) and Nox (Sphinx and rustls) all ship WASM inside the bundle (their READMEs). Nox fails with `wasm-blocked` unless the page's CSP allows `'wasm-unsafe-eval'` (Nox README, "Readiness and failure codes").
- WebSocket, nested blob Workers, `crypto.getRandomValues`: Nym only ("Limitations", Nym README). Nym is "not yet confirmed working on Safari".
- **Not required:** SharedArrayBuffer, so no COOP/COEP headers. `grep` for `SharedArrayBuffer`, `Atomics.wait` and `crossOriginIsolated` finds nothing in `host.js`, the tor-js or the Nox bundle; Nym's single hit sits inside an embedded fake-IndexedDB prelude (checked 2026-11-03; that it is harmless is inferred). No service worker: the harness source has none (open: confirm with a grep, see Test at kick-off).
- Firefox: refuses `importScripts(blob:)` in an opaque-origin worker; since 0.3.3 the harness falls back to a `data:` URL by itself ([CHANGELOG](https://www.npmjs.com/package/@anon-rpc/browser-harness), 0.3.3).

**CSP.** By default the iframe is `srcdoc` with an inline script, which inherits the page's CSP: if `script-src` lacks `'unsafe-inline'`, `ready` never settles. The fix is to serve the package's `dist/iframe-boot.js` from a same-origin page and pass `iframeUrl`; a cross-origin `iframeUrl` is rejected; on Firefox that page's `script-src` needs `data:` ([harness README](https://www.npmjs.com/package/@anon-rpc/browser-harness), "Strict Content Security Policies"; SPEC §6). If we set no CSP, none of this applies.

**Bundle size.** The harness is small: `dist/host.js` is 38,640 bytes unminified, `harness-core` dist JS 14,064 bytes, `@kpstreams/webrtc-client` dist JS about 8.3 kB, plus `@kpstreams/core` (211,992 bytes unpacked, all files) and the keccak part of `@noble/hashes` (measured from the tarballs 2026-11-03). The worker bundle is not in our build: it is downloaded at boot from a resolver and checked against the hash, capped at 64 MiB (`MAX_BUNDLE_BYTES`, [specifier.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/harness-core/src/specifier.ts)). Sizes of the pinned bundles: Nox 1,831,246 bytes, tor-js 6,874,306 bytes, Nym 18,283,862 bytes (npm tarballs of the pinned versions, 2026-11-03; Nox 0.4.0 gzips to 649,310 bytes per its README).

**Next.js, client only.** Importing the package is side-effect free; `document`, `window` and `location` are touched only inside `#boot`, `close()` and the `iframeUrl` check (dist/host.js lines 598-615, 739-751). Constructing it during SSR would fail at boot and reject `ready`. So construct it in the browser only: a module-level singleton created lazily on first use from a `'use client'` component (inferred from the source).

**Static site on an IPFS gateway.** Nothing in the harness needs a server: the iframe is `srcdoc` (no URL), and `iframeUrl`, if used, only has to be same-origin, which a static file on the same gateway is. Two open points: whether the chosen gateway sends a CSP that blocks the inline bootstrap or WASM, and that worker storage lives in IndexedDB on the gateway's origin, which a path gateway (`/ipfs/<cid>`) shares with every other site it serves (inferred). Open: test on the chosen IPFS host at kick-off.

## What Pata calls

**At app start, once per page load:** `new AnonRpcWorker(...)` for the chosen network, with a bootstrap `rpcProvider` that answers on the specifier's chain (mainnet for passthrough, tor-js and Nym; Sepolia for Nox; adopters.json5 `chainId`). The provider is the one direct RPC use. Then `http(SEPOLIA_RPC_URL, { fetchFn: worker.fetch })` and the same for `ARKIV_RPC_URL`.

What crosses `worker.fetch` in each idea.md flow (method lists inferred from what viem and an ENS or Arkiv read need; the Arkiv method names belong to `arkiv.md`):

| Flow | Chain | Through the worker |
|---|---|---|
| Household setup: register `sana.pata.eth`, set records, create the encrypted home record | Sepolia, Arkiv | Writes: `eth_chainId`, `eth_getTransactionCount`, `eth_estimateGas`, fee reads, `eth_sendRawTransaction`, `eth_getTransactionReceipt` polls. Through the worker from P1; direct in P0 |
| Consent: mint the grant subname, create its payload and history entry | Sepolia, Arkiv | Same write set |
| Courier view: resolve the grant, read its payload, detect expiry | Sepolia, Arkiv | Reads: `eth_call` to the Universal Resolver, the Arkiv entity read by key, `eth_blockNumber` or block polls |
| Stranger lookup (locality only) and `*.digipin.eth` | Sepolia | `eth_call` |
| Live-access and history screens | Arkiv | Arkiv owner query (its JSON-RPC method, see `arkiv.md`) |
| Revoke: delete the payload, `unregister` the subname | Arkiv, Sepolia | Write set |

Arkiv-specific methods pass through untouched: the harness never parses bodies, and Nox forwards "the body byte for byte, batches included", filing unknown methods under class `other` (not resent, adaptive reply budget) ([Nox `src/jsonrpc.ts`](https://github.com/hisoka-io/nox-sdk)). Custom headers pass too: the harness copies all headers ([normalize-request.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/normalize-request.ts)); Nox drops only `host`, `user-agent`, hop-by-hop fields, `content-length`, `expect`, `cookie`, `origin`, `referer`, `accept-encoding` and `proxy-*` (Nox `src/fetch-map.ts`, `DROPPED_REQUEST_HEADERS`), so `X-API-KEY` arrives; tor-js copies all headers into a record, collapsing duplicates (tor-js `src/anon-rpc-worker/helpers.ts`, `toFetchInit`).

**HTTP only, no WebSocket.** `AnonFetch` is a `fetch`; there is no socket call kind (SPEC §8: `IncomingCall = FetchCall`). Nox serves only absolute `http(s)` URLs and replaces the SDK's ambient `fetch` and `WebSocket` with a stand-in "that fails closed" (Nox README, "What the bundle contains"; `fetch-map.ts`). So viem's `webSocket` transport and any Arkiv subscription stay off the worker; use `http` with polling.

**Reaching Arkiv's Rabdi RPC** (`https://rpc.rabdi.db-chain.testnet.arkiv.network`):
- Passthrough: plain `fetch` from the null-origin sandbox, so CORS applies. Rabdi answers a preflight from `Origin: null` with `access-control-allow-origin: *` and `access-control-allow-headers: Content-Type, Authorization, X-Api-Key`, and `eth_chainId` returns `0x76edaf` (7794095). Sepolia's publicnode does the same (`allow-headers: content-type,x-api-key`). Checked 2026-11-03 with `curl -X OPTIONS <url> -H "Origin: null" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-api-key"` and `curl -X POST <url> -H "Origin: null" -H "content-type: application/json" --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'`.
- Nox: default `tls: "required"` accepts https on port 443 with a host name, which Rabdi is; the exit can still refuse a destination (`PortNotAllowed`, `HostNotAllowed`, `DestinationBlocked` become `permission-denied`; Nox `src/tls/transport.ts`). Its exit policy is not published in the package. **Open.**
- Nym: "Any `https://` RPC endpoint works through the worker" (Nym README, "Using it"). **Open** until tried.
- tor-js: HTTPS through Tor exits. Some providers refuse Tor traffic: Kiwi News "fails over to the next provider" when that happens ([adopters.json5](https://github.com/ethereum/anon-rpc/blob/main/adopters.json5)). **Open** for both RPCs.

**Writes.** `eth_sendRawTransaction` is just another POST through `worker.fetch`; the harness filters no method. The guide warns the worker "sees every request routed through it (including signed transactions before broadcast)" and can "observe, censor, or lie" ([guide](https://ethereum.github.io/anon-rpc/wallets/), "The trust model, honestly"). Timeouts:
- The harness has no timeout of its own; a call ends only by a response, a worker failure, or the caller's `AbortSignal`. An abort before delivery withdraws the call; after delivery the worker gets a `call-abort` ([AnonRpcWorker.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/AnonRpcWorker.ts) `#fetch`).
- viem's `http` aborts after `timeout`, default 10,000 ms ([utils/rpc/http.ts](https://github.com/wevm/viem/blob/viem@2.57.14/src/utils/rpc/http.ts) lines 110-175).
- Nox: "`eth_sendRawTransaction` is sent once and never resent; after a `timeout`, check the receipt by transaction hash" (Nox README). Nym: "Abort is not cancel… the in-flight mixnet transfer completes inside the WASM stack" (Nym README).
- So a write that timed out may still land. idea.md's direct retry should re-broadcast the same signed bytes (same hash, so it cannot double-spend) after checking the receipt by hash, never re-sign with a new nonce (inferred from the above).

## Limits

**Harness:** no rate limit, request-size limit or timeout; calls queue without bound, in order, and the worker takes them one `acceptCall` at a time, so concurrency is the worker's choice (SPEC §8; [call-queue.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/harness-core/src/call-queue.ts)). Bundle cap 64 MiB. Log buffer 1,000 entries, oldest dropped ([AnonRpcWorker.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/browser-harness/src/host/AnonRpcWorker.ts) `LOG_RETENTION`).

**Worker types** (adopters.json5 and the guide's tabs, read 2026-11-02; specifier chain checked on-chain 2026-11-03):

| Worker | Hides | From whom | Specifier chain | Latency and capacity | Use |
|---|---|---|---|---|---|
| passthrough | Nothing: "fulfils calls with an ordinary fetch, so requests are not anonymized" | none | mainnet | direct fetch | Develop only; it doesn't earn the Anon-RPC claim |
| tor-js | User IP from the RPC, via Tor circuits built in the browser | RPC provider; the gateway relays blind | mainnet | "a bootstrap delay before the first response, and higher per-request latency"; the only public gateway is a "Demonstration gateway only: limited capacity, and it may disappear at any time" | Only with our own gateway (open: cost and hosting) |
| Nym | User IP: exits at a Nym IP Packet Router, "so the RPC endpoint sees the router's address" | RPC provider; no single gateway links user to request | mainnet | ~18 MB bundle; "a few seconds to bootstrap"; fresh client identity each boot | Backup demo worker |
| Nox | User IP and request content: TLS runs in the worker, so the exit relays ciphertext and sees host name, timing and sizes; the entry sees the user's IP and encrypted packets | RPC provider, exit, entry (each partially) | Sepolia | Measured 2026-10-10 by Nox: warm median 381 ms from the US (p90 795 ms), **636 ms from India (p90 1,294 ms)**; cold boot 1.5 s US, 2.8 s India | Demo worker (and develop on it once it boots) |

**Nox defaults** (config keys, from its README "Configuration"): `attemptTimeoutMs` 12,000 (3,000-60,000); `callDeadlineMs` 25,000 (up to 120,000); `hedgeAfterMs` 3,000 (reads may be sent twice on two routes; writes never); `maxConcurrentCalls` 16 (1-64); `maxRequestBytes` 1,048,576 (up to 4 MiB); `maxResponseBytes` 8,388,608 (up to 64 MiB); request headers at most 65,536 bytes (`fetch-map.ts`); redirects at most 5; `tls` `"required"`; the whole JSON request padded to 512 B, 1 KiB, 4 KiB, 16 KiB buckets. Unknown or out-of-range config fails boot with `bad-config`. The worker also reads its node registry on Arbitrum Sepolia through the mixnet every 10 minutes (public data).

**tor-js:** no default gateway; config `{ gateways: ["ip:port:certhash"] }` is required (`resolveGateways` throws "There is no default gateway"). Bootstrap retries forever and `ready` stays pending, never rejects, while the gateway is down (tor-js `src/anon-rpc-worker/worker.ts`).

**viem:** `timeout` 10,000 ms, `retryCount` 3, batch size up to 1,000 per HTTP request when `batch` is on ([http.ts](https://github.com/wevm/viem/blob/viem@2.57.14/src/clients/transports/http.ts) lines 30-66, 121-125).

**Rabdi without a key:** response header `ratelimit: limit=2000, remaining=1997, reset=10` (curl above, 2026-11-03). Through a mixnet, a limit keyed on IP is shared by everyone leaving through the same exit (inferred); a limit keyed on the access key is not affected.

## Gotchas

1. **The specifier's chain is not the chain you query.** Passthrough, tor-js and Nym specifiers exist only on mainnet; Nox only on Sepolia. `cast code` on 2026-11-03 returned code for `0x4fd7…8d27`, `0x700d…659e`, `0x3aCD…0eD0` on mainnet and `0x` on Sepolia, and the reverse for `0x3513…7A9A` (`cast code <addr> --rpc-url https://ethereum-rpc.publicnode.com` and `--rpc-url https://ethereum-sepolia-rpc.publicnode.com`). adopters.json5: `chainId` is "the chain a wallet's bootstrap RPC must read it from — not the chain the anonymized fetch can reach". A Sepolia-only bootstrap provider can boot only Nox; the others need a mainnet RPC, which `.env.example` lacks.
2. **The bootstrap is more than one read.** Two `eth_call`s through the bootstrap provider, then a direct HTTPS GET of the bundle from a resolver (raw.githubusercontent.com, cdn.jsdelivr.net or unpkg.com) or a `kps:` fetch ([specifier.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/harness-core/src/specifier.ts) `fetchAndVerifyBundle`, which uses plain `fetch` for `https:`). Neither is anonymized. The calls show the bootstrap provider the user's IP and which specifier (so which network) is read; the GET shows the CDN the same. It happens on every boot (the harness keeps no bundle cache; the browser's HTTP cache may help, inferred).
3. **Specifiers can change under us.** All four have a live `owner()` (passthrough and tor-js `0x6d25087f4a72348AC367C3df825e7e94c9390915`, Nym `0xD8d46C9E736E662A2682245fe128722b96754518`, Nox `0xb18ddF10a9F6a0b9143d05B294815a83d3fa69C5`; `cast call <addr> 'owner()(address)'`, 2026-11-03). `setWorker` ships new code that wallets "pick up on their next boot" ([network guide](https://github.com/ethereum/anon-rpc/blob/main/docs/integrate-network.md)). Nox's stable address "follows the current release" and already pins 0.4.1 (`0xd9fa…38d4`), while its README documents 0.4.0; Nox also publishes an immutable pin per release (0.4.0: `0xDf5Db854BA75B52a4bF1a250a93D8d25cB982b2d`). For the demo, an immutable pin removes the surprise (open: whether a 0.4.1 pin exists).
4. **tor-js never fails its boot** while the gateway is down, so the app needs its own boot timeout and a visible state.
5. **Writes are not idempotent at the network layer.** See Writes above: Nox sends once, Nym's abort doesn't cancel, viem gives up after 10 s while Nox's own deadline is 25 s. Raise viem's `timeout` for the worker's transports above Nox's `callDeadlineMs`, and set `retryCount: 0` on the write path so viem doesn't resend a write the worker already delivered (inferred).
6. **The worker sees everything it carries,** including signed transactions and an Arkiv `X-API-KEY` header if we send one. With passthrough the destination and the worker see it in the clear; with Nox the exit doesn't (TLS in the worker hides "the URL path and query (API keys included), headers…").
7. **Response headers via Nox** come back lower-cased, sorted, with duplicates collapsed (`fetch-map.ts`). Harmless for JSON-RPC.
8. **Nox checks TLS certificates against the device clock;** a wrong clock fails with a message naming it (Nox README).
9. **`isolationKey`** (`anonOptions: { isolationKey }`): tor-js gives each key its own circuits and TLS session cache (tor-js README, "Circuit isolation"). Nox's README doesn't mention it (open). Passing a per-household key, or a per-grant key on the courier page, would stop the RPC linking one person's calls (inferred).
10. **Logs:** worker logs go to the console unless the host calls `acceptLog()`; a Tor bootstrap logs "hundreds of lines".
11. **Next.js dev mode** may run effects twice; a second `AnonRpcWorker` would boot a second sandbox and repeat the bootstrap. A module-level singleton avoids that (inferred).
12. **Polling and batching:** every receipt wait and expiry poll is one mixnet round trip (about 0.6 s warm from India on Nox). viem `batch: true` packs calls into one JSON array, which Nox carries whole (its local answers apply only to single calls). Nox caps concurrent calls at 16 by default.

## Values to copy

| Name | Value | Source |
|---|---|---|
| Package | `@anon-rpc/browser-harness@0.4.0` | npm, 2026-11-02 |
| Nox specifier (stable, owner-updatable) | `0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A`, Sepolia (11155111) | adopters.json5; `cast code`, 2026-11-03 |
| Nox 0.4.0 immutable pin | `0xDf5Db854BA75B52a4bF1a250a93D8d25cB982b2d`, Sepolia | Nox README "Release 0.4.0" (not checked on-chain) |
| Nox pinned hash today | `0xd9fa04b080a33062680a27cad828196bfb04615a0ebc76bcbffedb6dcbe838d4` (worker 0.4.1) | `cast call 0x3513…7A9A 'workerHash()(bytes32)' --rpc-url https://ethereum-sepolia-rpc.publicnode.com`, 2026-11-03; matches `dist/anon-rpc-worker.js.keccak256` |
| Nox config | `undefined` or `{}`; optional `gateways: ["100.56.0.72:15005:uEiBVDwIs40bsslDkM-BYb2AOHw3PHe70_bj5U_09r7vdIQ"]` | Nox README |
| Nym specifier | `0x3aCD9742C68F6d993066Ae25533e09b9e1f60eD0`, mainnet; config optional | adopters.json5; on-chain 2026-11-03 |
| tor-js specifier | `0x700dA3193D35fA54Cd3fBf29B66f2a2A0385659e`, mainnet | adopters.json5; on-chain 2026-11-03 |
| tor-js demo gateway | `{ gateways: ["152.236.3.22:12298:uEiCH0VdbhryzJcMtCfB0vLA4sOvHdQ4hq5w7CopcwU59bQ"] }` (limited capacity, may disappear) | adopters.json5 `exampleConfig` |
| Passthrough specifier | `0x4fd77be300f31c5fe6ab266d35d27750a3478d27`, mainnet (no anonymity) | adopters.json5; on-chain 2026-11-03 |
| Bundle resolvers seen on-chain | raw.githubusercontent.com, cdn.jsdelivr.net, unpkg.com, plus `kps:` entries for tor-js and Nox | `cast call <addr> 'workerResolvers()(string[])'`, 2026-11-03 |
| viem wiring | `http(url, { fetchFn: worker.fetch })` | viem 2.57.14 `http.ts` line 39 |
| viem defaults | `timeout` 10,000 ms, `retryCount` 3 | viem 2.57.14 `http.ts` lines 60-66, 125 |
| Nox call deadline | `callDeadlineMs` 25,000 (attempt 12,000) | Nox README |
| CSP needs (only if we set a CSP) | `script-src 'unsafe-inline'` or `iframeUrl`; `'wasm-unsafe-eval'` for Nox; `data:` on Firefox's bootstrap page | harness README; Nox README |
| Error type | `RpcError` with `.code` (branch on code, never message) | guide, "Errors and lifecycle" |

## Contradictions with idea.md

1. idea.md (Sponsor plan): "the guide's examples cover mainnet and Sepolia". The examples' **specifier contracts** are on mainnet (passthrough, tor-js, Nym) and Sepolia (Nox); the example target URL is a placeholder, `https://rpc.example/` ([guide](https://ethereum.github.io/anon-rpc/wallets/)). adopters.json5 says the specifier chain is "not the chain the anonymized fetch can reach". Consequence: unless we use Nox, the bootstrap provider must answer **mainnet**, and nothing in idea.md or `.env.example` provides one.
2. idea.md (Anon-RPC checklist and Stack): "the harness's single bootstrap read of the worker's specifier contract". The source makes **two** `eth_call`s (`workerHash()`, `workerResolvers()`) and then a **direct HTTPS download** of the bundle from a CDN or GitHub ([specifier.ts](https://github.com/ethereum/anon-rpc/blob/main/impl/harness-core/src/specifier.ts)). The guide itself says "Used ONCE" and "trusted for one read", so idea.md repeats the guide; the CROPS P line and the README should name the bundle download too.
3. idea.md: "reveals only that a specifier is being read". It reveals **which** specifier, so which anonymizing network, plus the user's IP, to the bootstrap provider; the bundle GET shows the same to the CDN. The guide's wording is "it reveals only that you're reading a specifier contract" ([guide](https://ethereum.github.io/anon-rpc/wallets/)); the extra detail comes from the source (point 2).
4. idea.md (CROPS S): "the Anon-RPC worker sees requests but no keys". The worker sees "signed transactions before broadcast" ([guide](https://ethereum.github.io/anon-rpc/wallets/)) and any API key we put in a header, such as Arkiv's `X-API-KEY` (gotcha 6). True for private keys; not for the access key, if we send one.
5. idea.md (Risks): "demo on the Nym or Sepolia mixnet worker". Nox is published on Sepolia but is not a Sepolia-only mixnet: it reaches any https host on port 443 that its exits allow (Nox README "End-to-end TLS"; adopters.json5). Naming only, but it matters for the Arkiv question.
6. idea.md (Risks): "If a write stalls, retry it directly". Nox sends a write once and says to "check the receipt by transaction hash" after a timeout; a stalled write may still land. The retry must re-broadcast the same signed bytes after a receipt check (Writes, above). A refinement, not a reversal.

## Test at kick-off

- [ ] Boot Nox in the Next.js page with a Sepolia bootstrap provider; time `ready` on venue Wi-Fi and on the phone hotspot.
- [ ] Through Nox: `eth_chainId` and an `eth_call` to Sepolia publicnode, and `eth_chainId` plus one Arkiv query to Rabdi, with and without the `X-API-KEY` header. A `permission-denied` means the exit refuses that host. (Open: Rabdi through any mixnet.)
- [ ] Same two calls through Nym (needs a mainnet bootstrap provider) as the backup worker; and through tor-js only if we run our own gateway.
- [ ] One write per chain through Nox: `eth_sendRawTransaction`, then the receipt; force a timeout and check that the direct re-broadcast of the same bytes is accepted or reported "already known".
- [ ] viem: `http(url, { fetchFn: worker.fetch, timeout: 30_000 })` works with `createPublicClient` and `@arkiv-network/sdk`'s client (open: whether the Arkiv SDK accepts a custom transport or fetch).
- [ ] The static build served from the chosen IPFS gateway boots the worker (CSP, WASM, IndexedDB).
- [ ] The demo phones' browsers (Chrome on Android; Safari if any iPhone) boot Nox: WebRTC and WASM in a sandboxed iframe.
- [ ] Courier view latency: resolve plus payload read end to end, target under 3 s warm.
- [ ] Re-read the four specifiers' `workerHash()` the morning of the demo (they are owner-updatable); consider the immutable Nox pin.
- [ ] Re-check EF's Anon-RPC and CROPS briefs on the prizes page (open below).

## Open

- EF brief re-check on [the Mumbai prizes page](https://ethglobal.com/events/mumbai/prizes): pending in this note (research.md last read it 2026-11-01).
- Whether `@arkiv-network/sdk` accepts a viem transport or custom fetch.
- Nox's `isolationKey` support; whether an immutable 0.4.1 pin exists.
