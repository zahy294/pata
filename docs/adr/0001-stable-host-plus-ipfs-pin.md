# Serve the app from one stable host, and pin the same build on IPFS

idea.md first planned a static build served from IPFS "through any gateway". We serve the app from one stable free host (Cloudflare Pages) and also pin the same build on IPFS (Pinata, with Filebase as a second pin). The reason is that a passkey only works on the hostname it was made on, and a CID URL becomes a new origin on every deploy. That would orphan every household's passkey and stored key, and break every courier link already shared. Also, the public IPFS gateways (ipfs.io, dweb.link) are retired, and eth.limo serves no Sepolia names.

## Consequences

- The CROPS "C" line can't promise "any gateway". Anyone can run the app from the repo or the pinned CID on their own IPFS node, and courier links work from any copy. A household's passkey works only on the host it signed up on, and the README states that as a trade-off.
- The CROPS video's "server off" moment switches off the small server (Claude, Sarvam, relay), not the static host.
- Sources: `docs/research/hosting.md`, `docs/research/passkeys.md`.
