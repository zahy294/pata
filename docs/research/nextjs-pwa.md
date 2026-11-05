# Next.js PWA

Checked: 2026-11-03 · Version: `next` 16.4.4, `engines.node >=20.9.0` (`npm view next`, read 2026-11-03); Serwist 9.5.13 (`npm view serwist`). Docs read at the Next.js repo's `v16.4.4` tag; copies are in `docs/research/sources/nextjs-pwa-docs-v16.4.4/` · Status: test at kick-off
Feeds: idea.md Stack rows "App", "Hosting" and "Offline demo kit"; the Encryption row (the courier page strips `#`); the EF CROPS checklist (C: "The app runs from the repo or any IPFS gateway"; P: "The app's host sees that someone opened Pata, not which grant"; no trackers); P0 courier view and passkey sign-in.

Context7 has Next.js only up to v16.2.9 (`/vercel/next.js`), but 16.3.0 shipped 2026-08-03 and 16.4.0 on 2026-10-06 (`npm view next time`). So this note reads the docs at the release tag instead: `https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/<path>`, written below as `docs@v16.4.4/<path>`. Those links are the sources; each was read on 2026-11-03.

## Install and setup

- `next` 16.4.4 is npm's `latest` (published 2026-11-02). It needs Node `>=20.9.0` (this machine has 22.19), and its peer `react`/`react-dom` range is `^18.2.0 || ^19.0.0`.
- Next 16's floor (the minimum versions it supports): Node 20.9, TypeScript 5.1, and browsers Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+ ([docs@v16.4.4/02-guides/upgrading/version-16.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/upgrading/version-16.mdx)).
- Turbopack is the default bundler for both `next dev` and `next build`. To use webpack instead, pass `--webpack` ([docs@v16.4.4/03-api-reference/08-turbopack.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/08-turbopack.mdx)).
- The installed package carries docs matched to its version in `node_modules/next/dist/docs/` ([agentRules.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/agentRules.mdx)). At kick-off, read those rather than the web or Context7.
- Proposed `next.config.ts` keys (from the sections below):
  - `output: 'export'`, `trailingSlash: true` and `images: { unoptimized: true }`;
  - `experimental: { agentFeedback: false }`;
  - telemetry off with `next telemetry --disable`.

## What Pata uses

### Flow: install to the home screen (manifest, icons)

- **Manifest:** use `app/manifest.ts`, whose default export returns `MetadataRoute.Manifest`, or a static `app/manifest.json` / `.webmanifest`. "`manifest.js` is a special Route Handler that is cached by default" ([docs@v16.4.4/03-api-reference/03-file-conventions/01-metadata/manifest.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.mdx)), so it is built into a file under `output: 'export'` (inferred, from the route-handler rule in the static-export section).
- **What the PWA guide's manifest sets:**
  - `name` and `short_name`;
  - `start_url: '/'` and `display: 'standalone'`;
  - `background_color` and `theme_color`;
  - two PNG icons, `192x192` and `512x512`.

  Source: [docs@v16.4.4/02-guides/progressive-web-apps.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/progressive-web-apps.mdx).
- **Install criteria, per Next's guide:** "a valid web app manifest" and "served over HTTPS". It warns that `beforeinstallprompt` "is not cross browser and platform (does not work on Safari iOS)". For iOS, its install component tells the user to tap Share, then "Add to Home Screen" (same source). Chrome's and WebKit's own install rules were not read for this note; see Test at kick-off.
- **Icons:** `app/icon.png` and `app/apple-icon.png` become `<link rel="icon">` and `<link rel="apple-touch-icon">` tags with generated `sizes` ([app-icons.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.mdx)).
- **iOS meta tags:** `metadata.appleWebApp: { title, statusBarStyle, startupImage }` emits `apple-mobile-web-app-title`, `mobile-web-app-capable` and `apple-touch-startup-image` ([generate-metadata.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/04-functions/generate-metadata.mdx)). `themeColor` belongs in `viewport`, not `metadata` (same source).

### Flow: offline cache (app shell, map tiles, demo kit)

