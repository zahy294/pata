# Chain ops + pitch (project owner): steps and prompts

You hold the only copies of the deployer and relay keys, the Anthropic, Sarvam, Cloudflare and Pinata accounts, and the demo phones. You unblock the others early (parent names, the Worker, the Pages host), then own the story: README, `/arkiv/` prose, video, submission.

Never let an agent read `.env.local`. The scripts in `scripts/` read it themselves and print only status or addresses; run them yourself.

---

## Part A: manual setup (you, not an agent)

Do these in order. Costs: all free tiers; the Anthropic key is the only paid item (or its free starting credits).

1. **Restart VS Code** so new terminals find `forge`. Check: `forge --version` prints 1.8.7.
2. **Rotate the deployer and relay keys** (the old ones leaked into an AI conversation on Nov 2–3):
   `node scripts/rotate-keys.mjs`
   It refuses if either old wallet holds funds, copies the old keys to a dated `.env.rotated-*.local` (git ignores it), writes new keys into `.env.local`, and prints only the old and new addresses. Update the addresses in your notes.
3. **Fund the new wallets.** From your own wallet: Sepolia ETH to the deployer and the relay (about 0.05 each to start), tGLM to the relay (Arkiv Hub faucet, 20 tGLM a claim). If Trust Wallet's send fails again, use MetaMask in the browser. Check: `node scripts/balances.mjs`.
4. **Claim the ETHGlobal faucet** (0.1 Sepolia ETH a day) to your profile wallet, and keep forwarding.
5. **Check the parent names are still free:** `node scripts/check-names.mjs`. If `pata` or `digipin` is taken, use the fallbacks and change `PROVIDER_NAME`/`GRID_NAME` in `shared/constants.ts`.
6. **Accounts** (free tiers):
   - Anthropic Console: create a key, set a low monthly spend limit, request zero data retention. Put it in `.env.local` as `ANTHROPIC_API_KEY`.
   - Sarvam: create a key; set content retention as low as it goes; no training consent. `.env.local` as `SARVAM_API_KEY`.
   - Cloudflare: sign up; you'll use Pages (the app) and Workers (the server).
   - Pinata: sign up; create a JWT later for the IPFS pin.
7. **Your `.env.local`:** fill `NEXT_PUBLIC_ARKIV_ACCESS_KEY` with the same value as `ARKIV_ACCESS_KEY`. Check everything: `node scripts/check-env.mjs` (prints only set/missing).
8. **Invite the team:** GitHub → zahy294/pata → Settings → Collaborators → add the three usernames. Tell them to start with `docs/team/README.md`.
9. **Phones:** note the second Android's model (Settings → About phone) in `docs/plans/P0-3.md`.
10. **Test addresses:** start collecting the 20 test addresses with consent (or the OSM fallback set in idea.md → Data). Keep real people's pins out of git (`scripts/data/` is ignored).

---

## Part B: Codex (or Claude Code) prompts

### Prompt 1: register the parent names (P0-2)

```
Read AGENTS.md, docs/team/chain-ops-and-pitch.md, docs/research/ens-v2.md §1 and §2 (all of it), docs/adr/0003-grant-registry-stays-unemancipated.md, src/lib/ens/roles.ts and shared/constants.ts.
Ticket: P0-2. Write docs/plans/P0-2.md first and commit it.
Write scripts/register-parent-names.mjs (viem, Node). It reads DEPLOYER_PRIVATE_KEY and RELAY_PRIVATE_KEY through scripts/env-file.mjs and NEVER prints a key. Steps, each printed with its tx hash, each skipped if already done (idempotent), with a --dry-run flag that only simulates:
1. Deploy pata.eth's UserRegistry proxy via VerifiableFactory.deployProxy(UserRegistryImpl, salt, initialize(grants)) where grants give the RELAY address only PATA_REGISTRY_OPERATOR_ROLES (registrar + renew and their admins). No dangerous role to anyone, so it's emancipated. Print the proxy address.
2. MockUSDC.mint to the deployer enough for both names; approve the ETHRegistrar.
3. For "pata" (5 years, subregistry = the new proxy) and "digipin" (2 years, no subregistry, no resolver yet): isAvailable, getRegisterPrice, makeCommitment with a random secret, commit, wait MIN_COMMITMENT_AGE + 5 s (read it on-chain), register. Owner = deployer.
4. Print pataRegistry.isEmancipated() (must be true) and getStatus for both names.
Do NOT revoke ROLE_SET_SUBREGISTRY on pata in the ETHRegistry in this script. That step is irreversible: write it as a separate scripts/lock-pata.mjs to run only after the first household registers successfully (hour ~10).
I (the owner) will run the script myself; you must not run it or read .env.local.
Done when the script exists, passes --dry-run when I run it, and the plan lists every address it will print.
```

