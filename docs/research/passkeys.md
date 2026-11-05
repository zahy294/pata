# Passkeys and WebAuthn PRF

Checked: 2026-11-03 · Version: WebAuthn Level 3, W3C Recommendation of 25 Aug 2026 ([REC](https://www.w3.org/TR/2026/REC-webauthn-3-20260825/)); browser minimums from MDN browser-compat-data `main` ([CredentialsContainer.json](https://github.com/mdn/browser-compat-data/blob/main/api/CredentialsContainer.json), read 2026-11-03), WebKit release posts, Chromium `main` source · Status: test at kick-off
Feeds: idea.md Stack table ("Passkey sign-in derives the household's keys…"), Scope ladder P0 "Sign-in with a passkey; the key kept in device storage" and P1 "Keys derived from the passkey (the recovery answer)", Stress test row "What if Sana loses her phone?", Risks row "The demo phones' browsers lack the WebAuthn PRF extension", Hosting "Static build on IPFS" (and `hosting.md`), CROPS "C" and "S" lines.

**Bottom line.** PRF works for synced passkeys in Safari 18+ (iCloud Keychain) and Chrome (Google Password Manager); Windows Hello has no announced support. Recovery needs the same provider account *and* the same RP ID (hostname). On IPFS, a CID URL is a new origin per deploy, so a redeploy orphans every passkey and every IndexedDB key. Host the app at one stable hostname before the demo household is made.

## Install and setup

- No package needed: `navigator.credentials.create()` / `.get()` with the `prf` extension, then WebCrypto HKDF. Pata verifies no assertion on a server (the passkey is only a key source), so a server library such as SimpleWebAuthn adds nothing, and the challenge can be random client bytes (inferred).
- Secure context: `https:`, or `http:` with host `localhost` ([REC §RP ID](https://www.w3.org/TR/webauthn-3/#rp-id)).
- For phones, a real HTTPS hostname is required. IP-address origins (`https://192.168.x.x`) throw `SecurityError`: "Only the domain format of host is allowed here" ([REC §5.1.3](https://www.w3.org/TR/webauthn-3/#sctn-createCredential)).

## What Pata uses

### Flow: first sign-in (create the household's passkey)

```js
// sketch only
navigator.credentials.create({ publicKey: {
  rp: { name: "Pata" },                 // rp.id omitted = origin's effective domain
  user: { id, name, displayName },      // user.id 1–64 bytes
  challenge,                            // random; nobody verifies it (inferred)
  pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
  authenticatorSelection: { residentKey: "required", userVerification: "required" },
  extensions: { prf: { eval: { first: PATA_PRF_SALT } } },
}})
```

- Input shape: `prf: { eval?: { first, second? }, evalByCredential?: { [b64urlCredId]: { first, second? } } }`; inputs are any-length `BufferSource` ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)). `evalByCredential` at `create()` is a `NotSupportedError` (same source).
- `getClientExtensionResults().prf` after `create()`: `enabled` is always present; `results` may be absent. The spec lists `{enabled:true}`, `{enabled:false}` and `{enabled:true, results:{first}}` as valid ([REC §16.17.1.1](https://www.w3.org/TR/webauthn-3/#sctn-test-vectors-prf-webauthn)): "Not all authenticators support evaluating the PRFs during credential creation… If not, then an assertion is needed in order to obtain the outputs" ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)).
- Google Password Manager on desktop Chrome can return either: Chromium's enclave code reads the create-time `prf` field as a boolean (enabled only) or as a results map ([enclave_protocol_utils.cc](https://chromium.googlesource.com/chromium/src/+/main/device/fido/enclave/enclave_protocol_utils.cc), read 2026-11-03; verified by: source code). Third-party docs say registration "usually only reports whether PRF is `enabled`" ([Corbado flutter-passkeys README](https://github.com/corbado/flutter-passkeys/blob/main/packages/passkeys/passkeys/README.md), vendor claim).
- So code must handle `enabled:true` without `results` by running one `get()` straight after: a second biometric prompt at sign-up.
- `enabled:false` or no `prf` key: no PRF for this credential, so use the P0 device key.

### Flow: sign-in on this or a new device (derive the keys)

```js
navigator.credentials.get({ publicKey: {
  challenge, userVerification: "required",          // rpId omitted = origin's effective domain
  extensions: { prf: { eval: { first: PATA_PRF_SALT } } },
}})
// cred.getClientExtensionResults().prf.results.first -> 32-byte ArrayBuffer
```

- New phone = empty `allowCredentials` (discoverable passkey), so use `eval`. `evalByCredential` with empty `allowCredentials` is a `NotSupportedError`; its keys must be base64url IDs of `allowCredentials` entries, else `SyntaxError` ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)). One app-wide salt makes `eval` enough (inferred).
- After `get()`: `{prf:{}}` (not evaluated) or `{prf:{results:{first, second?}}}`; `enabled` never appears ([REC §16.17.1.1](https://www.w3.org/TR/webauthn-3/#sctn-test-vectors-prf-webauthn)).
- Output is 32 bytes: the PRFs "map from BufferSources of any length to 32-byte BufferSources" ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)).
- The browser hashes the input first: `salt1 = SHA-256(UTF8Encode("WebAuthn PRF") || 0x00 || eval.first)` (same source). Windows' API does the same conversion ([webauthn.h](https://github.com/microsoft/webauthn/blob/master/webauthn.h), "SHA-256(UTF8Encode("WebAuthn PRF") || 0x00 || Value)"). The salt is public; a fixed constant such as the UTF-8 of `pata/household-root/v1` is fine (inferred).
- PRF is tied to user verification: on hmac-secret authenticators "that PRF MUST be the one used for when user verification is performed. This overrides the UserVerificationRequirement if necessary" ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)). Set `userVerification: "required"`.
- `second` gives a second independent 32-byte output in the same prompt ([REC §16.17.1.1](https://www.w3.org/TR/webauthn-3/#sctn-test-vectors-prf-webauthn)).
- Never send `results` anywhere: `toJSON()` includes `results` if present ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)).

### Flow: derive the two household keys (P1)

- WebCrypto has no secp256k1. ECDSA/ECDH accept only `"P-256"`, `"P-384"`, `"P-521"` ([WebCrypto ED](https://w3c.github.io/webcrypto/), read 2026-11-03). So the Ethereum key exists as raw bytes in page JS (viem `privateKeyToAccount`), and any script on the origin can read it while the page runs (inferred).
- HKDF in WebCrypto takes `{ name: "HKDF", hash, salt, info }`; `salt` and `info` are both `required BufferSource` ([WebCrypto ED, `HkdfParams`](https://w3c.github.io/webcrypto/#hkdf-params)).
- Plan (inferred):
  1. `importKey("raw", prfOutput, "HKDF", false, ["deriveBits","deriveKey"])`.
  2. Ethereum key: `deriveBits({name:"HKDF", hash:"SHA-256", salt: <fixed>, info: utf8("pata/v1/secp256k1")}, k, 256)`, then check `1 ≤ key < n` (secp256k1 order) and pass to `privateKeyToAccount`. The same address works on Sepolia and Arkiv because both are EVM chains.
  3. Encryption key: same HKDF key with `info: utf8("pata/v1/household-enc")`. Use `deriveKey` → non-extractable AES-GCM-256 for the household's own records. If the ENS record must publish a public encryption key, derive X25519 bytes instead (that choice belongs to the encryption design, not here).
- Domain separation comes from the distinct `info` labels; one PRF output can feed any number of keys. Alternatively, use `eval.second` with a different salt for the second root.

### Feature check before the ceremony

- `PublicKeyCredential.getClientCapabilities()` may contain `"extension:prf": true`, but "even if an extension is mapped to true, the authenticator used for any given operation may not support that extension"; a missing key means unknown ([REC §5.1.7](https://www.w3.org/TR/webauthn-3/#sctn-getClientCapabilities)). Shipped in Chrome 133, Firefox 135, Safari 17.4 ([BCD PublicKeyCredential.json](https://github.com/mdn/browser-compat-data/blob/main/api/PublicKeyCredential.json)).
- The real test is `enabled` at `create()` plus 32-byte `results.first` at `get()`.

## Limits

### PRF support by browser (client side)

From [MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/api/CredentialsContainer.json) (`…extensions.prf`), read 2026-11-03. This is a cross-vendor dataset, not a vendor statement.

| Browser | `create()` | `get()` | Vendor source |
|---|---|---|---|
| Chrome desktop and Android, Edge, Opera, Samsung Internet | 116 | 116 | Chromestatus "WebAuthn PRF extension": "Enabled by default", no milestone given ([chromestatus 5138422207348736](https://chromestatus.com/feature/5138422207348736)) |
| Safari macOS, iOS, iPadOS | 18 | BCD: no (cites [WebKit 259934](https://bugs.webkit.org/show_bug.cgi?id=259934)) | "WebKit for Safari 18.0 adds support for the WebAuthn prf extension. It allows for retrieving a symmetric key from a passkey" ([WebKit, Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)). Security keys only from 26.4 ([WebKit, Safari 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)). Bug 259934 is the security-key work, so BCD's `get()` "no" looks wrong for iCloud Keychain passkeys (inferred) |
| Firefox desktop | 139 (135–138: "Not supported on macOS") | 139 | — |
| Firefox Android | 149 | no ([bug 1958716](https://bugzil.la/1958716)) | Unusable for Pata |
| Android WebView (in-app browsers) | no | no | Unusable for Pata |

### PRF support by passkey provider (what actually decides it)

| Provider | PRF | Evidence |
|---|---|---|
| iCloud Keychain (Safari 18+, iOS/iPadOS/macOS 18+) | Yes | WebKit Safari 18.0 post, above |
| Google Password Manager, desktop Chrome | Yes, at `create()` and `get()` | Chromium enclave code parses `prf` in both responses ([source](https://chromium.googlesource.com/chromium/src/+/main/device/fido/enclave/enclave_protocol_utils.cc)) |
| Google Password Manager, Android | Likely yes | Android's Credential Manager added "Support PRF creation for Android versions 13 and below" in `androidx.credentials` 1.3.0-alpha04, 14 May 2024 ([release notes](https://developer.android.com/jetpack/androidx/releases/credentials)). No Chrome-for-Android statement found: test |
| Chrome profile (local, non-synced on macOS) | No | Bitwarden: "Google Chrome is PRF-capable, but Chrome profiles are not" ([Bitwarden help](https://bitwarden.com/help/login-with-passkeys/), third-party claim) |
| Windows Hello (Edge, Chrome or Firefox on Windows) | No announced support | Microsoft Q&A, June 2025: "Microsoft has not publicly announced a specific timeline for implementing the WebAuthn PRF extension in Windows Hello" ([Q&A](https://learn.microsoft.com/en-us/answers/questions/2286384/windows-hello-support-for-webauthn-prf-extension); answered by an independent advisor, not Microsoft staff). Windows' API already has `bEnablePrf` and `pPRFGlobalEval` for other authenticators ([webauthn.h](https://github.com/microsoft/webauthn/blob/master/webauthn.h)) |
| Hybrid (QR, phone as authenticator) | Probably, since the phone's provider computes the PRF over CTAP hmac-secret (inferred) | No vendor statement found: test |

### RP ID, origins and IPFS hosting

- RP ID = the origin's effective domain by default, or a registrable domain suffix of it ([REC §RP ID](https://www.w3.org/TR/webauthn-3/#rp-id)). A credential "can only be used for authentication with the same entity (as identified by RP ID) it was registered with" (same source).
- `localhost`: RP ID `localhost`. Its passkeys don't work on any deployed hostname.
- The Public Suffix List decides how far up the RP ID can go. Entries read 2026-11-03 ([PSL](https://publicsuffix.org/list/public_suffix_list.dat)): `*.dweb.link`, `*.inbrowser.link` (IPFS Project), `ipfs.w3s.link`, `ipfs.storacha.link` (Storacha), `ipfs.nftstorage.link`, `cf-ipfs.com`, `*.eth.limo`, `*.eth.link`, `on-fleek.app`, `vercel.app`, `pages.dev`, `netlify.app`, `github.io`. Not on the list: `ipfs.io`, `mypinata.cloud`.

| How the app is served | Origin | RP ID | After a redeploy (new CID) |
|---|---|---|---|
| Path gateway `https://ipfs.io/ipfs/<cid>` | `https://ipfs.io` | `ipfs.io`, shared with every CID on the gateway | Same RP ID, but unsafe: any other CID there can call `get()` with the public salt and derive Sana's keys after one tap, and can read Pata's IndexedDB directly (inferred). IPFS: path gateways "violate the same-origin policy… should not be used for hosting web apps" ([IPFS docs](https://docs.ipfs.tech/concepts/ipfs-gateway/)) |
| Subdomain gateway `https://<cid>.ipfs.dweb.link` | per CID | `<cid>.ipfs.dweb.link`; it can't be widened, because `ipfs.dweb.link` is a public suffix | **New origin and new RP ID: every passkey and every IndexedDB key is orphaned** (inferred from REC + PSL). IPFS: "origin isolation per CID" ([IPFS docs](https://docs.ipfs.tech/concepts/ipfs-gateway/), [subdomain spec §4.3.2](https://specs.ipfs.tech/http-gateways/subdomain-gateway/)) |
| IPNS subdomain `https://<ipns-key>.ipns.dweb.link` | stable while the IPNS key is ours | that hostname | Stable: we republish the IPNS record ([spec](https://specs.ipfs.tech/http-gateways/subdomain-gateway/)) |
| DNSLink, inlined `https://pata-example-com.ipns.dweb.link`, or our own domain `https://pata.example.com` with `_dnslink` TXT | stable | that hostname | Stable: we update the TXT record. DNSLink labels are inlined by replacing `-` with `--` and `.` with `-` ([spec](https://specs.ipfs.tech/http-gateways/subdomain-gateway/)) |
| `https://<name>.eth.limo` | stable | that hostname (`*.eth.limo` is on the PSL) | Stable, but eth.limo resolves mainnet ENS only (inferred; not checked), and Pata's names are on Sepolia |

- Each gateway hostname is a different RP ID. A passkey made at `x.ipns.dweb.link` isn't offered at `x.ipns.inbrowser.link`, or at a local node (inferred from REC).
- Related Origin Requests can bridge origins. Pick one RP ID on a domain we control and serve `https://<rpId>/.well-known/webauthn` as `application/json` with `{"origins":[...]}`. Clients need only support "at least five registrable origin labels" ([REC §5.11](https://www.w3.org/TR/webauthn-3/#sctn-related-origins)). Each `<cid>.ipfs.dweb.link` counts as its own label (`<cid>`), so this covers about five CIDs, and it brings back a dependency on our domain (inferred). Supported in Safari 18.0 ([WebKit](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)); support in Chrome and Firefox wasn't checked.
- **Hosting rule:** serve the household app from one stable hostname (IPNS or DNSLink, ideally on a subdomain gateway listed on the PSL), never from a raw CID URL or a path gateway. Create the demo household (hour 12) on that final hostname. Courier links need no passkey, so they can use any origin.

## Gotchas

- Sign-up can take two biometric prompts (create, then get) when `results` is missing at creation.
- `getClientCapabilities()` keys are `"extension:prf"` in a flat record ([REC §5.1.7](https://www.w3.org/TR/webauthn-3/#sctn-getClientCapabilities)). Yubico's guide checks `caps.extensions?.includes("prf")` after `getClientCapabilities("public-key")` ([Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html)), which doesn't match the spec shape, so don't copy it.
- The same household opened in a WhatsApp in-app browser on Android may run in a WebView, which has no PRF (BCD above). Detect it and ask the user to open the page in Chrome (inferred).
- Third-party providers (1Password, Bitwarden) can take the passkey on Android 14+ and iOS 17+ ([Google](https://developers.google.com/identity/passkeys/supported-environments)); their PRF support varies. Treat `enabled:false` as a normal path.
- **P0 fallback (generated key in IndexedDB), all inferred:**
  - The secp256k1 key can't be a non-extractable `CryptoKey`, since WebCrypto has no such curve.
  - Wrapping it under a non-extractable AES-GCM `CryptoKey` kept in IndexedDB stops casual copying of the stored bytes, but not XSS: a script on the origin can call `decrypt` too.
  - IndexedDB is per origin, so the subdomain-gateway redeploy problem applies. Clearing site data loses the key.
  - Call `navigator.storage.persist()`, and test Safari's storage eviction on the demo iPhone.

## Values to copy

| Name | Value | Source |
|---|---|---|
| Spec | WebAuthn Level 3, W3C Recommendation, 25 Aug 2026 | [REC](https://www.w3.org/TR/2026/REC-webauthn-3-20260825/) |
| Extension id | `prf` | [REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension) |
| PRF output length | 32 bytes | [REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension) |
| Browser-side salt transform | `SHA-256("WebAuthn PRF" ‖ 0x00 ‖ input)` | [REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension) |
| `user.id` length | 1–64 bytes | [REC §5.1.3](https://www.w3.org/TR/webauthn-3/#sctn-createCredential) |
| Capability key | `"extension:prf"` | [REC §5.1.7](https://www.w3.org/TR/webauthn-3/#sctn-getClientCapabilities) |
| Related-origins file | `https://<rpId>/.well-known/webauthn` → `{"origins":[…]}`, `application/json`, at least 5 labels | [REC §5.11](https://www.w3.org/TR/webauthn-3/#sctn-related-origins) |
| WebCrypto EC curves | `P-256`, `P-384`, `P-521` (no secp256k1) | [WebCrypto ED](https://w3c.github.io/webcrypto/) |
| HKDF params | `{name:"HKDF", hash, salt, info}`, all required | [WebCrypto ED](https://w3c.github.io/webcrypto/#hkdf-params) |
| Minimum browsers for PRF | Chrome/Edge 116, Safari 18 (iOS 18), Firefox 139 desktop | [MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/api/CredentialsContainer.json), [WebKit](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) |
| PSL public suffixes for IPFS hosts | `*.dweb.link`, `*.inbrowser.link`, `ipfs.w3s.link`, `ipfs.storacha.link`, `*.eth.limo` | [PSL](https://publicsuffix.org/list/public_suffix_list.dat) |

## Contradictions with idea.md

1. idea.md (Stress test, Q&A): "Her keys come back from her synced passkey on a new phone, with nothing from us." This is only true if the new phone opens the **same RP ID** ("A public key credential can only be used for authentication with the same entity (as identified by RP ID) it was registered with", [REC §RP ID](https://www.w3.org/TR/webauthn-3/#rp-id)). That hostname is something we keep serving: our domain, or our IPNS/DNSLink name. It also needs the same passkey provider. An iCloud Keychain passkey reaches an Android phone only over hybrid with the old iPhone present ([Google](https://developers.google.com/identity/passkeys/supported-environments)). No vendor states that a synced copy returns the same PRF output; the spec ties the PRF to the credential "for the lifetime of the credential" ([REC §10.1.4](https://www.w3.org/TR/webauthn-3/#prf-extension)), so this is likely but must be tested.
2. idea.md (CROPS "C"): "households keep their emancipated names and their Arkiv entities. The app runs from the repo or any IPFS gateway." On any other gateway or origin, the household's passkey isn't offered, so its keys can't be derived (REC §RP ID, above). This holds for courier links, not for households. Say so in the CROPS section, or offer a key export.
3. idea.md (Stack, Hosting): "Static build on IPFS" / "Keeps working if our server goes away." With a CID URL, each redeploy is a new origin ([IPFS docs](https://docs.ipfs.tech/concepts/ipfs-gateway/): "origin isolation per CID"), which orphans every passkey and every P0 IndexedDB key. A stable IPNS or DNSLink hostname is required.
4. idea.md (Risks): "The demo phones' browsers lack the WebAuthn PRF extension." The browser isn't the only factor: the passkey provider decides. Windows Hello and Chrome-profile passkeys lack PRF even in a PRF-capable browser (table above).
5. idea.md (CROPS "S"): "keys come from the household's passkey and stay on the device." This is true, but the secp256k1 key sits as raw bytes in page JavaScript, because WebCrypto has no secp256k1 ([WebCrypto ED](https://w3c.github.io/webcrypto/)). State that trust assumption.

## Test at kick-off

- [ ] On each demo phone and browser, at the final HTTPS hostname: `create()` with `prf.eval`, log `getClientExtensionResults()` (`enabled`? `results`?). Then `get()` twice with the same salt: is `results.first` 32 bytes and identical both times? No first-party public PRF test page was found; Yubico's guide has the code ([Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html)), and third-party demos (passkeyprf.com, Corbado's) are unvetted. A 30-line page of our own is the safer check.
- [ ] Which providers return `results` at `create()` (GPM on Android, iCloud Keychain), to decide whether sign-up needs two prompts.
- [ ] Recovery: the same passkey on a second device of the same ecosystem (second Android with the same Google account; iPad with the same Apple ID) gives the identical `results.first`, and so the same address.
- [ ] Cross-device: desktop Chrome → QR → Android phone, and → iPhone: does `results.first` arrive, and does it match the phone's own value?
- [ ] Windows Hello in Edge or Chrome: confirm `enabled:false`, and that the fallback path runs.
- [ ] The chosen IPNS or DNSLink hostname: a passkey made before a redeploy still works after it.
- [ ] P0 key in IndexedDB survives a browser restart on iOS Safari and as an installed PWA; check `navigator.storage.persist()`.
- [ ] A WebView (link opened from WhatsApp on Android) reports no PRF, and the app tells the user to open it in Chrome.
- [ ] Whether eth.limo serves Sepolia ENS names (expected: no), for `hosting.md`.