- **Next's built-in offline support doesn't cover cold loads.**
  - 16.4 adds an experimental `useOffline` hook (`next/offline`) and an `experimental.useOffline` flag. They retry failed soft navigations, RSC fetches and Server Actions ([docs@v16.4.4/02-guides/offline-support.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/offline-support.mdx)).
  - The same guide says: "A full page reload while offline still fails … full offline loads would need a service worker."
  - It also says plain `fetch()` calls "stay under that library's own retry policy". So it doesn't help with chain, Arkiv or tile requests.
  - Pata only needs the hook as a "you're offline" banner, if at all.
- **Next's PWA guide points to Serwist:** "For full service-worker-based offline caching, one option is Serwist, which provides Next.js integration examples for both Turbopack and webpack" ([progressive-web-apps.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/progressive-web-apps.mdx)).
- **Service-worker options on npm (read 2026-11-03):**

  | Option | Status | Fit for a static export under Turbopack |
  |---|---|---|
  | `@serwist/turbopack` 9.5.13 | Updated 2026-10-04; docs at serwist.pages.dev/docs/next/turbo (per its README) | `createSerwistRoute` returns a GET route handler with `dynamic = "force-static"`, `dynamicParams = false` and `generateStaticParams`. It bundles the SW with esbuild or esbuild-wasm, and serves it with the header `Service-Worker-Allowed: /` (package `src/index.ts`). Static export does build force-static GET handlers. But a static host drops that header, so the SW only controls the folder it's served from (e.g. `/serwist/`), unless the route puts it at the root (inferred). It globs the precache list from `.next/` (`src/index.schema.ts`) |
  | `@serwist/next` 9.5.13 | Updated 2026-10-04; peer-depends on `@serwist/cli` | The webpack-plugin route. Turbopack "does not support webpack plugins", and a `next build` that finds a `webpack` config fails unless you pass `--webpack` ([version-16.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/upgrading/version-16.mdx)) |
  | `@serwist/cli` 9.5.13 (or `workbox-cli` 7.4.1, updated 2026-05-04) run on `out/` after `next build` | Maintained | Doesn't depend on the bundler: it injects a precache list into a hand-written `sw.ts` and writes `out/sw.js` at the root, so the SW's scope is the whole site with no header needed (inferred from how the injectManifest step works; verify the CLI flags at kick-off) |
  | `next-pwa` 5.6.0, `@ducanh2912/next-pwa` 10.2.9 | Last published 2022-08-23 and 2024-09-18; the second peer-depends on webpack | Don't use |
  | Hand-written `public/sw.js` | Next's own guide | It registers with `navigator.serviceWorker.register(new URL('../lib/service-worker.js', import.meta.url), { scope: '/', updateViaCache: 'none' })`, but the guide's example only handles push, not caching |