After you run it: put the registry proxy address in `server/wrangler.jsonc` (`PATA_REGISTRY_ADDRESS`), in `.env.example`'s comment if useful, and post `NEXT_PUBLIC_PATA_REGISTRY=<address>` in the team chat. Commit `P0-2: pata.eth and digipin.eth registered` with the tx hashes in `docs/plans/P0-2.md`.

### Prompt 2: the Worker's base (P0-6)

```
Read AGENTS.md, docs/team/chain-ops-and-pitch.md, docs/research/hosting.md (Cloudflare Workers limits), docs/research/ens-v2.md §3, shared/api.ts, and every file in server/src.
Ticket: P0-6. Write docs/plans/P0-6.md first and commit it. Use the tdd skill for the guard.
1. server/src/guard.ts as its header says: kill switch, CORS (ALLOWED_ORIGINS, answer OPTIONS preflights), per-IP limit in KV (30/min), the household signature (viem verifyMessage over signedMessage(route, timestamp, sha256 hex of the raw body), timestamps within 120 s), and chargeSpend (KV counter per UTC date vs DAILY_SPEND_CAP_CENTS). Tests with a fake KV and a fixed key.
2. server/src/chain/relay.ts + routes topup and register: viem clients from env RPC URLs; topUp sends a fixed amount if the balance is below target (targets in the plan, from the hour-0 gas row), one per household per chain per 10 minutes; registerHouseholdName calls register(label, owner, grantRegistry, resolver, HOUSEHOLD_NAME_ROLES, FOREVER_EXPIRY) on PATA_REGISTRY_ADDRESS after checking isValidHouseholdLabel-equivalent HOUSEHOLD_LABEL_PATTERN and getStatus. Never return or log a viem error.
3. src/lib/server-client: a signedPost helper all calls share, plus topup and registerName.
Done when npm run check passes and the Worker runs locally (npm run server:dev with server/.dev.vars).
```

Then deploy it yourself:

```
npx wrangler login
cd server
npx wrangler kv namespace create PATA_KV      # paste the id into wrangler.jsonc
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put SARVAM_API_KEY
npx wrangler secret put RELAY_PRIVATE_KEY
npx wrangler secret put ARKIV_ACCESS_KEY
npx wrangler deploy
```

Post the Worker URL as `NEXT_PUBLIC_SERVER_URL=...` in the team chat. Check Workers Logs are off for the Worker in the dashboard.

### Step 3: the stable host (Cloudflare Pages), as early as possible

Phones need HTTPS for the microphone and passkeys, so everyone tests on the deployed preview. In the Cloudflare dashboard: Workers & Pages → Create → Pages → connect GitHub `zahy294/pata`. Build command `npm run build`, output directory `out`, environment variables: `NODE_VERSION=22` and every `NEXT_PUBLIC_*` from `.env.example` with real values. Every push to `main` redeploys. Add the `*.pages.dev` host to `ALLOWED_ORIGINS` in `wrangler.jsonc` and to the Arkiv access key's Origins. The demo household is made on this final host (passkeys bind to it).

### Prompt 3: README base (P0-14)

```
Read AGENTS.md, idea.md, research.md (Judging, Tracks, AI rules), docs/adr/0005-expiry-is-a-public-switch-not-encryption.md and docs/research/arkiv.md ("Track requirements").
Ticket: P0-14. Write docs/plans/P0-14.md first.
Write README.md: what Pata is (3 lines), the live demo link, how it works (DHRUVA roles mapped to ENSv2 as in idea.md), a CROPS section (the honest-enforcement wording from ADR 0005: only a grant holder can read the exact door; expiry stops future access; it can't make anyone unsee), what's real vs mocked (a table), the Anon-RPC coverage and its exceptions, the Arkiv writing addresses and one judge-runnable arkiv_query curl (placeholders until the demo household exists), and an "AI use" section listing which files or parts were written by Codex or Claude Code (from the commit trailers: git log --grep "AI:").
Keep it scannable. No claims the code doesn't back.
```

### Prompt 4: hours 28–34

```
Read AGENTS.md, docs/research/hosting.md (Pinata) and docs/adr/0001-stable-host-plus-ipfs-pin.md.
1. Pin out/ on IPFS with Pinata (PINATA_JWT from .env.local, read by a script, never printed); record the CID in the README with the subdomain gateway URL.
2. Finish arkiv/reach.md, why-arkiv.md, how-you-use-arkiv.md and the README's addresses and query from the demo household.
3. The CROPS proof: the courier link still opens with the Worker's KILL_SWITCH on (set it, record, set it back).
```

Video (you, by hand): 2:45–3:00, narrated by a person (AI voiceover is banned), at most 4 bullets a slide. The three moments: Marathi in, Hindi out; the key that dies on stage; a trillion names. Submit before **Sat 09:00**.

### After the first household works (hour ~10)

Run `scripts/lock-pata.mjs` (from Prompt 1) to revoke `ROLE_SET_SUBREGISTRY` on `pata` in the ETHRegistry. Irreversible: only after `isEmancipated()` is true and a household registered through `/register`.
