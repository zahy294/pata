# Arkiv

Checked: 2026-11-03 · Version: `@arkiv-network/sdk` 1.0.0, npm `latest`, published 2026-10-30 (read with `npm view` and `npm pack`, 2026-11-03), on the Rabdi testnet, chain 7794095 ([networks/rabdi](https://docs.arkiv.network/networks/rabdi/); `cast chain-id`, 2026-11-03) · Status: test at kick-off (the points still open are marked **open**)
Feeds: idea.md's "Speak once" (the encrypted home record), "The key that dies" (grant payload, courier view, expiry, revoke), the P1 live-access and history screens, the Arkiv track checklist and "Facts that shape the build", the Risks row "Arkiv is a second chain", and P1 "Writes through Anon-RPC". It also feeds the three Arkiv schemas that plan.md has to settle.

How to read the citations: "docs" means a page on docs.arkiv.network, read 2026-11-03 through its `.md` version (every page serves one, for example `https://docs.arkiv.network/writing/create.md`). "SDK source" means a file in the npm tarball of `@arkiv-network/sdk@1.0.0` ([code tab](https://www.npmjs.com/package/@arkiv-network/sdk/v/1.0.0?activeTab=code)), read 2026-11-03 and never run. "On-chain" means a read-only `cast` call against `https://rpc.rabdi.db-chain.testnet.arkiv.network` with no access key, run 2026-11-03; no transaction was sent.

## Install and setup

- **Package.** `npm install @arkiv-network/sdk viem` ([first entity](https://docs.arkiv.network/start-here/first-entity/)). It has no dependencies and two peer dependencies: `viem ^2.0.0` (required; built against 2.38.2) and `typescript >=5.0.0` (optional). `engines.node` is `>=18.0.0`, but the docs' tutorial asks for Node 22.10 or later; the team has 22.19. The package is ESM with CJS builds, and `LICENSE.md` is MIT, though `package.json` has no `license` field (SDK source `package.json`, `LICENSE.md`).
- **Entry points** (SDK source `package.json` `exports`):
  - `@arkiv-network/sdk`: clients, `ExpirationTime`, `NO_SALT`, errors;
  - `/chains`: `rabdi`, `localhost`;
  - `/schema`: `defineSchema` and the column types `bool`, `i32`, `u64`, `u256`, `dec`, `str`, `addr`, `key`, `bytes`;
  - `/query`: `eq`, `gt`, `gte`, `lt`, `lte`, `between`, `startsWith`, `exists`, `hasType`, `and`, `or`, `asc`, `desc`, `MAX_LIMIT`;
  - `/entity`, `/types`, `/utils`.
- **Chain object.** `rabdi` is a function, not a constant: `rabdi({ accessKey })` returns a viem chain whose RPC URLs carry the key as the last path segment (`https://rpc.rabdi.db-chain.testnet.arkiv.network/<key>`, and the same for `wss://`). `accessKey: ""` uses the keyless public endpoint and logs a `console.warn` once. A missing or non-string key throws `MissingAccessKeyError`. The chain has native currency `tGLM` (18 decimals) and the explorer `rabdi.explorer.arkiv.network` (SDK source `src/chains/rabdi.ts`; [clients](https://docs.arkiv.network/start-here/clients/)).
- **`tiramisu` is stale.** Tiramisu (chain 7738577, `rpc.tiramisu.db-chain.testnet.arkiv.network`) is "Replaced by Rabdi" ([older networks](https://docs.arkiv.network/networks/older-networks/)). SDK 1.0.0 exports only `rabdi` and `localhost` (SDK source `src/chains/index.ts`). The docs' generated API reference still lists only `localhost` and `tiramisu`, because it was built from an older SDK commit, `5182f6d` ([API reference: chains](https://docs.arkiv.network/typescript-sdk/api-reference/chains/)).
- **Clients.**
  - `createPublicClient` builds a viem client extended with viem's `publicActions` and Arkiv's read actions: `getEntity`, `select`, `count`, `query`, `getEntityNonce`, `predictEntityKeys`, `getBlockTiming`, `watchEntityEvents`.
  - `createWalletClient` adds `walletActions` and Arkiv's write actions: `createEntity`, `patchEntity`, `deleteEntity`, `extendEntity`, `changeOwnership`, `executeBatch`.
  - A wallet client has no Arkiv reads, so keep a public client beside it (SDK source `src/clients/createPublicClient.ts`, `createWalletClient.ts`, `decorators/arkivPublic.ts`).
- **Custom transport: yes.** Both factories take viem's `PublicClientConfig` and `WalletClientConfig`, generic over any `Transport`, and pass them straight to viem's `createClient` (SDK source, same files). The docs themselves use `http()`, `custom(window.ethereum)` and `custom(walletClient.transport)` ([clients](https://docs.arkiv.network/start-here/clients/), [React guide](https://docs.arkiv.network/guides/react/)). So an Anon-RPC worker's `fetch` can sit under these clients exactly as under a Sepolia viem client (inferred). **Open:** confirm that viem 2.x's `http(url, { fetchFn })` option exists, or use `custom({ request })`; the exact wrapper belongs to `anon-rpc.md`.
- **Signing in the browser without a wallet extension.** A viem local account (`privateKeyToAccount`) signs locally, and the docs' server example passes one to `createWalletClient` ([clients](https://docs.arkiv.network/start-here/clients/)). The household's device-held or passkey-derived key therefore works in the PWA with no injected wallet and no `addChain` (inferred).
- **JSON-RPC sent by the SDK** (SDK source `src/types/rpcSchema.ts`, `src/query/engine.ts`, `src/actions/**`, `src/utils/arkivTransactions.ts`):

  | SDK call | RPC on the wire |
  |---|---|
  | `select…fetch()`, `count…fetch()`, `query()` | `arkiv_query(queryString, { select, limit, offset })`: Arkiv-specific |
  | `getEntity(key)` | `arkiv_getEntity(key)`: Arkiv-specific; returns `null` for a missing, deleted or expired entity |
  | `getBlockTiming()` | `arkiv_getBlockTiming()`: Arkiv-specific |
  | `getEntityNonce`, `predictEntityKeys` | `eth_call` of `entityNonce(address)` on `0x4400…0044` |
  | `watchEntityEvents` | viem `watchEvent` on `0x4400…0044` (polled `eth_getLogs` or filter methods; **open**: which ones over HTTP) |
  | every write (`createEntity`, `patchEntity`, `deleteEntity`, `extendEntity`, `changeOwnership`, `executeBatch`) | `eth_blockNumber` (only when a create or extend needs the current block), then viem `writeContract` to `execute((uint8,bytes)[])` on `0x4400…0044`, then `waitForTransactionReceipt`; on a revert, `simulateContract` (`eth_call`) to decode the reason |

  With a local account, viem's `writeContract` fills the nonce, fees and gas, then sends `eth_sendRawTransaction`. That means standard `eth_getTransactionCount`, `eth_estimateGas`, `eth_getBlockByNumber` or `eth_maxPriorityFeePerGas` and `eth_chainId` calls, then `eth_getTransactionReceipt` polling (inferred from viem's write path; confirm by logging the transport at kick-off). "There's no `arkiv_*` method for writes" ([write transactions](https://docs.arkiv.network/json-rpc/mutating-entities/)). So writes use only standard `eth_*` methods, and reads use three `arkiv_*` methods.

## What Pata calls

Pata's terms map onto Arkiv's model like this. The household key is each entity's `$owner` and `$creator`. Each Pata record type is one named schema. All ciphertext goes in one `bytes` column, because "There is no payload or content type: store data in `str` (up to 128 bytes) or `bytes` columns" ([llms.txt](https://docs.arkiv.network/llms.txt)). Everything outside that `bytes` value is public: the schema tag, attribute names and values, owner, creator, and the created, updated and expiry blocks ([introduction](https://docs.arkiv.network/start-here/introduction/), "Arkiv is public").

**Schemas.** `defineSchema("<project>.<name>", { ... })` tags each entity with an indexed `str` attribute, `arkiv.schema`, and every query through the schema filters on that tag. A schema name can be any text up to 128 bytes. A named schema has at most 31 columns. `.indexed()` makes a column filterable; `bytes` can't be indexed ([define a schema](https://docs.arkiv.network/schemas/define/)). One schema each for the home record, the grant payload and the history entry, named under a `pata.` prefix (plan.md picks the names), means each screen's query is the schema plus `ownedBy(household)`. Pata needs no indexed column of its own: owner, key and expiry are entity fields, and those can be filtered and sorted without an index ([filter](https://docs.arkiv.network/querying/filter/#filter-on-entity-fields)) (inferred). Every indexed attribute would add public plaintext.

| Flow (idea.md) | Call | Parameters that matter | RPC |
|---|---|---|---|
| **Home record**, created at "Speak once" (P0) | `walletClient.createEntity(HomeRecord, { <bytes col>: ciphertext }, { expiration })` | `expiration` is required; at most 182.5 days (see Limits), so `ExpirationTime.fromDays(182)` and extend later. Don't set `readonly`, so a move can patch it. Returns `{ entityKey, txHash, expiresAt }` once the tx is in a block ([create](https://docs.arkiv.network/writing/create/)) | `eth_blockNumber`, then the write path above |
| Home record, updated when the household moves | `walletClient.patchEntity(HomeRecord, entityKey, { set: { <bytes col>: newCiphertext } })` | Owner only; changes only the named columns; fails on a `readonly` entity ([change](https://docs.arkiv.network/writing/change/)) | write path |
| Home record, read by its owner | `publicClient.getEntity(entityKey, HomeRecord)`, or `select(...).from(HomeRecord).ownedBy(household).fetch()` | `getEntity` throws `NoEntityFoundError` when no live entity has the key ([read one entity](https://docs.arkiv.network/querying/get-entity/)) | `arkiv_getEntity` / `arkiv_query` |
| **Grant payload**, created at approval (P0) | `walletClient.createEntity(GrantPayload, { <bytes col>: sessionKeyCiphertext }, { expiration: ExpirationTime.atDate(grantEnd) })` | `atDate` rounds up to the next block, counted from the current block at 2 s a block, against the device's clock (SDK source `src/entity/expiry.ts`). Keep the default random 128-bit salt, so nobody can guess the key before it exists ([create](https://docs.arkiv.network/writing/create/)) | write path |
| Grant payload plus history entry, in one approval | `walletClient.executeBatch({ creates: [{ schema: GrantPayload, values, expiration }, { schema: HistoryEntry, values, expiration, flags: { readonly: true } }] })` | One transaction, all or nothing; `result.createdEntities` lists the keys in `creates` order ([batches](https://docs.arkiv.network/writing/batches/)) | write path |
| **Courier view** reads the payload (P0) | `publicClient.getEntity(payloadKey, GrantPayload)`; the key comes from the link's `#` part | Expired or deleted → `NoEntityFoundError`, so the view flips to the locality. Check that `$owner` equals the household address from ENS, because anyone can create entities (inferred from [introduction](https://docs.arkiv.network/start-here/introduction/)) | `arkiv_getEntity` |
| **History entry** (P1) | `createEntity(HistoryEntry, values, { expiration: ExpirationTime.fromDays(182), flags: { readonly: true } })` | `readonly`: attributes can never change, but the owner can still extend, hand over or delete ([create](https://docs.arkiv.network/writing/create/#fix-properties-at-creation)). A revocation can't patch the entry, so it needs a new entry (inferred) | write path |
| **"Who can find my door"** live-access screen (P1) | `publicClient.select({ $key: true, $expiresAt: true }).from(GrantPayload).ownedBy(household).orderBy(asc("$expiresAt")).fetch()` | Renders as `arkiv.schema = str('…') AND $owner = addr(0x…) ORDER BY $expiresAt ASC` (SDK source `src/query/builderBase.ts`; [query language](https://docs.arkiv.network/reference/query-language/)). Expired and deleted entities aren't returned. Up to 100 rows a page. For a countdown, turn `$expiresAt` (a block) into a time with `getBlockTiming()`. Arkiv emits no expiry event, so poll ([expiration](https://docs.arkiv.network/writing/expiration/)) | `arkiv_query`, `arkiv_getBlockTiming` |
| Badge count | `publicClient.count().from(GrantPayload).ownedBy(household).fetch()`, or `.withCount()` on the select | Returns a `bigint` ([count](https://docs.arkiv.network/querying/count/)) | `arkiv_query` with `select: { count: true }` |
| **History screen** (P1) | `publicClient.select({ $key: true, $createdAt: true, <bytes col>: true }).from(HistoryEntry).ownedBy(household).limit(n).offset(m).fetch()` | `$createdAt` can't be sorted on the node, so sort the rows in JS ([sort](https://docs.arkiv.network/querying/sort/)). Page with `offset`, or by key ([paginate](https://docs.arkiv.network/querying/paginate/)) | `arkiv_query` |
| **Revoke** | `walletClient.deleteEntity({ entityKey: payloadKey })` | Owner only. "Once the transaction is in a block, the entity is gone, as if it had expired" ([change](https://docs.arkiv.network/writing/change/)). Emits `EntityDeleted(entityKey, owner)` ([write transactions](https://docs.arkiv.network/json-rpc/mutating-entities/#events)) | write path |
| Keep the home record or history alive | `walletClient.extendEntity({ entityKey, expiration: ExpirationTime.fromDays(182) })` | Counts from now, not from the old expiry; can't shorten; owner only unless `permissionlessExtension` was set ([expiration](https://docs.arkiv.network/writing/expiration/)) | write path |
| Optional live list updates | `publicClient.watchEntityEvents({ onEntityCreated, onEntityDeleted, onError })` | Polls every half block by default; events carry no attributes; no expiry event; a watcher sees only events from when it starts ([watch events](https://docs.arkiv.network/querying/watch-events/), [older networks](https://docs.arkiv.network/networks/older-networks/)) | viem `watchEvent` |

**Deletion and expiry in chain history.** Every write is a signed transaction to `0x4400000000000000000000000000000000000044` that calls `execute`. Each applied operation emits one event: `EntityCreated`, `EntityPatched`, `ExpiryExtended`, `OwnershipTransferred` or `EntityDeleted` ([write transactions](https://docs.arkiv.network/json-rpc/mutating-entities/)). An expired or deleted entity leaves `arkiv_query` and `arkiv_getEntity` ([read methods](https://docs.arkiv.network/json-rpc/querying-data/)). The create transaction's calldata holds the attribute values, so the ciphertext stays in the block that holds the transaction (inferred from the calldata format). Block 1's header is still served (on-chain: `cast block 1`). **Open:** whether an old create transaction's calldata can still be fetched (`eth_getTransactionByHash`), given that "Rabdi doesn't keep past blocks" for reads ([older networks](https://docs.arkiv.network/networks/older-networks/)).

**Who may write.** "Only the owner can change, hand over or delete" an entity ([introduction](https://docs.arkiv.network/start-here/introduction/)). The node rejects anyone else with `NotOwner(entityKey, caller, owner)` ([write transactions](https://docs.arkiv.network/json-rpc/mutating-entities/#errors)). The one exception is extension when `permissionlessExtension` is set. That would let the gas relay keep a household's history alive without being able to change or delete it (inferred).

## Limits

| Limit | Value | Source |
|---|---|---|
| Block time | 2 s. Blocks 1–3 and 130151–130154 are 2 s apart; `arkiv_getBlockTiming` returns `"duration":2` | [networks/rabdi](https://docs.arkiv.network/networks/rabdi/); on-chain: `cast block <n> --field timestamp`, `cast rpc arkiv_getBlockTiming` |
| **Maximum lifetime** | **7,884,000 blocks = 182.5 days.** A create whose expiry is more than that past the current block reverts with `ExpiryBeyondMaxLifetime(target, currentBlock, maxLifetime)` (selector `0xdd7e986b`). One year (15,768,000 blocks) reverts and 7,884,001 reverts; 7,884,000 succeeds. The docs' limits page doesn't list this; the SDK knows the error but doesn't check the cap before sending. Extensions are checked against the same bound | On-chain: `cast call 0x4400…0044` with `execute` calldata for a create, simulated from `0x…dEaD`, decoded with `cast decode-error`; SDK source `src/utils/arkivTransactions.ts`, `src/utils/revert.ts` |
| Minimum lifetime | 1 block. The expiry must be after the block that includes the tx (`ExpiryDeadOnArrival`). `fromSeconds(n)` needs `n` to be a multiple of 2 | [write transactions](https://docs.arkiv.network/json-rpc/mutating-entities/#expiry), [expiration](https://docs.arkiv.network/writing/expiration/) |
| Attributes per entity | 32, or 31 in a named schema | [limits](https://docs.arkiv.network/reference/limits/) |
| Attribute name | ≤ 32 bytes; starts with a letter, then letters, digits, `.`, `-` or `_`; case-sensitive; no `--`; can't be a keyword (`AND`, `OR`, `NOT`, `TRUE`, `FALSE`, `BETWEEN`, `STARTSWITH`, `EXISTS`, `TYPEOF`, `ORDER`, `BY`, `ASC`, `DESC`) or a type name; can't start with `$`; `arkiv.schema` is reserved | [define a schema](https://docs.arkiv.network/schemas/define/#naming-rules), [query language](https://docs.arkiv.network/reference/query-language/#other-rules) |
| `str` value | ≤ 128 bytes of UTF-8 | [column types](https://docs.arkiv.network/schemas/column-types/) |
| `bytes` | ≤ 128 KiB per value, and all `bytes` values of one create or patch share a single 128 KiB budget (`EntityTooLargeError`) | [column types](https://docs.arkiv.network/schemas/column-types/), [limits](https://docs.arkiv.network/reference/limits/) |
| Query page | 1–100 rows (`MAX_LIMIT`; `-32602` outside that range). The node also caps query length and nesting depth (`-32004`); those values aren't published (**open**). An RPC endpoint "may cap how big a response can be", and 100 rows of 128 KiB is about 12.5 MiB, so select `bytes` only where it's needed | [paginate](https://docs.arkiv.network/querying/paginate/), [read methods](https://docs.arkiv.network/json-rpc/querying-data/), [without a schema](https://docs.arkiv.network/querying/without-schema/) |
| Rate limits | Without a key: `ratelimit: limit=2000, remaining=1999, reset=10`. With a key: `limit=5000` plus an `arkiv-quota-used-percent` header. A made-up key gets HTTP 401 `INVALID_KEY`. The window unit (presumably `reset=10` seconds) isn't documented (**open**) | setup RPC check, 2026-11-02 (`eth_blockNumber` response headers) |
| Key quota | One key per wallet per network. Each key has a monthly quota "measured in cost units", shown on the Hub's Usage tab; more on request. The cost of each method in units isn't published (**open**) | [access keys](https://docs.arkiv.network/start-here/access-keys/) |
| Gas | Gas price 1 gwei (`eth_gasPrice`), base fee 1 gwei, `eth_maxPriorityFeePerGas` 0, block gas limit 30,000,000. Gas paid in tGLM. "A shorter lifetime costs less" ([expiration](https://docs.arkiv.network/writing/expiration/)) and "An index costs extra on every write" ([define](https://docs.arkiv.network/schemas/define/)). **Open:** tGLM per create for Pata's sizes and lifetimes | on-chain: `cast gas-price`, `cast rpc eth_maxPriorityFeePerGas`, `cast block latest` |
| Faucet | 20 tGLM per claim; "one claim per wallet, per cooldown window"; needs a wallet sign-in | setup check, 2026-11-02 ([faucet](https://hub.arkiv.network/faucet)) |
| Network age | Block 1 is timestamped 1793385698 (2026-10-30 18:41 UTC). Rabdi is days old | on-chain: `cast block 1 --field timestamp` |

## Gotchas

1. **The docs contradict themselves; trust the 1.0.0 guide pages and SDK source.**
   - `llms.txt` still lists `ne`, `not`, `next`, `for await`, `cursor` and `atBlock` ([llms.txt](https://docs.arkiv.network/llms.txt)).
   - The generated API reference still lists `tiramisu`, `jsonToPayload`, `stringToPayload`, `MimeType`, `MAX_PAYLOAD_BYTES`, `ne` and `not` ([API reference: main](https://docs.arkiv.network/typescript-sdk/api-reference/main/), [query](https://docs.arkiv.network/typescript-sdk/api-reference/query/)).
   - The column-types page says every indexed column takes `ne`.
   - Against all three, the migration page says "Rabdi has no `NOT` or `!=`", and drops cursors, `atBlock` and `fromBlock` ([older networks](https://docs.arkiv.network/networks/older-networks/)). SDK 1.0.0 exports no `ne` or `not` (SDK source `src/query/index.ts`).
   - Pin `@arkiv-network/sdk` to `1.0.0`. Generated code, including AI-written code, may use the pre-1.0 payload API. Log each mismatch in `arkiv/friction.md`.
2. **Anyone can write under Pata's schema tag.** "The tag keeps other projects' data out by accident, not on purpose." Filter with `ownedBy(household)` on every screen ([define](https://docs.arkiv.network/schemas/define/#name-the-schema-after-your-project), [filter](https://docs.arkiv.network/querying/filter/#filter-on-entity-fields)). A query through a schema silently skips entities that don't fit it and reports `page.skipped`; pass `onMismatch: "throw"` in tests ([select](https://docs.arkiv.network/querying/select/#entities-that-dont-fit-the-schema)).
3. **Expiry is silent.** "Arkiv emits no event when an entity expires." The live-access list empties only when the app queries again, so poll on a timer ([expiration](https://docs.arkiv.network/writing/expiration/)).
4. **Grant payload and ENS grant won't flip at the same second.**
   - Arkiv counts expiry in 2-s blocks. The SDK turns `atDate` into a block number from `Date.now()` on the device and the block number it read just before sending (SDK source `src/entity/expiry.ts`). Device clock skew moves the Arkiv expiry (inferred).
   - The ENS grant uses Sepolia's `block.timestamp`, with 12-s blocks (see `ens-v2.md`), so for the 20-s stage grant the payload probably goes first (inferred).
   - The courier view should treat either signal as "expired".
5. **A slow write can arrive dead.** The expiry is an absolute block fixed before sending. If a 20-s grant's create spends more than 20 s in the mixnet, it reverts with `ExpiryDeadOnArrival`. If it lands late, the payload lives correspondingly less (inferred from SDK source `src/utils/arkivTransactions.ts`). Writes resolve only after `waitForTransactionReceipt`.
6. **Retrying a stalled write can create a duplicate.**
   - viem picks the nonce at send time, so a direct retry of a create that is still in the mixnet gets a new nonce. Both can land (inferred).
   - Pass the same `nonce` in the last argument (`TxParams`: `gas`, `nonce`, fee fields) so only one can be mined ([create](https://docs.arkiv.network/writing/create/#set-transaction-fields)).
   - The SDK itself throws "succeeded — do not retry it" when a receipt's event count doesn't match (SDK source `src/utils/arkivTransactions.ts`).
7. **182.5 days at most.** See Limits. A history entry kept "a year" has to be created at ≤ 182.5 days and extended once. `readonly` still allows extending (on-chain check above; [create](https://docs.arkiv.network/writing/create/#fix-properties-at-creation)).
8. **Everything outside the ciphertext is public:** owner, creator, schema tag, attribute names and values, creation and expiry blocks ([introduction](https://docs.arkiv.network/start-here/introduction/)).
   - If the household uses one key on both chains (idea.md's Stack row), its Arkiv owner address equals the owner of `sana.pata.eth`. Anyone can then count its live payloads and history entries and see their timing, though not their contents (inferred).
   - ENS already shows that a grant exists and when it ends, so this adds little. Say it in the README's CROPS P line.
9. **No historical reads.** "Rabdi doesn't keep past blocks, so every read is of the latest block." Each page is read at the latest block, so writes and expiries between two pages can shift offsets ([older networks](https://docs.arkiv.network/networks/older-networks/), [paginate](https://docs.arkiv.network/querying/paginate/#writes-shift-the-pages)).
10. **Testnets get replaced, and their entities don't carry over.** Kaolin retired 15 May 2026, Braga 12 Aug 2026, and Tiramisu was replaced by Rabdi ([older networks](https://docs.arkiv.network/networks/older-networks/)). Rabdi started 2026-10-30, so it should outlive judging (inferred).
11. **The access key is in the URL path.** `rabdi()` appends it to both RPC URLs, so it's visible to anyone who sees the request URL: the browser, a proxy, an Anon-RPC exit or worker (SDK source `src/chains/rabdi.ts`). It identifies Pata's key, which belongs to the team's wallet, not to the household (inferred).
12. **Origins is attribution, not access control.** "Non-browser clients can forge the `Origin` header, so treat this as attribution, not access control" ([access keys](https://docs.arkiv.network/start-here/access-keys/#lock-the-key-down)). **Open:** whether requests relayed by the Anon-RPC worker still carry an allowed `Origin`; if they don't, leave Origins empty.
13. **The Arkiv address has no code.** `cast code 0x4400…0044` returns `0x`; the node handles it natively. Read calls still work: `entityNonce` returned 0 (on-chain). Tools may warn "Contract code is empty", and an `eth_call` of `execute` returns empty data even when it succeeds (on-chain). The SDK reads new keys from the `EntityCreated` logs instead.
14. **The docs omit the lifetime cap.** `ExpiryBeyondMaxLifetime` and the 182.5-day cap appear in neither the [limits](https://docs.arkiv.network/reference/limits/) page nor the JSON-RPC [error table](https://docs.arkiv.network/json-rpc/mutating-entities/#errors). This is a first `arkiv/friction.md` line.
15. **Small API traps** ([column types](https://docs.arkiv.network/schemas/column-types/), [create](https://docs.arkiv.network/writing/create/), [React guide](https://docs.arkiv.network/guides/react/)):
    - read every column through `.value`;
    - a bare `5` is `i32` and `5n` is `u256`, so wrap other numbers (`u64(5n)`, `dec("4.5")`);
    - `bytes` values come back as hex;
    - `createEntity` throws `SchemaMismatchError`, `InvalidValueError`, `EntityTooLargeError` or `InvalidExpiryError` before sending, and `EntityMutationError` on a failed or reverted tx;
    - keep `bigint` values out of TanStack Query keys.

## Track requirements (Build on Arkiv, from scratch)

From research.md's reading of the [prizes page](https://ethglobal.com/events/mumbai/prizes) on 2026-11-01. **Open:** a re-check today.
- A feature users see must read from Arkiv. Not counted: "the SDK installed but never used to read, or Arkiv used only as a log nothing reads". Pata's reads are the courier view (`getEntity`), the live-access screen and the history screen (`select…ownedBy`).
- The README lists the wallet addresses that wrote the entities, plus one query judges can run. A judge-runnable form is a raw `arkiv_query` curl against the public RPC: `["arkiv.schema = str('<pata schema>') AND $owner = addr(<household>)", { "select": { "key": true, "expiresAt": true, "count": true } }]`, a format taken from [read methods](https://docs.arkiv.network/json-rpc/querying-data/). Without a key it hits the rate-limited public endpoint, which works for one query (setup RPC check).
- `/arkiv/schema.md` covers the entities, the fields queried, the owners and the lifetimes. The other files are `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md` and `/arkiv/how-you-use-arkiv.md`.

## Values to copy

| Name | Value | Source |
|---|---|---|
| Package | `@arkiv-network/sdk@1.0.0`, peer `viem@^2.0.0` | `npm view`, 2026-11-03 |
| Chain | `rabdi({ accessKey })` from `@arkiv-network/sdk/chains` | SDK source `src/chains/rabdi.ts` |
| Chain ID | `7794095` (`0x76edaf`) | [networks/rabdi](https://docs.arkiv.network/networks/rabdi/); on-chain `cast chain-id` |
| HTTP RPC | `https://rpc.rabdi.db-chain.testnet.arkiv.network` (key: `/<key>` suffix, `X-API-KEY` header, or `Authorization: Bearer <key>`) | [access keys](https://docs.arkiv.network/start-here/access-keys/) |
| WebSocket RPC | `wss://rpc.rabdi.db-chain.testnet.arkiv.network` (key in path or `X-API-KEY`) | same |
| Explorer | `https://rabdi.explorer.arkiv.network` | [networks/rabdi](https://docs.arkiv.network/networks/rabdi/) |
| Faucet, access keys | `https://hub.arkiv.network/faucet`, `https://hub.arkiv.network/access-keys` | same |
| Arkiv address | `0x4400000000000000000000000000000000000044` (all Arkiv chains) | [write transactions](https://docs.arkiv.network/json-rpc/mutating-entities/); SDK source `src/consts.ts` |
| `execute` selector | `0x49650044`, `execute((uint8 operation, bytes operationData)[] ops)` | same |
| `entityNonce(address)` selector | `0x36917bfd` | same |
| Operation tags | 1 create, 2 patch, 3 extend, 4 transfer, 5 delete | same |
| Max lifetime | `7884000` blocks (182.5 days) | on-chain, 2026-11-03 |
| Block time | 2 s (`BLOCK_TIME = 2`) | SDK source `src/consts.ts`; on-chain |
| Rows per page | 100 (`MAX_LIMIT`) | [limits](https://docs.arkiv.network/reference/limits/) |
| Gas price | 1 gwei; priority fee 0 | on-chain, 2026-11-03 |
| Env name for a browser-shipped key | Next.js exposes only `NEXT_PUBLIC_*` to the browser, and the docs use `NEXT_PUBLIC_ARKIV_ACCESS_KEY`; `.env.example` has `ARKIV_ACCESS_KEY` | [React guide](https://docs.arkiv.network/guides/react/) |
| Stale testnet (don't use) | Tiramisu, chain `7738577` | [older networks](https://docs.arkiv.network/networks/older-networks/) |

## Contradictions with idea.md

1. **"Kept for a year."** idea.md, Sponsor plan: "the household's history, kept for a year, with read-only entries". Track checklist: "History entries last a year and are created `readonly`". **Contradicted on-chain:** Rabdi's maximum lifetime is 7,884,000 blocks (182.5 days), and a one-year create reverts with `ExpiryBeyondMaxLifetime(15898136, 130136, 7884000)` (`cast call` simulation of `execute`, 2026-11-03). Fix: create at ≤ 182.5 days and extend later (`readonly` allows extension), or say "kept six months, extendable".
2. **Not idea.md, but the brief and handoff.md:** "Arkiv's docs say to keep the key on a server." No current docs page says so (all 37 guide pages searched, 2026-11-03). The [access keys](https://docs.arkiv.network/start-here/access-keys/) page says "In a web app, anyone can read it from the network requests, so add your site to the key's **Origins**." The [clients](https://docs.arkiv.network/start-here/clients/) page says "In a browser app, read the key from your bundler's public environment variables and lock it to your site." The SDK says the key "is not a secret, as it ships with any app that talks to the chain, but restrict it to your origins or IPs" (SDK source `src/chains/rabdi.ts`). So a static PWA may ship the key. The only cost is quota abuse, and the server-side alternative would put our server in every read path (inferred).

Nothing else in idea.md's "Facts that shape the build" conflicts with the sources: 2-s blocks, `ExpirationTime.atDate`, the 128 KiB `bytes` budget, schema tags, the attribute-name rules, and expired entities leaving queries while their transactions stay on chain.

## Test at kick-off

- [ ] Arkiv SDK public and wallet clients over the Anon-RPC worker's transport: `arkiv_query`, `arkiv_getEntity` and `eth_sendRawTransaction` all pass through, with the key in the URL path. Log every method the transport sees.
- [ ] Whether an Origins-locked key still works through the worker. If not, leave Origins empty.
- [ ] A 20-s grant payload created with `atDate` through the worker: it lands before its deadline, `getEntity` flips to `NoEntityFoundError` after it, and the gap to the ENS grant's flip is measured.
- [ ] A `readonly` history entry with `fromDays(182)` succeeds, `fromDays(183)` reverts, and `extendEntity` works on the `readonly` entry.
- [ ] tGLM spent per create for the real home-record, payload and history sizes, so the relay's top-ups can be sized (20 tGLM per faucet claim).
- [ ] The live-access screen's polling rate against the 2,000 (no key) and 5,000 (key) limits.
- [ ] Response size: a page that selects the `bytes` column with audio inside.
- [ ] Whether an expired payload's create transaction can still be fetched by hash, so the README states the ciphertext's afterlife accurately.
- [ ] On Nov 5, re-check the Arkiv track text on the prizes page.
