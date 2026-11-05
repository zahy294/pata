# Expiry is a public, honest-client switch, not cryptographic enforcement

A judge will find this, so the pitch says it first. A grant holder keeps the session key, and a payload stays readable from Arkiv while it's live (and from chain history afterwards). Expiry can't take back what a holder could already read. What ENS gives is a public, verifiable record of consent, and a switch that honest clients obey: the courier view, the seller's integration and anyone auditing a requester check the grant's status in ENS. The structural claims are:
- only a grant holder can ever read the exact door, and no chain, RPC or server of ours sees it;
- a grant gives access to the household's current door, and expiry or revocation stops future access.

We rejected serving payloads through our server so it could refuse after expiry, because that would make Pata a custodian and break the CROPS claim that courier links work with our server off.

## Consequences

- The pitch drops "an expiring key, never a copy".
- "Sana moves" (patch the home record, re-encrypt live payloads only) is what makes the current-door claim visible. It's the first P2 ticket.
