# Setting up Pata

This is how to get a machine, the accounts and the keys ready to build Pata, and how the repo is started at kick-off. Read [idea.md](idea.md) for what we're building, then [docs/plan.md](docs/plan.md) and [docs/tickets.md](docs/tickets.md) for how.

**One rule first:** we're on ETHGlobal's Classic track, so no app code, contracts, tests or designed assets may exist before hacking starts (**Thu Nov 5, 9:00 PM IST**). Before then, you can install tools, create accounts, get keys and test funds, and read. Everything in steps 1–4 is allowed now. Step 5 happens at kick-off: the project owner pushes the repo at or after 9:00 PM, and you clone it from GitHub.

## 1. Install the tools

Versions are the ones the research checked on 2026-11-03. Use these exact versions unless a ticket says otherwise.

| Tool | Version | How | Check |
|---|---|---|---|
| Node.js | 22 LTS (Next.js 16 needs at least 20.9) | [nodejs.org](https://nodejs.org/) | `node -v` |
| npm | 10, comes with Node | | `npm -v` |
| Git | any recent | [git-scm.com](https://git-scm.com/). On Windows this also gives you Git Bash, which Foundry's installer needs | `git --version` |
| Foundry (forge, cast, anvil) | 1.8.7 | In Git Bash, WSL, macOS or Linux (not PowerShell or cmd): `curl -L https://foundry.paradigm.xyz \| bash`, open a new terminal, then `foundryup --install v1.8.7`. On Windows, add `%USERPROFILE%\.foundry\bin` to your PATH and restart your editor | `forge --version` prints 1.8.7 |
| Playwright browsers | with `@playwright/test` 1.64.1 | After the repo exists: `npx playwright install chromium webkit` (no `--with-deps` on Windows) | `npx playwright --version` |
| pmtiles CLI | latest | The `pmtiles` binary for your OS from [go-pmtiles releases](https://github.com/protomaps/go-pmtiles/releases). Only the person building the map extract needs it | `pmtiles version` |
| Wrangler (Cloudflare CLI) | latest | A dev dependency of the server, installed at kick-off. Only whoever deploys needs to log in: `npx wrangler login` | `npx wrangler --version` |
| GitHub CLI | optional | [cli.github.com](https://cli.github.com/) | `gh auth status` |

Python isn't needed.

## 2. Accounts

| Account | Who | Why | Cost |
|---|---|---|---|
| GitHub | everyone | The repo; send your username to the project owner | free |
| ETHGlobal | everyone | Each team member is accepted and stakes separately ([research.md](research.md)). The ETHGlobal faucet gives 0.1 Sepolia ETH a day to your profile's primary wallet | free; stake refunded after you submit |
| Arkiv Hub ([hub.arkiv.network](https://hub.arkiv.network/)) | everyone who touches Arkiv | Your own access key, and test GLM from its faucet (needs a wallet sign-in) | free |
| Cloudflare | project owner | Pages hosts the app; Workers runs the small server | free tier |
| Anthropic Console | project owner | The address AI. Set a low spend limit; request zero data retention | paid credits, or the free starting credits |
| Sarvam ([sarvam.ai](https://www.sarvam.ai/)) | project owner | Speech in and out. Set content retention as low as it goes, and give no training consent | ₹100 free credits cover the event |
| Pinata | project owner | Pins the build on IPFS. Filebase is an optional second pin | free tier |
| Etherscan | optional | Verifying the contract; Sourcify works without a key | free |

## 3. Keys and wallets

**Never paste a private key, seed phrase or API key into a chat, an issue, a commit or an AI tool.** Keys go only in `.env.local` (git ignores it) or in Cloudflare's secret store.

| Name (in `.env.example`) | Who provides it | Where it lives |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | project owner only | owner's `.env.local` |
| `RELAY_PRIVATE_KEY` | project owner only | Worker secret (`npx wrangler secret put RELAY_PRIVATE_KEY`); owner's `.env.local` |
| `ANTHROPIC_API_KEY`, `SARVAM_API_KEY` | project owner | Worker secrets. Developers who run the server locally ask the owner for a key over a private channel, or use their own free credits |
| `ARKIV_ACCESS_KEY` | each developer gets their own | your `.env.local`. It isn't secret: it ships in the app, locked to your Origins |
| `PINATA_JWT` | project owner | owner's `.env.local`, for deploys |
| `SEPOLIA_RPC_URL`, `ARKIV_RPC_URL` | already filled in | `.env.example` |
| `ETHERSCAN_API_KEY` | optional | owner's `.env.local` |

Steps for each developer:
1. Once the repo exists: copy `.env.example` to `.env.local`.
2. Make your own **development wallet**, never your personal one: `cast wallet new`. It prints an address and a private key. Keep the key in a password manager; the app's own household keys come from the app, so this wallet only funds your testing.
3. Fund it:
   - Sepolia ETH: the ETHGlobal faucet (0.1 a day) or any Sepolia faucet;
   - test GLM on Arkiv's Rabdi testnet: the Arkiv Hub faucet.
4. Get your Arkiv access key at [hub.arkiv.network/access-keys](https://hub.arkiv.network/access-keys). Add `http://localhost:3000` to its Origins (and the deploy host later). Put it in `.env.local` as `ARKIV_ACCESS_KEY`.
5. Optional: add the two networks to your wallet app so you can see balances.
   - Sepolia: chain 11155111, RPC `https://ethereum-sepolia-rpc.publicnode.com`.
   - Rabdi: chain 7794095, RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`, explorer `https://rabdi.explorer.arkiv.network`, currency GLM.

## 4. Phones

Passkeys are tied to the hostname they're made on, and phones need HTTPS for passkeys and the microphone. So phone testing happens on a deployed preview (Cloudflare Pages), not on `localhost`, and the demo household is made on the final host.

| Role | Device | Setup |
|---|---|---|
| Sana (household) | OnePlus 11, Chrome | Current Chrome; signed in to Google with Google Password Manager on, so passkeys can return the PRF output that derives the household keys |
| Courier | a second Android | Any browser. Set it to 4G only for the hour-0 load test |
| iPhone, if you test one | iOS 18 or later, Safari | Passkeys in iCloud Keychain. Windows Hello passkeys don't support PRF |

To debug a phone from a laptop, use Chrome's `chrome://inspect` over USB with USB debugging on.

## 5. Starting the repo (at kick-off, once, by the project owner)

**For everyone else:** once the owner says the repo is up, accept the GitHub invite, then run:
1. `git clone <repo URL>`, then `cd pata`;
2. `npm install`;
3. copy `.env.example` to `.env.local` and fill in your values (step 3);
4. `npm run check` should pass.

Then pick a ticket.

**Folder layout:**

```
pata/
├── idea.md, research.md, GLOSSARY.md, SETUP.md, CLAUDE.md   planning and project rules
├── README.md            the submission README (hours 28–34): DHRUVA mapping, CROPS, AI use
├── .env.example, .gitignore, .claude/
├── docs/
│   ├── plan.md, tickets.md
│   ├── adr/             decisions, numbered
│   ├── plans/           one short plan per ticket: <ticket id>.md
│   └── research/        technical notes and their sources
├── arkiv/               the five files Arkiv's judges read: schema, friction, reach, why-arkiv, how-you-use-arkiv
├── src/
│   ├── app/             Next.js pages: the household app, and /c for the courier view
│   └── lib/             one folder per module in docs/plan.md: digipin, keys, seal, rpc, ens, arkiv, link, map
├── server/              the Cloudflare Worker: register, topup, address, speech routes
├── contracts/           Foundry: DigipinResolver
├── e2e/                 Playwright tests
└── public/              the map extract, fonts, icons
```

**The owner's steps, in commit order:**
1. **Repo, at or after 9:00 PM:** create the GitHub repo, `git init`, commit the planning files as the first commit (everything in the top row and `docs/`), push, and invite the team.
2. **App:** `npx create-next-app@16.4.4 --typescript --app --src-dir --no-agents-md`. It may refuse a folder that already has other files, so run it in an empty sibling folder and move its files into the repo. Then:
   - in `next.config`, set `output: 'export'`, `trailingSlash: true`, `experimental.agentFeedback: false`;
   - run `npx next telemetry disable`.
3. **Pinned packages:**
   - `npm i viem@2.57.14 @arkiv-network/sdk@1.0.0 @anon-rpc/browser-harness@0.4.0 maplibre-gl@6.16.0 pmtiles@4.5.0 @protomaps/basemaps@5.7.2 serwist@9.5.13`
   - `npm i -D @playwright/test@1.64.1 @serwist/cli`
   - Server: `@anthropic-ai/sdk@1.3.0`, `sarvamai`, `wrangler`.
   - Pin exact versions in `package.json` (no `^`). Arkiv's SDK changed its API at 1.0.0, and older examples, including AI-written code, use the old one.
4. **Contracts:**
   - `forge init contracts --use-parent-git --empty`;
   - `forge install ensdomains/contracts-v2` at commit `07e55a05`, the one the Sepolia deployment was built from;
   - remapping `@ensdomains/contracts-v2/=lib/contracts-v2/contracts/src/`;
   - in `contracts/foundry.toml`, set `evm_version = "osaka"`.
   - Foundry reads `.env`, not `.env.local`, so deploy scripts load the key explicitly.
5. **Scripts:**
   - `npm run check`: typecheck, unit tests and `forge test --root contracts`. It's the gate before every commit.
   - `npm run e2e`: Playwright, run separately.
   - Write npm scripts with flags only, no `VAR=x` prefixes, so they work in Windows' cmd.
6. **.gitignore** also needs: `.dev.vars` (Wrangler's local secrets), `out/`, `contracts/cache/`, `contracts/out/`, alongside the existing `.env`, `.env*.local` and `handoff.md` lines.
7. **The empty folders** from the layout (`arkiv/`, `server/`, `e2e/`, `docs/plans/`) each get a one-line README so git keeps them. Commit after each step, named `P0-1: …`, then push.

## 6. How we work

- **Tickets:** pick one from [docs/tickets.md](docs/tickets.md). P1 starts only when every P0 ticket is done, and P2 only after P1.
- **Plans:** before coding a ticket, write its short plan in `docs/plans/<ticket id>.md`. ETHGlobal wants planning files in the repo.
- **Commits:** small, named with the ticket id, for example `P0-4: digipin encode and decode`. Commit history is judged, so no giant end-of-event commits.
- **Before committing:** run `npm run check`.
- **Words:** use the terms in [GLOSSARY.md](GLOSSARY.md) for names in code (household, grant, payload, requester, courier link).
- **Privacy rules:** they're the product. Read "Invariants" below before touching data, RPC or the server.
- **Arkiv friction:** anything confusing about Arkiv goes in `arkiv/friction.md` as one line, as it happens. It's 25% of Arkiv's judging.
- **AI tools:** allowed. The README's AI-use section says which files and parts AI wrote; tell the owner when you use it.
- **Research first:** before writing code against ENS, Arkiv, Anon-RPC, DIGIPIN, maps or speech, read the matching note in [docs/research/](docs/research/README.md).

## Invariants

Each one is a judging claim, so breaking one is a bug.

- **Encrypted at rest:** exact address data (DIGIPIN, written address, directions, room number) is stored only encrypted, to the household key or to one grant's session key. Chains, Arkiv, logs and our server hold only ciphertext.
- **Opaque grant labels:** the requester and purpose live inside the encrypted payload.
- **What third parties hear:** the model and the speech provider receive only the spoken way to the door and the directions written from it. Map search receives only landmark names and the locality. The typed room number leaves the device only inside encrypted records.
- **RPC through Anon-RPC:** all RPC goes through the one Anon-RPC module, for reads from P0 and writes from P1. The exceptions are:
  - the harness's bootstrap;
  - writes before P1;
  - Foundry deploy scripts;
  - our server's own transactions (relay top-ups, `register`);
  - the retry of a stalled write, which re-sends the same signed bytes after a receipt check.
- **Grant liveness:** a grant is live only if the registry says so. An expired grant still resolves through the household's resolver (ADR 0002).
- **No logging of sensitive data:** viem errors never reach our server or its logs, because they carry request bodies and the Arkiv key. The server's address and speech routes never log or store request bodies.
- **Plain, tested code:** DIGIPIN encoding, expiry times and pin distances. The model only proposes.
- **Secrets:** they live in `.env.local` or Worker secrets; code reads only the names in `.env.example`.
- **No hard-coded demo data:** households, grants and payloads are created through the app.