- **Pick:** a hand-written `sw.ts` using `serwist` runtime classes, run through `@serwist/cli` injectManifest on `out/` as a `postbuild` step. Fall back to `@serwist/turbopack` if the CLI step fights the export.
- **Caching strategies** (inferred: these are Serwist/Workbox concepts, and their docs weren't read for this note):
  - **App shell:** precache `out/**/*.{html,js,css,txt,webmanifest,png}`.
  - **Map tiles:** cache-first, under a cache name with an entry cap.
  - **Pre-baked demo tiles or audio:** precache them.
  - **Chain RPC, Arkiv, AI and speech calls:** network-only, never cached. This keeps ciphertext and keys out of Cache Storage, beyond what the app already stores.
  - **Which tile source may be cached at all** belongs to `maps.md`.
- **Update flow:** the guide registers with `updateViaCache: 'none'` ([progressive-web-apps.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/progressive-web-apps.mdx)). For a hackathon, `skipWaiting` + `clientsClaim` in the SW is simplest (inferred). Each IPFS deploy changes the CID. On a subdomain gateway that means a new origin, so the old SW never sees the update. Behind a stable name (`pata.eth.limo`), the normal update check applies (inferred; the `hosting.md` note picks the host).

### Flow: static build on IPFS

- **Config:** `output: 'export'`; `next build` writes `out/`. The guide's optional keys are `trailingSlash`, `skipTrailingSlashRedirect` and `distDir` ([docs@v16.4.4/02-guides/static-exports.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/static-exports.mdx)).
- **Unsupported under export** (verbatim from the same source):
  - dynamic routes with `dynamicParams: true`;
  - dynamic routes without `generateStaticParams()`;
  - route handlers that rely on Request;
  - cookies;
  - rewrites, redirects and headers;
  - proxy (formerly middleware);
  - ISR (incremental static regeneration);
  - image optimization with the default loader;
  - draft mode;
  - Server Actions;
  - intercepting routes.

  "Attempting to use any of these features with `next dev` will result in an error."
- **Still works:**
  - Server Components run once, at build time.
  - Client Components are prerendered to HTML at build time.
  - A GET route handler with `export const dynamic = 'force-static'` becomes a static file (same source).
- **`headers`, `rewrites` and `redirects` in `next.config`:** only a build warning, `Specified "headers" will not automatically work with "output: export"`. `i18n` is a hard error ([packages/next/src/server/config.ts@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/packages/next/src/server/config.ts)).
- **`trailingSlash: true`** writes `/courier/index.html` instead of `/courier.html` ([trailingSlash.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/trailingSlash.mdx)). Then a plain file host serves `/courier/` with no rewrite rules. The guide's nginx rewrite is needed only "when `trailingSlash: false`" ([static-exports.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/static-exports.mdx)).
- **Courier route:** make it one static route, `app/courier/page.tsx`, that reads everything from the fragment. A `[grant]` dynamic segment would need every grant known at build time, which the "no hard-coded values" invariant rules out (inferred from the `generateStaticParams` rule).
- **Gateway paths.** Next has no supported relative-path mode, so the app breaks under `/ipfs/<cid>/`:
  - **`basePath`** "has to start with a /" and is inlined into the bundles at build time ([config.ts@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/packages/next/src/server/config.ts); [basePath.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/basePath.mdx)). It can't be `/ipfs/<cid>`, because the CID hashes the very build that would contain it (inferred).
  - **`assetPrefix: './'`** gets past validation, which only checks for a string (same `config.ts`). But the docs describe `assetPrefix` only for CDNs, and it covers only `/_next/static`, not `public/` files ([assetPrefix.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/assetPrefix.mdx)). The request for relative URLs, which names IPFS, is an old issue ([vercel/next.js#2581](https://github.com/vercel/next.js/issues/2581)).
  - **The manifest link is root-absolute.** The webpack loader writes `` `${basePath}/${name}.${extension}` `` ([discover.ts@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/packages/next/src/build/webpack/loaders/metadata/discover.ts)), and Turbopack maps `app/manifest.ts` to `/manifest.webmanifest` ([metadata/mod.rs@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/crates/next-core/src/next_app/metadata/mod.rs)). Icons are emitted as `/favicon.ico`, `/icon?…` and `/apple-icon?…` ([app-icons.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.mdx)).
  - **Result:** serve the build from an origin's root, through a subdomain gateway (`<cid>.ipfs.<gateway>`) or an ENS gateway such as `pata.eth.limo` (inferred; `hosting.md` picks which). Under a path gateway, expect broken `/_next/…` chunks, RSC payloads (the data files the client router fetches) and manifest URLs.

### Flow: client-only code (map, passkey, Anon-RPC worker, crypto)

- **`ssr: false`:** `dynamic(() => import(...), { ssr: false })` "will only work for Client Components". In a Server Component it's an error: "`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component." ([docs@v16.4.4/02-guides/lazy-loading.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/lazy-loading.mdx)).
  - Pattern: a `'use client'` wrapper file per browser-only feature, holding the `dynamic(..., { ssr: false })` call: map view, passkey sign-in, and the module that owns the Anon-RPC worker.
- **Browser APIs:** even under export, Client Components prerender at build time, and "`window`, `localStorage`, and `navigator` are not available on the server". So touch them only in `useEffect` or inside `ssr: false` components ([static-exports.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/static-exports.mdx)).
  - The same applies to `navigator.credentials` (WebAuthn), `crypto.subtle`, `location.hash` and MapLibre (inferred; MapLibre needs `window`).
- **Web Workers:** Turbopack bundles `new Worker(new URL('./x.ts', import.meta.url))`. Its config source documents `experimental.turbopackWorkerAssetPrefix` for "Web Worker URLs produced by `new Worker(new URL(..., import.meta.url))`" and notes "browsers reject cross-origin Worker construction" ([config-shared.ts@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/packages/next/src/server/config-shared.ts)).
  - Magic comments (`webpackIgnore`, `turbopackIgnore`, `turbopackOptional`) also work on `new Worker()` ([08-turbopack.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/08-turbopack.mdx)).
- **WASM:** Turbopack has a `wasm` module type, "Process as WebAssembly", for `turbopack.rules` ([turbopack.mdx config](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.mdx)).
- Whether `@anon-rpc/browser-harness` spawns its own worker or loads WASM from `node_modules` was not checked; that's for `anon-rpc.md`, and it's a kick-off test.

### Flow: security headers (CSP, COOP, COEP)

- **Under export, Next can't set headers.** `headers` is on the unsupported list, and the config only warns (above), so headers come from the host or not at all.
- **The PWA guide contradicts the export docs.** It sets `X-Frame-Options`, `Referrer-Policy` and a service-worker CSP through `headers()`, and for static export says to move "your defined headers to your proxy" ([progressive-web-apps.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/progressive-web-apps.mdx)). But proxy is also unsupported under export ([static-exports.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/static-exports.mdx)), so that advice doesn't apply to Pata.
- **CSP:** a `<meta http-equiv="Content-Security-Policy">` in the root layout is the only option on IPFS (inferred). The App Router injects inline scripts for its RSC payload, so a meta CSP needs `script-src 'unsafe-inline'` unless hashes are maintained (inferred; Next's nonce-based CSP guide needs a proxy, which is unavailable).
  - The useful part for CROPS is `connect-src`: an allowlist of the Anon-RPC entry, the AI/relay server and the tile host. Judges can read it in the HTML (inferred).
- **COOP/COEP:** these are HTTP-only headers, so a static IPFS build can't make the page cross-origin isolated (inferred; not re-read against the HTML spec for this note). If a library needs `SharedArrayBuffer`, it won't get it, unless a service worker re-serves responses with those headers, which would have to be merged into Pata's own SW (inferred).
- Whether any Pata dependency needs cross-origin isolation is not yet known; see Test at kick-off.

### Flow: courier link `#` fragment, and what Next sends anywhere

- **Fragment:** browsers don't send the fragment in HTTP requests (RFC 3986 §3.5 and the Fetch spec; not re-read for this note, so it's listed under Test at kick-off).
  - The courier page reads `location.hash` in a client effect, then calls `history.replaceState(null, '', location.pathname + location.search)`.
  - Next 16's App Router integrates native `history.replaceState` calls with its router; see `01-getting-started/04-linking-and-navigating.mdx` (downloaded but not checked for this note).
- **Telemetry:** `next telemetry --disable` turns off Next's "completely anonymous telemetry collection", which is a CLI feature ([docs@v16.4.4/03-api-reference/06-cli/next.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/06-cli/next.mdx)). Nothing in the docs read here describes runtime analytics in the client bundle.
  - Web Vitals reporting (`useReportWebVitals`) and `instrumentation-client.ts` run only if the app uses them (inferred from the file-convention docs).
  - Before the CROPS claim, test for third-party requests in the browser's network tab.
- **`experimental.agentFeedback` (new in 16.4):**
  - When on, `next dev` writes a block into `AGENTS.md` telling detected AI coding agents to collect "anonymized facts" and run `npx --no-install next internal agent-feedback-instructions`.
  - Drafts open in a browser form, and nothing is sent until a person clicks **Send feedback**.
  - It "requires Next.js Telemetry to be enabled", and "New apps created with the recommended `create-next-app` settings enable agent feedback".

  Source: [agentFeedback.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/agentFeedback.mdx). Set it to `false` and disable telemetry.
- **`agentRules`** (on by default since 16.3) writes a separate `AGENTS.md` block that points to the bundled docs. It's harmless, and `create-next-app --no-agents-md` skips it ([agentRules.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/03-api-reference/05-config/01-next-config-js/agentRules.mdx)).

## Limits

- **No Next server in the IPFS build.**
  - No Server Actions, cookie reads, request-reading route handlers, `headers`, `redirects` or proxy (static-export list above).
  - The Claude-key endpoint and the gas relay must be a separate small server that the client calls with `fetch`, as CLAUDE.md's stack already says.
  - The PWA guide's push-notification example depends on Server Actions, so it doesn't apply.
- **Dynamic URLs:** every dynamic segment needs `generateStaticParams`, and `dynamicParams` must be false. Per-grant data has to come from the fragment or client fetches, not from the path.
- **Images:** `next/image` needs `images.unoptimized: true` or a custom loader.
- **Hosting at the root:** the app must be served from an origin's root path (gateway paths section above).
- **Browser floor:** Chrome 111, Safari 16.4 ([version-16.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/upgrading/version-16.mdx)).

## Gotchas

- **Context7 is behind:** its Next.js docs stop at 16.2.9, and 16.3 and 16.4 came later. Use `node_modules/next/dist/docs/` or the `v16.4.4` tag.
- **Breaking changes from 15 to 16** that touch this note ([version-16.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/upgrading/version-16.mdx)):
  - Turbopack is the default.
  - A `next build` that finds a `webpack` config fails; the guide notes "it is likely that a plugin is adding a `webpack` option".
  - `middleware` is renamed `proxy`.
  - Request APIs and the `params` of icon and OG-image generators are async.
  - `next lint` is removed.
  - `next/image` defaults changed (`minimumCacheTTL`, `imageSizes`, `qualities`), and local images with query strings changed.
  - Parallel routes need `default.js`.
  - Node 20.9 is the minimum.
- **Shared origin on a path gateway** (inferred): every CID on that gateway shares one origin. A household key kept in `localStorage`/IndexedDB (P0's "key kept in device storage") would be readable by any other site on the same gateway. Passkeys bind to the origin's domain too. This is another reason to serve from a subdomain or ENS gateway, and `hosting.md` and `passkeys.md` should confirm.
- **New CID, new origin:** on a subdomain gateway each deploy gets a new origin, so the passkey, stored keys and SW from an old CID don't carry over. Demo from one stable name (inferred).
- **`useOffline` isn't offline support:** it doesn't make a cold load work offline (offline-support.mdx).
- **The guide's SW registration doesn't port as-is:** `new URL('../lib/service-worker.js', import.meta.url)` with `scope: '/'` emits the SW under a bundler path. A wider scope then needs the `Service-Worker-Allowed` header, which a static IPFS host can't send (inferred; the `@serwist/turbopack` source sets that header for the same reason). Write `sw.js` to the root of `out/` instead.

## Values to copy

| Name | Value | Source |
|---|---|---|
| Next.js version | `16.4.4` | `npm view next version`, 2026-11-03 |
| Node engine | `>=20.9.0` | `npm view next engines` |
| Browser floor | Chrome/Edge/Firefox 111+, Safari 16.4+ | version-16.mdx @v16.4.4 |
| Export config | `output: 'export'`, `trailingSlash: true`, `images: { unoptimized: true }` | static-exports.mdx, trailingSlash.mdx @v16.4.4 |
| Build output dir | `out/` | static-exports.mdx @v16.4.4 |
| Manifest file | `app/manifest.ts` → served at `/manifest.webmanifest` | manifest.mdx; metadata/mod.rs @v16.4.4 |
| Install icons | 192x192 and 512x512 PNG | progressive-web-apps.mdx @v16.4.4 |
| Static GET route | `export const dynamic = 'force-static'` | static-exports.mdx @v16.4.4 |
| Client-only import | `dynamic(() => import('…'), { ssr: false })` inside a `'use client'` file | lazy-loading.mdx @v16.4.4 |
| Opt out of Turbopack | `next build --webpack` | 08-turbopack.mdx @v16.4.4 |
| Agent feedback off | `experimental: { agentFeedback: false }` | agentFeedback.mdx @v16.4.4 |
| Telemetry off | `next telemetry --disable` | cli/next.mdx @v16.4.4 |
| Serwist packages | `serwist`, `@serwist/cli` 9.5.13 (`@serwist/turbopack` 9.5.13 as fallback) | `npm view`, 2026-11-03 |

## Contradictions with idea.md

- **idea.md, EF CROPS checklist (C):** "The app runs from the repo or any IPFS gateway." A Next 16 static export emits root-absolute URLs. `basePath` must start with `/` and is fixed at build time ([config.ts@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/packages/next/src/server/config.ts)), and the manifest href is `` `${basePath}/…` `` ([discover.ts@v16.4.4](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/packages/next/src/build/webpack/loaders/metadata/discover.ts)). So it runs from gateways that serve it at an origin root (subdomain or ENS gateways), not from path-style `/ipfs/<cid>/` URLs, unless a relative-path workaround passes the kick-off test. Suggested wording: "any IPFS subdomain gateway, or its ENS name".
- **idea.md "Offline demo kit"** ("Cached map tiles for Dharavi and BKC … pre-recorded Hindi and Marathi directions audio"): no contradiction, but Next's built-in offline feature (`useOffline`) doesn't provide it ([offline-support.mdx](https://raw.githubusercontent.com/vercel/next.js/v16.4.4/docs/01-app/02-guides/offline-support.mdx)). It needs our own service worker (Serwist), which is a ticket idea.md doesn't list.

## Test at kick-off

- [ ] `create-next-app` with TypeScript and the App Router. Then set `experimental.agentFeedback: false` and run `next telemetry --disable`.
- [ ] `output: 'export'` + `trailingSlash: true`: does `next build` (Turbopack) produce `out/index.html`, `out/courier/index.html` and `out/manifest.webmanifest`?
- [ ] Serve `out/` from a subdomain-style origin (e.g. a local IPFS gateway's `<cid>.ipfs.localhost`). Check install, the manifest and icons. Then try `/ipfs/<cid>/` with `assetPrefix: './'` and record exactly what breaks.
- [ ] Android Chrome: is the install prompt offered (manifest + HTTPS + icons)? Read Chrome's current install criteria (web.dev / developer.chrome.com) first.
- [ ] iOS Safari: does Share → Add to Home Screen open standalone with the apple-icon? Read WebKit's current rules first.
- [ ] Service worker: `@serwist/cli` injectManifest on `out/` → `out/sw.js` registered at scope `/`. With Wi-Fi off, the app shell reloads, and the demo tiles and audio load from cache. Chain, Arkiv and AI calls are never cached.
- [ ] Do requests from MapLibre's tile worker go through the page's service worker (whether a blob-URL worker is controlled by the page's SW)?
- [ ] `@anon-rpc/browser-harness`, MapLibre, `@arkiv-network/sdk` and viem behind `ssr: false` wrappers: `next build` passes with no `window is not defined`. The harness's worker and any WASM load from the exported files.
- [ ] Grep the built bundle and dependencies for `SharedArrayBuffer` / `crossOriginIsolated`. If any is needed, plan a SW-based COOP/COEP fallback.
- [ ] Meta CSP in the root layout with a `connect-src` allowlist. The app still hydrates (inline RSC scripts), and the map worker still starts.
- [ ] Courier page: the fragment is absent from the request line in the gateway's or local server's log. `history.replaceState` clears it from the address bar without a reload or a Next router re-render loop. Check whether `chrome://history` still holds the original URL.
- [ ] DevTools network tab on the exported app: no requests to any host outside the `connect-src` list (Vercel, Google Fonts, analytics). If `next/font/google` is used, confirm it self-hosts fonts at build time.
