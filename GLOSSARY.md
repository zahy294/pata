# Pata

Households own an address name and give requesters expiring, revocable access to the exact door. Everyone else sees only the locality.

## Households and their address

**Household**:
The people at one home, acting through one household key. Sana's household is the persona in the demo.
_Avoid_: user, account, customer

**Household name**:
The household's ENS name under a provider, such as `sana.pata.eth`. Its public records show only the locality.
_Avoid_: handle, address handle, username

**Home record**:
The household's exact address, kept encrypted to the household: its DIGIPIN, written address, room or flat number, and directions.
_Avoid_: address record, profile

**Locality**:
The public part of an address: the neighbourhood and PIN code, such as "Dharavi, 400017". It's all a stranger, or a requester after expiry, can see.
_Avoid_: area, region, PIN (alone)

**Way to the door**:
The household's description of how to reach the home, in landmarks, typed at setup ([ADR 0011](docs/adr/0011-setup-takes-a-typed-address-and-the-phone-location.md)). It's the only part of the address the model sees.
_Avoid_: address text, description, prompt

**Directions**:
Step-by-step guidance to the door, written from the confirmed pin in the requester's language, as text the phone reads aloud ([ADR 0010](docs/adr/0010-setup-makes-no-voice-clips.md)).
_Avoid_: instructions, route

**Pin**:
A point on the map for the door. A candidate pin is the AI's proposal; the confirmed pin is the one the household accepts.
_Avoid_: location, marker, coordinates (alone)

**DIGIPIN**:
India Post's 10-character code for a grid cell about 4 m across, such as `39J49LL8T4`.
_Avoid_: digital PIN, grid code

## Consent

**Requester**:
Whoever asks for a household's exact address: a seller, delivery app, courier, ambulance service or AI agent. A requester can have its own ENS name.
_Avoid_: app, client, third party, consumer

**Grant**:
A household's consent for one requester, for one purpose, until one time: an expiring, non-transferable subname with an opaque label, such as `k3f9x2qa.sana.pata.eth`. A grant is live until it expires or is revoked.
_Avoid_: consent token, permission, share, access token

**Payload**:
What one grant unlocks: the requester, the purpose, and the pin, address and directions in the requester's language. It's encrypted to that grant's session key and expires with the grant.
_Avoid_: grant data, blob, package

**Session key**:
The key made for one grant only, which opens that grant's payload. It's wiped when the grant ends.
_Avoid_: grant key, access key, share key

**Grant holder**:
Whoever holds a grant's courier link, and with it the grant's session key and its owner key. Usually the requester, or the courier it passes the link to.
_Avoid_: recipient, grantee, bearer

**Courier link**:
A link that carries one grant to whoever holds it. Everything secret travels in the part after `#`, which browsers never send to a server.
_Avoid_: share link, magic link, delivery link

**Revoke**:
The household ending a grant before its expiry.
_Avoid_: cancel, delete, withdraw

**Live-access list**:
The household's screen of grants that are live right now: "who can find my door".
_Avoid_: dashboard, active shares

**History entry**:
A read-only record, encrypted to the household, that it issued or revoked a grant.
_Avoid_: log, audit record, receipt

## The network

**Provider**:
Whoever runs a registry that issues household names, such as Pata for `pata.eth`. DHRUVA calls this role an Address Information Provider.
_Avoid_: operator, platform, issuer

**Relay**:
The provider's service that tops up households' gas, so they never handle crypto.
_Avoid_: paymaster, sponsor, faucet

**Grid name**:
An ENS name for any DIGIPIN cell, such as `39j49ll8t4.digipin.eth`, which resolves to the cell's coordinates with nothing registered.
_Avoid_: DIGIPIN name, cell name
