## Modules

The build is one Next.js static app, one Cloudflare Worker and one contract. Each module below owns one concern; screens call modules, never chains or APIs directly. Terms are from [GLOSSARY.md](../GLOSSARY.md); decisions are in [docs/adr/](adr/).

| Module | Owns | Research |
|---|---|---|
| `digipin` | Encode and decode, India Post v2.0.0, no hyphens. Plain, tested code | [digipin.md](research/digipin.md) |
| `keys` | The household root: random bytes in device storage (P0), the passkey's PRF output (P1). HKDF from the root to one secp256k1 account (same address on both chains) and a non-extractable AES-GCM household key. From a session key: the grant label and the grant's owner account | [passkeys.md](research/passkeys.md) |
| `seal` | AES-GCM encrypt and decrypt of every Arkiv value, with the household key or a session key | [viem.md](research/viem.md) |
| `rpc` | The one Anon-RPC module: the Nox worker, `http(url, { fetchFn: worker.fetch })` clients for Sepolia and Rabdi, `ccipRead: false`, Rabdi polling at 1,000 ms. P0 writes go direct; from P1 they go through Nox. A stalled write: check the receipt by hash, then re-send the same signed bytes directly, and tell the user | [anon-rpc.md](research/anon-rpc.md), [viem.md](research/viem.md) |
| `ens` | Household setup (factory deploys of the household's resolver and grant registry), the locality record, grants (mint, check, `unregister` after a status read), stranger lookup, grid names | [ens-v2.md](research/ens-v2.md) |
| `arkiv` | The four record types, each one `sealed` bytes column and nothing public: `pata.home.v1`, `pata.voice.v1`, `pata.grant.v1`, `pata.history.v1`. Create, patch, delete, extend, owner queries | [arkiv.md](research/arkiv.md) |
| `link` | Format and parse `/c#1~<household name>~<payload key>~<session key>` (ADR 0006) | [nextjs-pwa.md](research/nextjs-pwa.md) |
| `server` (Worker) | `/register`, `/topup`, `/address/extract`, `/address/rank`, `/speech/in`, `/speech/out`. Per-IP limits, household-key signatures, a daily spending cap in KV, a kill switch. No request bodies logged on the address and speech routes | [hosting.md](research/hosting.md), [claude-api.md](research/claude-api.md), [speech.md](research/speech.md), [nominatim-overpass.md](research/nominatim-overpass.md) |
| `map` | MapLibre with the bundled Protomaps extract of Dharavi and BKC, clamped there; candidate and draggable pins; distances from plain code | [maps.md](research/maps.md) |
| `contracts/` | `DigipinResolver`: ENSIP-10 `resolve(bytes,bytes)` that decodes a DIGIPIN label to coordinates. Foundry, `evm_version = "osaka"` | [foundry.md](research/foundry.md) |

## Flows

**Set up a household** (P0; tickets P0-4 to P0-8)
1. Sign in: create the root (P0: random bytes in device storage; P1: passkey PRF). Derive the account and household key.
2. Sana speaks the way to the door and types the room number. The recording goes to `/speech/in` (Sarvam), the transcript to `/address/extract` (Haiku 5.5: locality, PIN code, landmark phrases).
3. The server fetches OSM features inside the locality's bounding box (Nominatim and Overpass, cached in KV) and sends them to `/address/rank` (Sonnet 5.5). The model picks landmarks only from those features and names a relation: at, opposite, behind, near. Code rejects any OSM id not in the set.
4. Code places 3 candidate pins on the street geometry. Confidence shows as low, medium or high. "We're not sure" fires when the top two pins are more than 50 m apart, or when more than one feature in the locality has the landmark's name (P1). No landmark found → a hand-dropped pin.
5. Sana confirms or drags a pin. `digipin` encodes it. The model writes directions from the confirmed pin in Hindi, Marathi and English; `/speech/out` makes one clip each (MP3, 16 kHz, about 20 s).
6. Sana picks a name: a two-word suggestion, or her own after a warning. Labels are 3–32 characters of `a-z`, `0-9` and hyphen, with no hyphen at either end and no `--`. Check availability first.
7. `/topup`, then the household deploys its Permissioned Resolver and grant registry (factory), then `/register` registers the name (owner: the household; forever roles; permanent expiry), then the household writes the locality record.
8. Arkiv: the home record (182 days) and three voice records, all sealed to the household key.

**Approve a grant** (P0; P0-9, P0-10)
1. A request names the requester, purpose, language and duration. The consent screen says "anyone with this link can find your door until it ends".
2. Make a session key. Derive the label and the owner account from it.
3. Grant end = send time + duration + the latency margin measured in hour 0.
4. One Arkiv batch: the payload (requester, purpose, pin, address, directions and the clip in the requester's language, sealed to the session key, `atDate(grantEnd)`) and a history entry ("issued", sealed to the household, read-only, 182 days). Read the payload key from the receipt.
5. Sepolia: `register(label, ownerAddress, 0, 0, roles 0, grantEnd)` in the household's grant registry.
6. Build the courier link; open the share sheet and show a QR code. P1: post the same string to the requester's `agent-endpoint[web]`.

**Open a courier link** (P0; P0-11)
1. Parse the `#` part, save the keys in sessionStorage, remove the `#` part with `history.replaceState`.
2. Show the locality from the household name's ENS record at once.
3. ENS check: the grant's owner (`findExactOwner` on the full name) must equal the address derived from the session key. If not → the locality only.
4. Read the payload by key. Its `$owner` must equal the household name's owner. Missing → expired. Unseal; show the pin on the map and play the clip.
5. Poll both signals. Whichever ends first flips the view to the locality and clears sessionStorage.

**Revoke** (P0; P0-12): read the grant's status; if live, delete the payload on Arkiv and `unregister` on Sepolia, then write a "revoked" history entry. If already expired, there's nothing to do.

**Sign-in upkeep** (P1): extend the home, voice and history records with less than 90 days left.

**Live-access and history** (P1): owner queries on `pata.grant.v1` and `pata.history.v1`, sorted in JS after unsealing.

**Seller proof** (P1): the mock seller signs a challenge with the grant's owner key; anyone checks it against ENS.

**Sana moves** (P2, first): patch the home record and re-seal live payloads with the new pin; expired and revoked ones stay as they were.

## Order of work

- **Hour 0–2:** repo, `pata.eth` and `digipin.eth` registered with the right roles (ADR 0003), the hour-0 tests in [idea.md](../idea.md#team-and-36-hour-plan), `digipin` with tests.
- **By hour 10:** the first household name on Sepolia, through the app.
- **By hour 12:** the demo household on the OnePlus 11 (re-made once P1's passkey keys land).
- **By hour 20:** P0 done.
- **Hours 20–28:** P1, in ticket order; a slipping ticket is cut.
- **Hours 28–34:** README (DHRUVA mapping, CROPS, AI use), `/arkiv/` files, offline kit and service worker, IPFS pin, video.
