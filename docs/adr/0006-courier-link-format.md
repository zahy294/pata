# Courier link format: one short static route, with everything secret after `#`

A courier link is `https://<short host>/c#1~<household name>~<payload key>~<session key>`. The two keys are base64url, and `~` separates the fields. It never appears in a household label, because labels are restricted at registration to 3–32 characters of lowercase `a-z`, `0-9` and hyphen, with no hyphen at either end and no `--` anywhere. That rule also blocks look-alike names and clears ENS normalisation, which rejects `--` in positions 3–4. The grant's label and owner aren't in the link, because they come from the session key (ADR 0004). The leading `1` versions the format, so links already shared keep working after a change. Once a link is shared, its format can't change, which is why this is recorded.

## Considered options

- **A route per grant:** rejected. A static export would need every grant known at build time.
- **Links on an IPFS gateway URL:** rejected for links. It adds about 60 characters to the link and QR code. IPFS stays the mirror for the "works without us" claim (ADR 0001).
- **Keys only in memory:** rejected. A pull-to-refresh would break the courier view. The keys go in sessionStorage, which is cleared when the grant ends. The `#` part is still removed from the address bar with `history.replaceState`. The browser's history keeps the URL either way, so sessionStorage adds almost no exposure.

## Consequences

- The link is a bearer secret: anyone who sees the message holds the grant. The consent screen and the README say so. There's no second factor.
- The same `#` string is what a requester's `agent-endpoint[web]` receives in P1.
