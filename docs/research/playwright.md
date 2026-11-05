# Playwright

Checked: 2026-11-03 · Version: `@playwright/test` 1.64.1 (`npm view @playwright/test version`, published 2026-10-14; `next` is 1.65.0-alpha, so 1.65 may land around kick-off) · Status: test at kick-off
Feeds: P0 passkey sign-in, courier view, expiry and revoke; P1 passkey-derived keys, live-access screen; the EF CROPS checks (no third parties, the `#` part never sent); offline demo kit; the `npm run check` gate (CLAUDE.md)

This note covers the repo's own end-to-end tests. The Playwright MCP plugin that lets Claude drive a browser is a separate tool. Sources: the 1.64.1 npm tarballs (`playwright-core/types/types.d.ts`, `protocol.d.ts`, `browsers.json`, `lib/coreBundle.js`), read 2026-11-03, and Playwright's docs source on the `release-1.64` branch ([docs/src](https://github.com/microsoft/playwright/tree/release-1.64/docs/src)), published at playwright.dev.

## Install and setup

- Requires Node `>=20` (`engines`, `npm view`). The team has Node 22.19 (handoff.md).
- `@playwright/test` 1.64.1 is a thin wrapper around `playwright` 1.64.1, its only dependency.
- Browsers bundled with 1.64.1 (`playwright-core/browsers.json`):

  | Browser | Version |
  |---|---|
  | `chromium` | 156.0.8078.4, "Chrome for Testing", revision 1248 |
  | `chromium-headless-shell` | 156.0.8078.4 |
  | `firefox` | 157.0 |
  | `webkit` | 27.2 |
  | `ffmpeg` | revision 1013, used for video |

- Install only what's used: `npx playwright install chromium` (or `webkit` for the iPhone project). `--with-deps` installs Linux system packages, so Windows doesn't need it. Headless runs use the headless shell by default; `--only-shell` skips the full browser, and `channel: 'chromium'` opts into Chrome's "new headless", which is "more authentic" ([browsers](https://playwright.dev/docs/browsers)).
- Browsers download to `%USERPROFILE%\AppData\Local\ms-playwright`; `PLAYWRIGHT_BROWSERS_PATH` moves them ([browsers](https://playwright.dev/docs/browsers)).
- `webServer` ([test-webserver](https://playwright.dev/docs/test-webserver)) takes these keys:
  - `command`, `url`, `reuseExistingServer` (docs suggest `!process.env.CI`), `timeout` (default 60000 ms), `stdout` (default `ignore`), `stderr` (default `pipe`), `env` (inherits `process.env` and adds `PLAYWRIGHT_TEST=1`), `cwd`, `name`, `wait` (regex on output), `gracefulShutdown`;
  - an array runs several servers (the static app plus our AI/relay server);
  - set `use.baseURL` to the same URL.
- **Device projects:**
  - Android: `devices['Pixel 7']` (Chromium, 412×839, Android 14 UA with Chrome 156) or `devices['Galaxy S24']` (Chromium, 360×780).
  - iPhone: `devices['iPhone 15']` (WebKit, 393×659, iOS 17.5 UA). The registry goes up to `iPhone 17` / `iPhone 17 Pro Max`.
  - A device's `defaultBrowserType` only sets the default: the runner's fixture is `browserName: ({ defaultBrowserType }, use) => use(defaultBrowserType)`, so `{ ...devices['iPhone 15'], browserName: 'chromium' }` gives an iPhone-sized Chromium (from `playwright/lib/index.js`). Device emulation sets the user agent, screen, viewport, `isMobile`, `hasTouch` and scale; it isn't the phone's real browser ([emulation](https://playwright.dev/docs/emulation)).
- **Scripts:** `npm run e2e` → `playwright test`, kept out of `npm run check`. End-to-end tests need a built app, downloaded browsers and, for chain tests, the network, so they'd make the per-commit gate slow and flaky (inferred).

## What Pata uses

### Passkeys: a virtual authenticator through CDP (P0 sign-in, P1 PRF keys)

- Playwright has no WebAuthn API of its own. Tests open a CDP session with `context.newCDPSession(page)`, and its types say "CDP sessions are only supported on Chromium-based browsers". **Passkey tests are Chromium-only; there is no route to a virtual authenticator in WebKit or Firefox through Playwright.**
- The CDP `WebAuthn` domain is marked **experimental** ([browser_protocol.json](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json); [docs](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/)).
  - Commands: `enable` (`enableUI` defaults to false, "recommended for automated testing"), `addVirtualAuthenticator`, `addCredential`, `getCredential(s)`, `removeCredential`, `clearCredentials`, `setUserVerified`, `setAutomaticPresenceSimulation`, `setResponseOverrideBits`, `setCredentialProperties`, `removeVirtualAuthenticator`, `disable`.
  - Events: `credentialAdded`, `credentialAsserted`, `credentialUpdated`, `credentialDeleted`.
- **PRF is supported.** `VirtualAuthenticatorOptions.hasPrf`: "the authenticator will support the prf extension … Defaults to false". The sibling options `hasHmacSecret` and `hasHmacSecretMc` cover CTAP hmac-secret, and hmac-secret at registration. Playwright 1.64.1 ships these types in `protocol.d.ts`.
- What Chromium does with these options ([webauthn_handler.cc](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/devtools/protocol/webauthn_handler.cc), [virtual_authenticator.cc](https://source.chromium.org/chromium/chromium/src/+/main:content/browser/webauth/virtual_authenticator.cc), main branch):
  - The PRF options apply only with `protocol: "ctap2"`.
  - `hasPrf` also sets `internal_account_chooser`, and any PRF or hmac option turns on PIN/UV-token support "because the exchange is encrypted".
  - `transport: "internal"` creates a platform authenticator, and "Chrome only supports one internal authenticator per environment".
  - Defaults: `automaticPresenceSimulation` is true and `isUserVerified` is false, so set `isUserVerified: true`.
  - The virtual-authenticator manager belongs to the session's frame tree. Set it up again for every new page, such as a courier link opened in a second tab (inferred).
- **The recovery path can't be faked by copying a credential.** A credential injected with `WebAuthn.addCredential` has no PRF secret: the CDP `Credential` type has no field for it, and `AddRegistration`/`AddResidentRegistration` build the registration from the private key alone, while hmac-secret's `hmac_key` lives in `RegistrationData` ([virtual_fido_device.h](https://source.chromium.org/chromium/chromium/src/+/main:device/fido/virtual_fido_device.h)). To test "same passkey, same keys", create the credential through the page, clear the app's storage, reload and sign in again on the same authenticator (inferred).

### PWA and offline (offline demo kit)

- "Service workers are only supported on Chromium-based browsers" ([service-workers](https://playwright.dev/docs/service-workers)). The offline-kit test therefore runs in Chromium.
- `serviceWorkers: 'allow' | 'block'` (default `'allow'`). Keep `'allow'` for PWA tests. Use `'block'` for tests that mock with `route`, because `route` "will not intercept requests intercepted by Service Worker" (types; [network](https://playwright.dev/docs/network)).
- `context.waitForEvent('serviceworker')` fires *before* the worker controls the page. Wait for `controllerchange`, or for `registration.active.state === 'activated'`, before going offline ([service-workers](https://playwright.dev/docs/service-workers)).
- `context.setOffline(true)`, or `offline: true` in `use`, "only affects requests that go through the browser's regular network stack, such as page navigations, `fetch()`, `XMLHttpRequest` and WebSockets. It does not affect WebRTC traffic" (types, 1.64.1).
  - Test shape: load once online, wait for the service worker, `setOffline(true)`, reload. Then assert that the cached tiles, the cached Overpass answers and the audio clips render, and that `response.fromServiceWorker()` is true for them (inferred).
- A service worker's own requests reach **context** events (`request`, `response`, `requestfailed`) and `context.route`, with `request.serviceWorker()` set and `request.frame()` throwing. `page.on('request')` doesn't see them ([service-workers](https://playwright.dev/docs/service-workers)).
- Next.js PWA plugins typically turn the service worker off in `next dev`, so run the offline test against the production or static build in `webServer` (inferred; see the Next.js PWA note).

### CROPS proof: every request, and the `#` fragment

- **Listen on the context, not the page.**
  - `context.on('request')` covers every page in the context, and service-worker requests reach only the context.
  - Requests from dedicated workers are reported too: Playwright's Chromium network manager attaches worker sessions and assigns their requests to the owning frame (`requestWillBeSentSessionInfo.workerFrame` in `coreBundle.js`).
  - It drops events for requests that have no known frame and no service worker (`if (!frame && !this._serviceWorker) … return`).
- **Add WebSockets:** `page.on('websocket')` (`ws.url()`, `framesent`) ([network](https://playwright.dev/docs/network)).
- **Anon-RPC limits what the log can prove.** The harness runs its worker "in a Web Worker inside a sandboxed null-origin iframe", and "the built-in KPS transport runs over WebRTC" ([wallet guide](https://ethereum.github.io/anon-rpc/wallets/), saved in `sources/anon-rpc-site-wallets.txt`).
  - A Playwright log can't see WebRTC: neither request events nor `setOffline` cover it.
  - So the test can prove that **no request goes to a non-allowlisted host**, including RPC providers apart from the bootstrap read. It can't show what the mixnet carried.
  - Expect the worker-bundle fetch from the specifier's resolvers. With the passthrough worker, expect plain RPC fetches from inside the iframe's worker.
- **Fragment:**
  - In Chromium, `request.url()` is CDP's `Network.Request.url`, described as "Request URL (without fragment)". Playwright doesn't add `urlFragment` back to requests; it adds it back only to frame URLs, so `page.url()` includes `#` (`coreBundle.js`; CDP `Page.Frame.url` is "without fragment").
  - So checking `request.url()` alone proves only what browsers already guarantee. The useful assertion is that the secret from the `#` part (grant label, payload key, session key) appears in **no** request URL, header (`await request.allHeaders()`, including `referer`), body (`request.postDataBuffer()`) or WebSocket frame. That catches app code that reads `location.hash` and sends it somewhere (inferred design).
  - Also assert `page.url()` has no `#` after load, since the courier page must strip it (idea.md Stack, Encryption).
- **Host allowlist (inferred):** our app origin, our AI/relay server, the Anon-RPC resolvers, plus Nominatim/Overpass only during setup. Fail on anything else, which covers "no trackers".

### Time and chains (grant expiry)

- `page.clock` overrides `Date`, `Temporal.Now`, timers, `requestAnimationFrame`, `requestIdleCallback`, `performance` and `Event.timeStamp`.
  - Methods: `setFixedTime`, `install({ time })` (must come before any other clock call), `pauseAt`, `fastForward`, `runFor`, `resume`, `setSystemTime` ([clock](https://playwright.dev/docs/clock)).
  - It is injected as a context init script and evaluated in frames (`Clock` in `coreBundle.js`), so Web Workers, service workers and the chains keep real time (inferred from source).
- Three ways to test expiry (trade-offs inferred):

  | Approach | Good for | Cost |
  |---|---|---|
  | `page.clock` | The countdown on the live-access list and the courier view; expiry maths in the UI | Doesn't move `block.timestamp` or Arkiv blocks, so the "stops resolving" flip never happens |
  | Mock JSON-RPC with `context.route` (`serviceWorkers: 'block'`) | The flip to "Dharavi, 400017" and key wiping, deterministic and offline | Works only with the passthrough worker or a direct transport. Mixnet traffic is encrypted, and KPS runs over WebRTC, which `route` can't see. You also hand-write `eth_call` results |
  | Real chains, a 20 s grant | The real end-to-end demo path | About 24 s or more per test, needs network and test gas, and can be flaky on venue Wi-Fi. Mark it `test.slow()` and keep it out of default runs |
  | Local anvil fork of Sepolia (`evm_increaseTime`) | Real ENSv2 contracts with time travel | Doesn't cover Arkiv, whose expiry is chain-level, or Anon-RPC. Another moving part; see the Foundry note |

- Recommendation (inferred): use `page.clock` plus mocked RPC for fast tests, and run one real-chain smoke test by hand before the demo.

### Geolocation, permissions and microphone

- Use `geolocation: { latitude, longitude }` with `permissions: ['geolocation']` in `use`, or `context.setGeolocation()` and `context.grantPermissions([...], { origin })`. Geolocation changes apply to every page in the context ([emulation](https://playwright.dev/docs/emulation)).
- `'microphone'` is among the permission names, but "Supported permissions differ between browsers … Any permission may stop working after an update" (types, `grantPermissions`).
- Fake microphone input: Chromium's switches `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream` and `--use-file-for-fake-audio-capture=<wav>` go in `launchOptions.args`. **Not verified against a primary source in this pass.** Test them at kick-off.
- Mock the speech-to-text request with `route` rather than calling the provider (inferred).

## Limits

- Passkeys (CDP) and service workers run only in Chromium. Firefox and WebKit projects can cover layout and flows, but not sign-in or offline.
- The CDP WebAuthn domain is experimental. Pin the Playwright version so its Chromium doesn't change under the tests (inferred).
- WebRTC traffic, which carries Anon-RPC's KPS transport, can't be seen or cut by Playwright.
- A request for an updated service-worker script can't be routed ([playwright#14711](https://github.com/microsoft/playwright/issues/14711), cited in the service-workers doc).
- Emulating an iPhone is WebKit 27.2 on Windows, not iOS Safari. Playwright says features such as media codecs "vary substantially between Linux, macOS and Windows" ([browsers](https://playwright.dev/docs/browsers)). It can't tell us whether the demo phones support PRF.

## Gotchas

- Windows ignores `webServer.gracefulShutdown`: "Windows doesn't support `SIGTERM` and `SIGINT` signals" ([test-webserver](https://playwright.dev/docs/test-webserver)).
- `context.route` and service workers conflict, so give the mocking tests and the offline test separate projects or `test.use` blocks.
- `request.frame()` throws for service-worker requests; check `request.serviceWorker()` first.
- Put `viewport` and `isMobile` overrides **after** `...devices[...]` ([emulation](https://playwright.dev/docs/emulation)).
- Vitest's default `include` likely also matches `*.spec.ts`. Keep end-to-end files in `e2e/` and exclude that folder from Vitest, or name them `*.e2e.ts` (inferred; check the Vitest docs).

## Values to copy

| Name | Value | Source |
|---|---|---|
| Playwright | `@playwright/test@1.64.1`, Node `>=20` | npm, 2026-11-03 |
| Bundled browsers | Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2 | `playwright-core@1.64.1/browsers.json` |
| Install | `npx playwright install chromium webkit` | [browsers](https://playwright.dev/docs/browsers) |
| Browser cache | `%USERPROFILE%\AppData\Local\ms-playwright` | same |
| Android project | `{ ...devices['Pixel 7'] }` | 1.64.1 device registry |
| iPhone project | `{ ...devices['iPhone 15'] }` (WebKit); add `browserName: 'chromium'` for passkey tests | same; `playwright/lib/index.js` |
| `webServer.timeout` default | 60000 ms | [test-webserver](https://playwright.dev/docs/test-webserver) |
| Authenticator options | `{ protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true }` | CDP `VirtualAuthenticatorOptions`; this combination is ours |
| CDP calls | `WebAuthn.enable { enableUI: false }`, then `WebAuthn.addVirtualAuthenticator { options }` → `{ authenticatorId }` | CDP WebAuthn domain |
| Service workers | `serviceWorkers: 'allow'` (offline test) / `'block'` (mocking tests) | types, 1.64.1 |
| Offline | `await context.setOffline(true)` | types, 1.64.1 |

## Contradictions with idea.md

None found. Two places where a reader might expect more from Playwright than it gives:
- "Every RPC call in the demo runs through the harness" (Track checklists, Anon-RPC). A Playwright network log can show that no request went directly to an RPC host other than the bootstrap read. It can't show the WebRTC traffic that carried the calls, so present the log as evidence of absence, not as a trace of the mixnet.
- "The demo phones' browsers lack the WebAuthn PRF extension | Test them at kick-off" (Risks). Playwright's virtual authenticator proves our PRF code path in Chromium only. It says nothing about the real phones, so that kick-off test still has to happen on the phones.

## Test at kick-off

- [ ] `hasPrf: true` returns `getClientExtensionResults().prf.results.first` on `get()` in both the headless shell and `channel: 'chromium'`. Compare `hasHmacSecret` + `hasHmacSecretMc` for results at `create()`.
- [ ] Recovery: the same PRF output after clearing the app's storage and reloading, with the authenticator kept.
- [ ] The Anon-RPC passthrough worker's fetches (Web Worker inside a null-origin iframe) appear in `context.on('request')`; list every host the harness contacts.
- [ ] `setOffline(true)` blocks fetches from the null-origin iframe's worker and from the service worker.
- [ ] Offline kit: after the service worker activates, `setOffline(true)` + reload still renders the tiles, the Overpass answers and the audio.
- [ ] The Chromium fake-media switches, with a WAV of a spoken address, reach `getUserMedia`/`MediaRecorder` in the headless shell.
- [ ] Vitest ignores `e2e/`; `tsc` typechecks the end-to-end files.
- [ ] Pin the version; recheck whether 1.65.0 shipped before Nov 5.
- [ ] Real-chain smoke test: a 20 s grant flips the courier view within about 30 s.
