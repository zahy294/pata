# Foundry

Checked: 2026-11-03 · Version: forge/cast/anvil/chisel 1.8.7 (commit 985eeea, built 2026-10-29), read from `forge --version`; v1.8.7 is the latest stable release on [GitHub releases](https://github.com/foundry-rs/foundry/releases/tag/v1.8.7) (published 2026-10-29; later tags are nightlies) · Status: test at kick-off (answered on paper; the items at the end need hour-0 checks)
Feeds: idea.md "Build" Stack row "Names" (the `*.digipin.eth` wildcard resolver, our only custom Solidity); Scope ladder P1 "The `*.digipin.eth` wildcard resolver"; demo moment 3 (`39j49ll8t4.digipin.eth`); Data "DIGIPIN test vectors"; CLAUDE.md "`npm run check` ... `forge test`".

Docs: the current Foundry docs are at <https://getfoundry.sh> (the CLI's own help links `https://getfoundry.sh/forge/overview`). The whole site is published as `https://www.getfoundry.sh/llms-full.txt`; a copy read on 2026-11-03 is in `docs/research/sources/foundry-llms-full.txt` (git-ignored). Citations below as "docs: <page>" point at <https://getfoundry.sh><page>. Where the docs and the 1.8.7 binary disagree, the binary wins and the note says so.

Items still marked **open** are not answered from a source; each one is repeated under "Test at kick-off".

## Install and setup

- Installed: `C:\Users\ASUS\.foundry\bin` holds `forge.exe`, `cast.exe`, `anvil.exe`, `chisel.exe`, `solar.exe` and `foundryup` (`ls ~/.foundry/bin`, 2026-11-02). It is on the Windows user PATH, but the current Git Bash session does not see it (`which forge` fails), so call `"$HOME/.foundry/bin/forge"` until terminals restart.
- `foundryup` "requires Git Bash or WSL. PowerShell and Command Prompt are not supported" (docs: /introduction/installation). That applies to the installer only; the `.exe` binaries run from any shell once on PATH (inferred; test at kick-off from cmd.exe, see below).
- No solc yet: `~/.svm` does not exist (2026-11-02). The first `forge build` downloads the solc version it needs, so the first build needs the network. Run it on good Wi-Fi at hour 0, not on stage. `--offline` / `offline = true` stops downloads ("Missing solc versions will not be installed", `forge test --help`).
- Layout for this repo (recommendation): one Foundry project in `contracts/` beside the Next.js app, with its own `foundry.toml`, `src/`, `test/`, `script/`, `lib/`. The docs' monorepo section shows per-project `foundry.toml` files in subfolders (docs: /projects/layout, "Monorepo setup").
- `forge init` options in 1.8.7 (`forge init --help`): `[PATH]` (default `.`), `--no-git`, `--use-parent-git` ("Use the parent git repository instead of initializing a new one. Only valid if the target is in a git repository"), `--empty` (no Counter example files), `--offline` (alias `--no-deps`), `--vscode` (writes `.vscode/settings.json` and `remappings.txt`), `--commit`, `--shallow`, `--force`, `--template`.
  - For Pata, after `git init` at the repo root: `forge init contracts --use-parent-git --empty`. This keeps one git repo and installs forge-std into `contracts/lib/forge-std` as a submodule of the root repo (inferred from the flag text; test at kick-off).
  - `forge init` no longer commits unless `--commit` is passed (flag list above), which suits "small commits named with the ticket id".
- Project root discovery: `--root` "By default [is the] root of the Git repository, if in one, or the current working directory" (`forge test --help`, `forge install --help`). Source settles it: `find_project_root` walks up from the current directory to the first folder holding `foundry.toml`, stopping at the git root, and falls back to the git root ([`crates/config/src/utils.rs` at v1.8.7](https://github.com/foundry-rs/foundry/blob/v1.8.7/crates/config/src/utils.rs)). So from `contracts/` forge finds `contracts/`; from the repo root (no `foundry.toml` there) it picks the repo root and fails. From the repo root, always pass `--root contracts`.

### Dependencies

Pata's contract needs very little: forge-std for tests and scripts, plus the ENSIP-10 `IExtendedResolver` interface and ERC-165. Fewer dependencies mean fewer submodules for judges to fetch.

| Way | Command | Notes |
|---|---|---|
| git submodule (default) | `forge install OpenZeppelin/openzeppelin-contracts@v5.x.y` | Cloned to `lib/<name>`. Foundry keeps `foundry.lock` (branch/tag/rev and resolved commit); commit it. `forge build --locked` fails if submodules drift from it. "If your Foundry project is nested below the Git root, check `foundry.lock` for a stale dependency entry after removal" (docs: /projects/dependencies; `forge build --help`). |
| `--no-git` | `forge install --no-git <dep>` | Plain directory, not a submodule, not in `foundry.lock` (docs: /projects/dependencies). |
| Soldeer | `forge soldeer install @openzeppelin-contracts~5.0.0` | Packages go in `dependencies/`, versions in `[dependencies]`, lock file `soldeer.lock`; remappings like `@openzeppelin-contracts/...` (docs: /projects/soldeer). |
| npm | `npm i @openzeppelin/contracts` + `libs = ["lib", "node_modules"]` | Docs warn "npm packages may not be designed for Foundry. Prefer git submodules for Solidity libraries" (docs: /projects/dependencies). With `node_modules` at the repo root and the project in `contracts/`, the path is `../node_modules` (inferred). |

- Remappings: auto-detected from `lib/` (`auto_detect_remappings = true`, `forge config`). Explicit ones go in `foundry.toml` `remappings = [...]` or `remappings.txt`; `forge remappings > remappings.txt` writes them out for the editor (docs: /projects/dependencies).
- **open:** which package the ENS agent picks for `IExtendedResolver` (ens-contracts v1 vs the ENSv2 repo) and whether it is on Soldeer. The interface is one function (`resolve(bytes,bytes) returns (bytes)`); vendoring it with its licence header may be simpler than a submodule (inferred).

## What Pata calls

### Config (`contracts/foundry.toml`)

Defaults printed by `forge config` (1.8.7, run in an empty folder, 2026-11-03): `evm_version = "osaka"`, `optimizer = false`, `optimizer_runs = 200`, `via_ir = false`, `bytecode_hash = "ipfs"`, `cbor_metadata = true`, `auto_detect_solc = true` (no solc pinned), `gas_reports = ["*"]`, `[fuzz] runs = 256` (no seed), `[invariant] runs = 256, depth = 500`, `fs_permissions = [{ access = "read", path = "out" }]`, `lint_on_build = true`, `broadcast = "broadcast"`, `cache_path = "cache"`, `ignored_error_codes` includes `"code-size"` and `"init-code-size"`.

Proposed settings (each is a reason, not a requirement):

| Key | Value | Why |
|---|---|---|
| `solc` | pin one exact version (**open:** which; latest is 0.8.36 or later per docs: /forge/gas-accounting) | Verification needs the exact compiler; `solc` takes a strict version, not a range (docs: /config/reference/solidity-compiler). |
| `evm_version` | `"osaka"` (the 1.8.7 default), pinned explicitly | Sepolia runs **Glamsterdam (Amsterdam)** since 2026-10-06 13:53:36 UTC (below), which runs Osaka bytecode unchanged. Compiling for `amsterdam` is "experimental" in Solidity 0.8.36 and needs `--experimental` (docs: /forge/gas-accounting), and the resolver needs no new opcode. |
| `optimizer` / `optimizer_runs` | `true` / `200` | The resolver is called via `eth_call`, so runtime gas matters little; optimizer keeps bytecode small. |
| `via_ir` | `false` | Slower compiles; "Enable it only when needed" (docs: /forge/build). |
| `[fuzz] seed` | fixed, e.g. `"0x1"` | `npm run check` gives the same result every run; docs show this for CI (docs: /config/testing). |
| `[rpc_endpoints] sepolia` | `"${SEPOLIA_RPC_URL}"` | Lets scripts and fork tests use `--rpc-url sepolia` (docs: /forge/scripting). |
| `[etherscan] sepolia` | `{ key = "${ETHERSCAN_API_KEY}" }` | Used by `--verify` (docs: /guides/scripting-with-solidity). |
| `fs_permissions` | add `{ access = "read", path = "<vectors file>" }` if tests read shared DIGIPIN vectors | Default only allows reading `out/`. **open:** whether a path outside the project root (`../`) is allowed. |

The docs config reference still says `evm_version` "Default: prague" (docs: /config/reference/solidity-compiler); the 1.8.7 binary says `osaka`. Pin it so docs, binary and teammates' versions can't disagree.

Profiles: select with `--profile <name>` (a flag on every forge command in 1.8.7), not `FOUNDRY_PROFILE=x forge ...`, because that prefix syntax doesn't work in cmd.exe, which npm uses for scripts on Windows (npm's `script-shell` default; **open:** citation not fetched).

### Build

- `forge build --root contracts` (from the repo root). `forge build --sizes` prints runtime and initcode sizes; `--locked` checks `foundry.lock` (`forge build --help`).
- Solc's own size warnings are ignored by default (`ignored_error_codes` includes `code-size`, `init-code-size`, `forge config`), so check size with `--sizes`, not by reading warnings.

### Test

- `forge test --root contracts` (exit code non-zero on failure is what `npm run check` relies on; **open:** confirm by a failing test at kick-off).
- Useful flags (`forge test --help`): `--match-test`/`--mt`, `--match-contract`/`--mc`, `--match-path`/`--mp`, `-vvv` (traces for failing tests), `--fuzz-runs <N>` (env `FOUNDRY_FUZZ_RUNS`), `--fuzz-seed`, `--gas-report` (env `FORGE_GAS_REPORT`), `--fail-fast`, `--offline`, `--fork-url`/`--rpc-url`, `--fork-block-number`, `--enable-tx-gas-limit` (applies Osaka's EIP-7825 per-transaction cap, off by default), `--code-size-limit` ("By default, it is 0x6000 (~25kb)").
- DIGIPIN tests (shape only; the algorithm is in `digipin.md`):
  - one unit test per fixed vector, starting with India Post's `39J-49L-L8T4` (Dak Bhawan);
  - fuzz round-trips: bound the latitude and longitude inputs to DIGIPIN's bounding box with forge-std's `bound`, encode, decode, and assert the point lies in the decoded cell; and decode→encode returns the same code for any valid 10-symbol label;
  - fuzz rejection: labels with a symbol outside the 16-letter alphabet or the wrong length must not resolve.
  - Invariant tests (stateful call sequences, `[invariant]` above) fit a contract with state; a stateless resolver gets little from them beyond fuzzing (inferred), so skip them unless the resolver gains an owner or storage.
  - Sharing vectors with the TypeScript tests: read one JSON file with `vm.readFile` + `vm.parseJson*`, which needs an `fs_permissions` entry (docs: cheatcode pages under /reference/cheatcodes). Differential fuzzing against the JS encoder through `vm.ffi` is possible but needs `ffi = true` ("allows tests to execute arbitrary programs", docs: /config/testing) and Windows needs `npm.cmd`-style names ("some commands like `npm` or `npx` fail to execute with 'program not found'", docs: ffi page). Not worth it for a hackathon (opinion).
- Fork tests against Sepolia: `forge test --fork-url sepolia` (alias from `[rpc_endpoints]`) or `vm.createSelectFork("sepolia")` in `setUp`. Keep them out of `npm run check` (network, rate limits): name them `*Fork*` and add `--no-match-contract Fork` to the check script (opinion). RPC responses are cached under `~/.foundry/cache/rpc` by default (`rpc_storage_caching` "all", `forge config`).
- Gas: `forge test --gas-report`; `forge snapshot` writes `.gas-snapshot` (docs: /forge/gas-tracking).

### `npm run check` on Windows

- Proposed script (repo-root `package.json`): `tsc --noEmit && vitest run && forge test --root contracts --no-match-contract Fork`. `&&` works in cmd.exe; `forge.exe` must be on PATH in the shell npm starts (the user PATH has it).
- **open:** cite npm's `script-shell` default (cmd.exe on Windows).
- Watch-out (inferred, **open** until checked): a git-submodule dependency brings its whole repo, including JS/TS tests and configs. Vitest's default include pattern would pick up `contracts/lib/**/*.test.js`, and `tsc` would type-check any `.ts` under `contracts/lib`. Exclude `contracts/**` in `tsconfig.json` and the Vitest config.

### Deploy to Sepolia

- Use `forge script` (opinion): it simulates first, writes `broadcast/` records, can verify in the same run, and `--resume` recovers a half-sent run. `forge create` is fine for one contract: `forge create src/DigipinResolver.sol:DigipinResolver --rpc-url sepolia --broadcast ...`; without `--broadcast` it does not send ("--broadcast  Broadcast the transaction", `forge create --help`).
- Command (from `contracts/`): `forge script script/DeployDigipinResolver.s.sol --rpc-url sepolia --broadcast --verify -vvvv`.
  - Without `--broadcast` it only simulates against the RPC (docs: /forge/scripting-internals).
  - Gas estimates get a 130% multiplier by default (`-g`, `forge script --help`).
- Keeping `DEPLOYER_PRIVATE_KEY` off the command line: in the script, `uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY"); vm.startBroadcast(pk);` ("The private-key overload derives the address and adds the key to Forge's script wallets", docs: /forge/scripting). Foundry's own `--private-key` flag has no environment variable (`forge create --help` shows none), so the env route is the cheatcode.
- Getting `.env.local` into the environment: **Foundry only auto-loads files named `.env`**, from the project root and the current directory (docs: /reference/cheatcodes/env-string note: "Foundry reads the `.env` file in the project root ... and ... the one in your current working directory"). It will not read `.env.local`. Options:
  - Git Bash: `set -a; source ../.env.local; set +a` then run forge (CRLF risk below).
  - A tiny Node wrapper run with `node --env-file=.env.local` that spawns forge (inferred; Node 22 is installed).
  - The docs' recommended alternative is an encrypted keystore: `cast wallet import deployer --interactive`, then `--account deployer` (docs: /guides/deploying-contracts). That moves the key out of `.env.local`, against CLAUDE.md's "Secrets live in `.env.local`".
- Env vars forge reads by itself (`forge script --help`, `forge create --help`): `ETHERSCAN_API_KEY` (for `--etherscan-api-key`), `CHAIN`, `ETH_FROM`, `ETH_KEYSTORE`, `ETH_KEYSTORE_ACCOUNT`, `ETH_PASSWORD`, `ETH_GAS_PRICE`, `ETH_PRIORITY_GAS_PRICE`, `ETH_TIMEOUT`, `ETH_RPC_TIMEOUT`, `VERIFIER_URL`, `VERIFIER_API_KEY`. `--rpc-url` on forge shows no env var; `[rpc_endpoints]` interpolation covers it.
- The deploy and verify calls are direct RPC and Etherscan calls from a developer machine, not app traffic through the Anon-RPC worker. `.env.example` already says "Direct RPC for Foundry scripts"; the README should say so too.

### Verify

- Default verifier logic in 1.8.7 (source: [`crates/verify/src/verify.rs` at v1.8.7](https://github.com/foundry-rs/foundry/blob/v1.8.7/crates/verify/src/verify.rs), `VerifierArgs::resolve` and `collect_runs`):
  1. an explicit `--verifier` wins;
  2. otherwise, if an Etherscan key is set and the chain has an Etherscan URL, Etherscan;
  3. otherwise Sourcify.
  When the primary isn't Sourcify, Foundry also submits to Sourcify as a non-required extra run.
  So with `ETHERSCAN_API_KEY` set, `--verify` goes to Etherscan and Sourcify; without it, Sourcify only. Sourcify needs no key.
- Etherscan API V2: "only Etherscan keys are valid, which can be used to access all similar explorers" (docs: /config/reference/etherscan). There is no `--etherscan-api-version` flag in 1.8.7 (`forge verify-contract --help`). **open:** whether Etherscan's free tier covers Sepolia.
- Manual: `forge verify-contract <address> src/DigipinResolver.sol:DigipinResolver --chain sepolia --watch` (`forge verify-contract --help` example), `--verifier sourcify` for Sourcify, `--guess-constructor-args` if needed, `forge verify-check <guid>` for status.
- Verification needs the same compiler settings as the build (docs: /best-practices "Verify deployments with the exact compiler settings"). Pin `solc`, `evm_version`, optimizer settings.

### `broadcast/` and `cache/`

- `forge script` writes `broadcast/<script file>/<chain id>/run-latest.json`, plus an immutable `run-<timestamp>.json` when the run finishes; dry runs go under `dry-run/` (docs: /forge/broadcast-files). Read the address from `transactions[].contractAddress` by `contractName`.
- For each broadcast file, Forge writes a twin under `cache/` that "stores the RPC URL of each transaction, which can contain an API key", plus the `.recovery.json` that `--resume` needs since 1.8.4 (docs: /forge/broadcast-files, /forge/scripting).
- So: commit `broadcast/DeployDigipinResolver.s.sol/11155111/` (a public deployment record judges can read; the addresses are public anyway). Never commit `cache/`. Ignore `broadcast/**/dry-run/` and `broadcast/*/31337/` (local anvil runs). Keep `cache/` on disk until the deployment is finished, since resume needs it.
- The `.gitignore` that `forge init` 1.8.7 writes ([`crates/forge/assets/.gitignoreTemplate`](https://github.com/foundry-rs/foundry/blob/v1.8.7/crates/forge/assets/.gitignoreTemplate)): `cache/`, `out/`, `.logs/`, `.ignore/`, `!/broadcast`, `/broadcast/*/31337/`, `/broadcast/**/dry-run/`, `docs/`, `.env`, `.env.*`, `!.env.example`. So it keeps Sepolia broadcast files, matching the plan above. The docs page saying the template ignores `broadcast/` (docs: /projects/layout) is wrong for 1.8.7.
- That template ignores `docs/`. Inside `contracts/` it only hits `contracts/docs/`; never run `forge init --force` at the repo root, or Pata's `docs/` (plans ETHGlobal wants in the repo) gets ignored.

### cast, by hand

RPC: cast reads `--rpc-url` or the `ETH_RPC_URL` environment variable (docs: /cast/reading-chain-data). Commands checked with `cast <cmd> --help` (1.8.7):

| Step | Command |
|---|---|
| Read a view function | `cast call <resolver> "resolve(bytes,bytes)(bytes)" <dnsName> <innerCalldata> --rpc-url $SEPOLIA_RPC_URL` |
| Same through ENS's Universal Resolver | `cast call <UR> "resolve(bytes,bytes)(bytes,address)" <dnsName> <innerCalldata>` |
| Inner calldata | `cast calldata "addr(bytes32)" $(cast namehash 39j49ll8t4.digipin.eth)` |
| Decode a result | `cast decode-abi "f()(address)" <hex>` (alias `abi-decode`) |
| Encode args / constructor args | `cast abi-encode "constructor(address)" <addr>` |
| Hash | `cast keccak <text-or-hex>`, `cast namehash <name>`, `cast sig "<fn>"` |
| Send a transaction | `cast send <to> "<sig>" <args> --rpc-url ... --private-key ...` (or `--account`); same key-handling problem as deploy |
| Balance | `cast balance <addr> --ether --rpc-url ...` |
| Wallets | `cast wallet new`, `cast wallet address --private-key ...`, `cast wallet import <name> --interactive` |

- DNS encoding: cast has **no** DNS-encode command (no such entry in `cast --help`). Build it from length bytes: `cast concat-hex 0x0a $(cast from-utf8 39j49ll8t4) 0x07 $(cast from-utf8 digipin) 0x03 $(cast from-utf8 eth) 0x00` gives `0x0a33396a34396c6c387434076469676970696e0365746800` (run 2026-11-03). Each label's length byte must be its byte count in hex.
- `cast resolve-name` / `lookup-address`: Foundry 1.8.7 uses alloy-ens 2.5.0 (`Cargo.lock` at v1.8.7). That crate does **not** read the v1 registry for forward lookups. It calls `UniversalResolver.resolve(dnsEncode(name), addr(namehash))` at the hard-coded address `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`, which "routes to wildcard (ENSIP-10) resolvers" and follows CCIP-Read. Reverse lookup calls `UR.reverse(addr, 60)` ([alloy `crates/ens/src/lib.rs` at v2.5.0](https://github.com/alloy-rs/alloy/blob/v2.5.0/crates/ens/src/lib.rs)). ENS's deployments page lists that address as the mainnet Universal Resolver and says Sepolia's Universal Resolver resolves through ENSv2 (`sources/ens-deployments.txt`).
  - On Sepolia that address has code (`cast code`, 2026-11-03).
  - `cast call 0xeEeE…EeEe "findResolver(bytes)(address,bytes32,uint256)" <dns(pata.eth)>` returned resolver `0x0`, node `0xf33ab073…e9c6`, offset 0. pata.eth is still unregistered, so `cast resolve-name pata.eth` failed with "Failed to resolve ENS name". That is expected, not a tooling fault.
  - So cast's ENS commands should work with ENSv2 and with wildcard names on Sepolia, provided the Sepolia contract at `0xeEeE…EeEe` is the ENSv2 one (inferred). Test at kick-off once `digipin.eth` resolves.

### anvil

From `anvil --help` (1.8.7):
- `anvil --fork-url $SEPOLIA_RPC_URL` forks the latest Sepolia state. Pin a block with `--fork-block-number <N>` or `<url>@<block>`.
- `-b, --block-time 12` mines a block every 12 s like Sepolia. Without it anvil mines one block per transaction (inferred from the flag), so `block.timestamp` doesn't move between transactions. An expiry rehearsal must either set `--block-time` or jump time with `cast rpc evm_increaseTime <s>` then `cast rpc evm_mine` (anvil custom methods, docs: /anvil/custom-methods). The same jump skips ENS's 60 s commit wait when rehearsing registration.
- `--compute-units-per-second` / `--no-rate-limit` throttle fork RPC reads; `--hardfork`, `--state <path>` (load and dump) keep a rehearsed state between runs.
- anvil's 10 funded dev accounts pay gas on the fork, so no test ETH is spent. Their keys are public: never reuse them on Sepolia (docs: /best-practices).
- **open:** whether publicnode serves old state (archive) for `--fork-block-number` far back; fork at latest to be safe.

## Limits

- **Sepolia is on Glamsterdam.** `cast rpc eth_config` on Sepolia (2026-11-03) reports the current fork active since `1791294816` (2026-10-06 13:53:36 UTC) with ePBS builder system contracts. That timestamp matches the Ethereum Foundation's Glamsterdam Sepolia activation ([EF blog, Glamsterdam testnet announcement](https://blog.ethereum.org/2026/09/17/glamsterdam-testnet-announcement)). Glamsterdam includes, among others:
  - EIP-7954 (bigger contracts);
  - EIP-8037 (state-creation gas increase);
  - EIP-7976 (calldata floor cost);
  - EIP-2780 (resource-based intrinsic gas);
  - EIP-7997 (deterministic factory contract).
- Contract size on Sepolia: EIP-7954 raises runtime code from 24,576 to 65,536 bytes and initcode from 49,152 to 131,072 bytes ([EIP-7954](https://eips.ethereum.org/EIPS/eip-7954)). Foundry still checks 24,576 locally by default ("By default, it is 0x6000", `forge test --help`), so the local check is the stricter one. A DIGIPIN decoder plus ENSIP-10 dispatch should be a few KiB (inferred; check with `forge build --sizes`).
- Gas: Sepolia's block gas limit is 200,000,000, base fee 15 wei, and `cast gas-price` returned 17 wei (`cast block latest -f gasLimit` and friends, 2026-11-03, block 12,051,804). At these prices deploying a small contract costs a negligible amount of test ETH (inferred). Per-transaction cap: Osaka's EIP-7825; Foundry enforces it locally only with `--enable-tx-gas-limit`. **open:** its exact value after Glamsterdam.
- Gas estimates: EIP-8037 changes state-creation gas, so contract creation costs more than pre-Glamsterdam rules say. Let forge estimate against the live RPC (the default 130% multiplier) instead of setting `--gas-limit` by hand. Foundry applies EIP-8037 only under Amsterdam rules (docs: /forge/gas-accounting), and a fork run infers the network from the chain (docs: /config/networks). **open:** whether 1.8.7 infers Amsterdam for Sepolia when simulating.
- Verification: needs the exact solc version and settings. With the default `bytecode_hash = "ipfs"`, Sourcify can make a full match; disabling metadata gives only a partial match (docs: /guides/deterministic-deployments-using-create2). Etherscan V2 needs a key from etherscan.io. **open:** whether its free tier covers Sepolia. If it doesn't, use Sourcify, which is keyless; forge falls back to it automatically when no key is set.

## Gotchas

- `.env.local` is not auto-loaded; Foundry reads only `.env` (above).
- CRLF line endings:
  - If `.env.local` was saved with Windows line endings, `source` in Git Bash keeps a trailing `\r` on each value, which breaks the key and URL (inferred; `.env.local` was not opened).
  - CRLF checkouts of `.sol` files change the source hash in the metadata, and so the bytecode. That can break verification from another machine (inferred). Add `*.sol text eol=lf` to `.gitattributes` at kick-off.
- Docs vs binary: the docs give `prague` as the `evm_version` default and say the init template ignores `broadcast/`. In 1.8.7 the default is `osaka` and the template keeps `broadcast/`. Pin config explicitly.
- `cache/` mirrors the broadcast files, including RPC URLs; never commit it.
- Script `msg.sender`: "Starting a broadcast changes the sender of outgoing calls; it does not change `msg.sender` in the script's current frame" (docs: /forge/scripting). If the resolver has an owner, pass it explicitly.
- Recovery files written by 1.8.4+ can't be resumed by older Foundry (docs: /forge/scripting). Everyone uses 1.8.7.
- Shells: `foundryup` needs Git Bash or WSL, while npm scripts run in cmd.exe. Write npm scripts with flags only (`--root`, `--profile`): no `VAR=x` prefixes, no `$VAR`. The repo path `C:\Users\ASUS\projects\pata` has no spaces.
- Submodule dependencies bring their whole repos, including JS tests and TS configs. Exclude `contracts/**` from `tsconfig.json` and from Vitest's include, or `npm run check` may type-check or run them (inferred).
- Deploy, verify and cast calls are direct RPC and Etherscan traffic, outside the Anon-RPC invariant. They are dev tooling, not app traffic; the README should say so.

## Values to copy

| Name | Value | Source |
|---|---|---|
| Foundry version | 1.8.7, commit `985eeea031d79922cd654d4e94e6c3701e1c7d73` | `forge --version`; GitHub tag `v1.8.7` |
| Docs | <https://getfoundry.sh>; full text `https://www.getfoundry.sh/llms-full.txt` | `forge --help`; curl |
| Default `evm_version` | `osaka` | `forge config` |
| Sepolia chain id | 11155111 | `cast chain-id`, 2026-11-03 |
| Sepolia fork | Glamsterdam, active since 1791294816 (2026-10-06 13:53:36 UTC) | `cast rpc eth_config`; EF blog |
| Sepolia block gas limit | 200,000,000 | `cast block latest -f gasLimit`, 2026-11-03 |
| Max runtime code: Sepolia / Foundry local default | 65,536 / 24,576 bytes | EIP-7954; `forge test --help` |
| Universal Resolver used by `cast resolve-name` | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` (has code on Sepolia) | alloy-ens 2.5.0 source; `cast code` |
| namehash `pata.eth` | `0xf33ab0736d64eb36f6dc731965f9460d320a0a0c52367beadf6087c29e08e9c6` | `cast namehash` |
| namehash `digipin.eth` | `0xdc14db607f20e71c31002d56f9c74538e6b2e482db0a340be77140c77a40c64b` | `cast namehash` |
| namehash `39j49ll8t4.digipin.eth` | `0xd82f5444d2ee0b6fc250187a28df3c34d513456c852953065784155fd3fa92a6` | `cast namehash` |
| DNS-encoded `39j49ll8t4.digipin.eth` | `0x0a33396a34396c6c387434076469676970696e0365746800` | `cast concat-hex` + `cast from-utf8` |
| `resolve(bytes,bytes)` (ENSIP-10 interface id) | `0x9061b923` | `cast sig` |
| `supportsInterface(bytes4)` | `0x01ffc9a7` | `cast sig` |
| `addr(bytes32)` | `0x3b3b57de` | `cast sig` |
| `addr(bytes32,uint256)` | `0xf1cb7e06` | `cast sig` |
| `text(bytes32,string)` | `0x59d1d43c` | `cast sig` |
| Default CREATE2 deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` | `forge config` |
| Broadcast record | `contracts/broadcast/<Script>.s.sol/11155111/run-latest.json` | docs: /forge/broadcast-files |

## Contradictions with idea.md

None found. idea.md says nothing about Foundry versions, contract size, compiler settings or deployment. Two premises outside idea.md are out of date:
- The research brief assumed a 24 KiB contract limit on Sepolia. Since Glamsterdam (2026-10-06), EIP-7954 allows 64 KiB there; Foundry still checks 24 KiB locally.
- One CLAUDE.md wording says every RPC call goes through the Anon-RPC worker. Foundry's deploy, verify and cast calls are direct by nature. The on-disk CLAUDE.md and `.env.example` ("Direct RPC for Foundry scripts") already allow this.

## Test at kick-off

- [ ] `forge --version` prints 1.8.7 from cmd.exe, PowerShell and Git Bash after a VS Code restart.
- [ ] Run `git init`, then `forge init contracts --use-parent-git --empty`. Expect one repo, forge-std as a submodule under `contracts/lib`, and `contracts/.gitignore` from the template.
- [ ] Pick and pin `solc` (the latest 0.8.x that supports `osaka`). The first `forge build` downloads it and needs the network.
- [ ] From cmd.exe, `npm run check` runs `forge test --root contracts` and exits non-zero when a test fails. Vitest and `tsc` ignore `contracts/**`.
- [ ] The DIGIPIN vector `39J-49L-L8T4` passes in Solidity, and the fuzz round-trip passes with a fixed seed. If the vectors are shared via JSON, check that `fs_permissions` accepts the path.
- [ ] Load `.env.local` without putting the key on the command line (Git Bash `source` or a Node `--env-file` wrapper), and check for CRLF.
- [ ] `forge script ... --rpc-url sepolia --broadcast --verify`:
  - the gas estimate succeeds under Glamsterdam rules;
  - Etherscan V2 accepts the key for Sepolia on the free tier; if not, use `--verifier sourcify`.
- [ ] Commit `broadcast/<Script>/11155111/` and confirm `cache/` is ignored.
- [ ] Once `digipin.eth` points at our resolver, both of these return the expected result: `cast resolve-name 39j49ll8t4.digipin.eth --rpc-url $SEPOLIA_RPC_URL` and a `cast call` of the Universal Resolver. Together they prove cast, ENSv2 and wildcard resolution work on Sepolia.
- [ ] On an anvil fork of Sepolia:
  - rehearse registration, using `evm_increaseTime` to skip the 60 s commit wait;
  - check grant expiry with `--block-time 12`.
- [ ] Check the per-transaction gas cap after Glamsterdam. It only matters for a very large transaction, and ours are small.
- [ ] Check that publicnode serves archive state if a fork must be pinned to an old block.
