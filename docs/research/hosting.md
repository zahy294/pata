# Hosting: static site on IPFS

Checked: 2026-11-03 · Version: IPFS HTTP gateway specs from `github.com/ipfs/specs` `main` (path gateway dated 2026-08-24, subdomain 2025-04-03, `_redirects` 2025-03-19, DNSLink 2022-11-09); Public Suffix List downloaded 2026-11-03; pricing pages of Pinata, Filebase and Fil One, and Cloudflare Workers limits, all read 2026-11-03; eth.limo docs (`github.com/ethlimo/documentation` `master`); live curl probes of the public gateways on 2026-11-03 · Status: test at kick-off
Feeds: idea.md Stack row "Hosting: Static build on IPFS"; ENS checklist "Showcase links to a live demo"; EF CROPS C and P lines; the CROPS video's "courier link still opening after we switch off our server"; the Frontend role's "IPFS deploy"; P0 passkey sign-in (the origin choice)

## Options compared

**The 2026 landscape changed under idea.md.** Three facts shape this note:

- **Storacha (web3.storage) is gone.** Its post of Apr 3, 2026 says "The Storacha developer upload and IPFS service, however, will be shutting down". It took no sign-ups from that day and disabled uploads on Apr 15, and on "May 31, 2026: The Storacha gateways (w3s.link) will stop serving content" ([Storacha on Medium](https://medium.com/@storacha/an-update-on-storacha-and-important-news-for-you-and-your-data-15a5d10b7da0)).
  - Checked by curl on 2026-11-03: `storacha.network`, `docs.storacha.network`, `web3.storage` and `w3s.link` all redirect to `fil.one`, and `console.storacha.network` and `up.storacha.network` don't resolve.
  - The successor, Fil One, is paid S3-compatible storage at $5.99/TB/month with a $5.99 monthly minimum after a 30-day trial ([Fil One pricing](https://www.fil.one/pricing)). It doesn't host websites.
- **Fleek's hosting is gone.** "Fleek's IPFS hosting service was discontinued on January 31st, 2026" ([IPFS docs, Fleek case study](https://docs.ipfs.tech/case-studies/fleek/); read only as a search excerpt).
- **The public HTTP gateways ipfs.io and dweb.link are retired.**
  - Browsers that open them are redirected to the service-worker gateway at `inbrowser.link`, and hotlinked or backend traffic is rate-limited ([IPFS blog, Aug 25, 2026](https://blog.ipfs.tech/2026-08-beyond-sponsored-gateways/)).
  - `gatewaychanges.ipfs.io` says "This gateway has retired and no longer serves content" (read 2026-11-03).
  - Shipyard stopped all its IPFS work on Sep 30, 2026. That ended its operation of ipfs.io, dweb.link, delegated-ipfs.dev and the bootstrap nodes, and its maintenance of the Service Worker Gateway. "Protocol Labs, as the owner of the associated domains and infrastructure, will determine their future" ([Shipyard, Aug 24, 2026](https://ipshipyard.com/blog/2026-the-end-of-ipfs-at-shipyard/)).

**Pinning services**

| Service | Free tier | Upload from a build script | Custom domain | Gateway | Unpaid data | Exists and takes sign-ups (2026-11-03) |
|---|---|---|---|---|---|---|
| **Pinata** | $0: 1 GB storage, 500 files, 10 GB bandwidth, 10K requests, 1 gateway ([pricing](https://pinata.cloud/pricing)) | Platform API, folder uploads and CAR uploads are on Free. The IPFS Pinning Services API (the spec Kubo's `ipfs pin remote` uses) and "IPFS CLI" are ticked only from Picnic ([pricing](https://pinata.cloud/pricing)). Exact upload command: test at kick-off | Not on Free: "Custom gateway domains" starts at Picnic, $20/month ([pricing](https://pinata.cloud/pricing)) | One dedicated gateway (`<name>.mypinata.cloud`); its access rules on Free: test at kick-off | Not stated on the pricing page; test at kick-off | Yes |
| **Filebase** | $0: 5 GB storage shared with object storage, 10 GB IPFS egress, 500 pinned files, 1 gateway, 1 IPNS name ([pricing](https://filebase.com/pricing/)) | S3-compatible API (any S3 client); details: test at kick-off | "Not included" on Free; Pro costs $7.50/month ([pricing](https://filebase.com/pricing/)) | One dedicated gateway | Not stated on the pricing page | Yes; the IPFS blog lists it among current providers ([IPFS blog](https://blog.ipfs.tech/2026-08-beyond-sponsored-gateways/)) |
| Storacha (formerly web3.storage) | None | None: uploads were disabled on Apr 15, 2026 | None | `w3s.link` stopped serving on May 31, 2026 | No longer served after May 31, 2026 | **No** ([Storacha](https://medium.com/@storacha/an-update-on-storacha-and-important-news-for-you-and-your-data-15a5d10b7da0)) |
| Fleek | None | None | None | None | Hosting ended on Jan 31, 2026 | **No** ([IPFS docs](https://docs.ipfs.tech/case-studies/fleek/)) |
| Lighthouse, Filecoin Pin, 4EVERLAND, Orbiter | Not checked | Not checked | Not checked | Not checked | Not checked | Lighthouse is named as a current provider on the [IPFS blog](https://blog.ipfs.tech/2026-08-beyond-sponsored-gateways/). Storacha points at Filecoin Pin ([Storacha](https://medium.com/@storacha/an-update-on-storacha-and-important-news-for-you-and-your-data-15a5d10b7da0)). The rest are unchecked |

**Gateway kinds** (from the specs)

| Kind | URL shape | Origin | `_redirects` | Service worker | Source |
|---|---|---|---|---|---|
| Path gateway | `https://gw.example/ipfs/<cid>/` | One origin shared by every CID on that gateway | Not evaluated | Only scoped to `/ipfs/<cid>/`. A scope without the trailing slash "MUST be denied" with a 400 | [path gateway spec](https://specs.ipfs.tech/http-gateways/path-gateway/#service-worker-request-header), [`_redirects` spec](https://specs.ipfs.tech/http-gateways/web-redirects-file/#same-origin-requirement) |
| Subdomain gateway | `https://<cidv1-base32>.ipfs.gw.example/` | One origin per root CID, so **every deploy is a new origin** | SHOULD be supported | Normal, at `/` | [subdomain gateway spec](https://specs.ipfs.tech/http-gateways/subdomain-gateway/) |
| DNSLink gateway | `https://pata.example/` with a TXT record at `_dnslink.pata.example` | The DNS name, stable across deploys | SHOULD be supported | Normal | [DNSLink gateway spec](https://specs.ipfs.tech/http-gateways/dnslink-gateway/) |
| IPNS on a subdomain gateway | `https://<k51…base36>.ipns.gw.example/` | The IPNS key, stable across deploys | SHOULD be supported | Normal | [subdomain gateway spec](https://specs.ipfs.tech/http-gateways/subdomain-gateway/) |
| ENS through eth.limo | `https://<name>.eth.limo/` | The ENS name, stable across deploys | Not checked | Not checked | [eth.limo docs](https://github.com/ethlimo/documentation) |

**What the public gateways did on 2026-11-03.** Probed by curl with a browser user agent, using the spec's test CID `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi`:

| URL | Result |
|---|---|
| `https://dweb.link/ipfs/<cid>/` and `https://ipfs.io/ipfs/<cid>/` | 403, a Cloudflare challenge page |
| `https://<cid>.ipfs.dweb.link/` | 429 Too Many Requests, `Retry-After: 900` |
| `https://<cid>.ipfs.inbrowser.link/` | 200: the service-worker gateway's shell page |
| `https://trustless-gateway.link/ipfs/<cid>?format=raw` | 526 (Cloudflare: invalid origin certificate) |

A script isn't a browser, so a real phone may pass the challenge and land on inbrowser.link. Either way, **no public HTTP gateway can be the demo link** (inferred).

**Stable addresses** (each one avoids the new origin a new CID brings)

| Option | Stable origin | Works for Pata? | Source |
|---|---|---|---|
| ENS `contenthash` + eth.limo | `<name>.eth.limo` | **Not with a Sepolia name.** eth.limo resolves on Ethereum mainnet, Base and Gnosis only: "names on other chains or testnets won't resolve" (troubleshooting page), and "Names registered or managed exclusively on other networks (including testnets) will not resolve through the gateway" (gateway basics page). It would need a **mainnet** `.eth` name, which costs money. A self-run eth.limo gateway can point at Sepolia (`ETH_CHAIN_ID=11155111`), but that isn't a public link | [troubleshooting](https://github.com/ethlimo/documentation/blob/master/troubleshooting.md), [gateway basics](https://github.com/ethlimo/documentation/blob/master/introduction/what-is-eth.limo/gateway-basics/README.md), [local gateway](https://github.com/ethlimo/documentation/blob/master/local-gateway/running-a-local-gateway.md) |
| DNSLink on our own domain | `pata.<domain>` | Needs a domain (a cost) and a gateway that serves DNSLink with TLS. dweb.link's DNSLink form (`<inlined-domain>.ipns.dweb.link`) is retired with the rest of dweb.link. Pinata's custom domain is paid | [DNSLink gateway spec](https://specs.ipfs.tech/http-gateways/dnslink-gateway/), [Pinata pricing](https://pinata.cloud/pricing) |
| IPNS | `<k51…>.ipns.<gateway>` | Filebase's free tier includes 1 IPNS name. It still needs a working subdomain gateway, and the public one is retired | [Filebase pricing](https://filebase.com/pricing/) |
| A conventional static host | e.g. `pata.pages.dev` | Stable, free, and HTTPS; `pages.dev` is on the PSL, so each project is its own site. Not IPFS, and its free limits weren't checked | [PSL](https://publicsuffix.org/list/public_suffix_list.dat) |

## Install and setup

Not settled; the exact commands are a kick-off test. What is known:
- **Pinata:** create an API key (JWT) in the dashboard. Upload the `out/` folder as a folder or a CAR file through the Platform API; folder uploads and CAR uploads are on the Free plan ([pricing](https://pinata.cloud/pricing)).
- **Filebase:** create a bucket for IPFS and upload with any S3 client, using the access key and secret from its dashboard (inferred from "S3-compatible"; check the docs at kick-off).
- **Our CID:** compute the CID locally from a CAR file before uploading, so it can be checked against every pin (inferred: CIDs are content-derived, so every provider must return the same one).
- **Keys:** add `PINATA_JWT` (and `FILEBASE_KEY` / `FILEBASE_SECRET` if used) to `.env.example` at kick-off. Values go only in `.env.local`.

## What Pata uses

**Recommendation** (for a human to decide; a hard-to-reverse choice, so it needs an ADR at kick-off):

1. **The demo link is a stable HTTPS origin outside the IPFS gateways,** on the same free platform as the small server (Cloudflare Workers or Pages, for example `pata.pages.dev` or `pata.<account>.workers.dev`). Why:
   - The public IPFS gateways are retired (above).
   - eth.limo won't serve a Sepolia name.
   - A subdomain-gateway URL changes with every deploy. That orphans the household's passkey (its RP ID is the host) and anything in IndexedDB or localStorage (inferred from origin-per-CID in the [subdomain gateway spec](https://specs.ipfs.tech/http-gateways/subdomain-gateway/)).
   - Courier links carry the host, so it must not change after Sana shares one.
2. **The same build is also pinned to IPFS, keeping the CROPS claim:**
   - Pin it on Pinata Free, with Filebase Free as a second pin.
   - Print the CID in the README, so anyone can load it through their own IPFS node, inbrowser.link, or a mainnet `.eth` name on eth.limo if the team owns one.
   - The CROPS video's "server off" moment switches off the small server (Claude key and gas relay). The courier link keeps opening, because the static app and both chains don't need it.
3. **Fallback:** if Cloudflare's free static hosting fails at kick-off, use Vercel or GitHub Pages (`github.io`, also on the PSL) for the same build, keeping the IPFS pins.

**The small server** (Claude API key, gas relay; maybe the Arkiv access key, which Arkiv's docs say to keep server-side, see `arkiv.md`):

| Option | Free limits | Fit |
|---|---|---|
| **Cloudflare Workers (Free)** | 100,000 requests/day; **10 ms CPU** per invocation; incoming HTTP wall-clock "Unlimited"; 50 subrequests per request; 128 MB memory ([limits](https://developers.cloudflare.com/workers/platform/limits/)) | Recommended. Waiting on Claude's reply is wall time, not CPU (inferred from the CPU vs duration split). Signing one secp256k1 top-up within 10 ms of CPU must be tested |
| Vercel Hobby functions | Not read: the limits page gave no Hobby numbers to the scraper | Fallback; check the duration limit and Hobby's non-commercial terms at kick-off |
| Deno Deploy free | Not checked | Second fallback |

## Limits

- **Pinata Free:** 1 GB, **500 files**, 10 GB bandwidth, 10K requests ([pricing](https://pinata.cloud/pricing)). A Next.js export can hold hundreds of files. Whether one folder upload counts as one "file" or one per file is a kick-off test.
- **Filebase Free:** 5 GB, 500 pinned files, 10 GB IPFS egress, 1 gateway, 1 IPNS name, no custom domain ([pricing](https://filebase.com/pricing/)).
- **Subdomain labels:** CIDs must be CIDv1 in base32 (IPNS keys in base36) to fit one 63-character DNS label ([subdomain gateway spec](https://specs.ipfs.tech/http-gateways/subdomain-gateway/#dns-label-limits)).
- **`_redirects`:** at most 64 KiB. Rules apply in order, only to paths missing from the DAG, and only on subdomain or DNSLink gateways ([`_redirects` spec](https://specs.ipfs.tech/http-gateways/web-redirects-file/)).
- **Range requests:** "Gateways SHOULD support single range requests"; multi-range is optional ([path gateway spec](https://specs.ipfs.tech/http-gateways/path-gateway/#range-request-header)). PMTiles needs single ranges (inferred). Whether Pinata's or Filebase's gateway honours them is untested.
- **Cloudflare Workers Free:** 10 ms CPU per invocation ([limits](https://developers.cloudflare.com/workers/platform/limits/)).

## Gotchas

- **No custom response headers from IPFS gateways.** The `_headers` file (COOP, COEP, CSP) is still "TBD" in the open spec issue [ipfs/specs#257](https://github.com/ipfs/specs/issues/257). A CSP can go in a `<meta http-equiv>` tag; COOP and COEP can't (inferred). A conventional static host such as Cloudflare Pages has a `_headers` file (named as prior art in that issue).
- **Passkeys are bound to the host.** A household that opens the same CID on another gateway or domain doesn't reach its passkey, its PRF-derived keys or its device-stored key (inferred from WebAuthn's RP ID rule; the passkeys note owns the details). So "runs from any IPFS gateway" holds for courier links, whose keys travel in the `#` part, but not for a household's own sign-in.
- **`*.eth.limo` is a wildcard PSL entry** ([PSL](https://publicsuffix.org/list/public_suffix_list.dat), copy in `sources/hosting-public_suffix_list.dat`). That makes `pata.eth.limo` itself a public suffix. Whether browsers allow WebAuthn there is unverified. Also on the PSL: `*.dweb.link`, `*.inbrowser.link`, `ipfs.w3s.link`, `on-fleek.app`, `pages.dev`, `workers.dev`, `vercel.app`, `github.io`. `mypinata.cloud` is not on it.
- **inbrowser.link runs its own service worker at the site's origin.** Whether a PWA with its own service worker works under it is untested (inferred risk).
- **Immutable caching:** gateways MUST send `Cache-Control: public, max-age=29030400, immutable` for `/ipfs/` content ([path gateway spec](https://specs.ipfs.tech/http-gateways/path-gateway/#cache-control-response-header)). A redeploy is a new CID, never an overwrite.
- **Directory URLs:** gateways 301 a directory requested without its trailing `/`, and serve its `index.html` ([path gateway spec](https://specs.ipfs.tech/http-gateways/path-gateway/#use-in-directory-url-normalization)). A static export with one `index.html` per route fits this (inferred; the static-export side belongs to the Next.js note).
- **Path gateways break absolute asset paths.** On `gw/ipfs/<cid>/`, `/_next/...` resolves against the gateway root (inferred). That's one more reason not to rely on a path gateway.

## Values to copy

| Name | Value | Source |
|---|---|---|
| SPA fallback rule | `/* /index.html 200` (subdomain or DNSLink gateways only) | [`_redirects` spec](https://specs.ipfs.tech/http-gateways/web-redirects-file/) |
| DNSLink record | TXT `_dnslink.<domain>` = `dnslink=/ipfs/<cid>` | [DNSLink gateway spec](https://specs.ipfs.tech/http-gateways/dnslink-gateway/) |
| eth.limo networks | Ethereum mainnet, Base, Gnosis; no testnets | [eth.limo troubleshooting](https://github.com/ethlimo/documentation/blob/master/troubleshooting.md) |
| Local eth.limo on Sepolia | `ETH_CHAIN_ID=11155111` plus a Sepolia `ETH_RPC_ENDPOINT` | [running a local gateway](https://github.com/ethlimo/documentation/blob/master/local-gateway/running-a-local-gateway.md) |
| Pinata Free | 1 GB / 500 files / 10 GB bandwidth / 10K requests | [pricing](https://pinata.cloud/pricing) |
| Filebase Free | 5 GB / 500 pinned files / 10 GB egress / 1 IPNS name | [pricing](https://filebase.com/pricing/) |
| Workers Free | 100,000 requests/day, 10 ms CPU, 128 MB | [limits](https://developers.cloudflare.com/workers/platform/limits/) |

## Contradictions with idea.md

1. idea.md's Stack row: "Hosting | Static build on IPFS | Keeps working if our server goes away"; its ENS checklist: "Showcase links to a live demo | IPFS-hosted app".
   - **Contradicted by:** the public gateways are retired ([gatewaychanges.ipfs.io](https://gatewaychanges.ipfs.io/), [IPFS blog](https://blog.ipfs.tech/2026-08-beyond-sponsored-gateways/)). eth.limo doesn't resolve testnet names ([eth.limo troubleshooting](https://github.com/ethlimo/documentation/blob/master/troubleshooting.md)). The two biggest free hosts, Storacha and Fleek, shut down in 2026.
   - **Result:** an IPFS-only live link needs either a paid custom domain or a mainnet `.eth` name.
2. idea.md's CROPS C line: "The app runs from the repo or any IPFS gateway".
   - **Contradicted by:** there is no longer a public "any gateway" (same sources).
   - **Also (inferred):** a household's passkey and stored keys are tied to the host it signed up on.
   - **Safer wording:** "anyone can run the app from the repo or the published CID on their own IPFS node; courier links work from any copy".
3. idea.md's Frontend role: "IPFS deploy" assumes one IPFS host. The recommendation above makes it two targets: a stable static host plus an IPFS pin.

## Test at kick-off

- [ ] On a phone browser: open a CID on `dweb.link` and on `inbrowser.link`. Does the Pata build load, and does its own service worker register?
- [ ] Pinata Free: upload the `out/` folder or a CAR file. Does a folder count as 1 file or many against the 500-file cap? Does the free `*.mypinata.cloud` gateway serve HTML and JS, honour `Range`, and stay within 10K requests?
- [ ] Filebase Free: the same upload test, its gateway's behaviour, and whether the free IPNS name publishes.
- [ ] Cloudflare free static hosting (Pages, or Workers static assets): its limits, `_headers` (CSP), and the SPA fallback.
- [ ] Does WebAuthn with PRF work on the chosen host? If a mainnet name is ever used, does it work on `<name>.eth.limo`, which is itself a public suffix?
- [ ] Workers Free: does a viem `signTransaction` for one top-up fit in 10 ms of CPU? Does a long Claude call finish?
- [ ] Vercel Hobby: function duration limit and terms, as the fallback for the server.
- [ ] Decide whether a mainnet `.eth` name for eth.limo is worth its cost. Check the ENS price for a 5+ character name; mainnet is out of scope for the protocol.
- [ ] Check Lighthouse, Filecoin Pin, 4EVERLAND and Orbiter only if both Pinata and Filebase fail.
