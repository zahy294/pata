# The courier link reaches a requester through its page's `#`, never in a request body

## Context

P1-5 gives a requester its own name under `pata.eth` with ENSIP-26 records: `agent-context` (who it is) and `agent-endpoint[web]` (its page). The ticket said the consent screen should "post" the courier link to that endpoint. The link carries the grant's session key ([ADR 0006](0006-courier-link-format.md)). A POST would put that key in a request body that the requester's server, any proxy in front of it and its logs can keep. It would also make the household's phone send a cross-origin request to whatever URL a name lists, which CORS blocks for an ordinary page anyway. Our app is a static export, so the demo seller has no server to receive a POST.

## Decision

The consent screen hands the link over by opening `agent-endpoint[web]#<courier fragment>`, which is the same `1~household~payload~session` string a courier link carries after `#`. Browsers never send the `#` part to a server. The requester's page reads it in the browser, as the courier view does, and clears it from the address bar.

- The screen reads the requester's records itself (`checkRequester`) and shows its `agent-context` and the endpoint's host before the household approves. A name with no `agent-context` gets a warning that anyone could have sent the request.
- It offers the hand-off only to an endpoint that is `https:` (or plain `http:` on `localhost`), with no credentials and no existing fragment (`isSafeRequesterEndpoint`). Otherwise the household can still share the link by hand.
- The demo seller keeps received links in `sessionStorage` only, like the courier view.
- Whoever holds the link can prove it to a third party by signing that party's challenge with the grant's owner key (`proveGrantHolder`). Anyone can check the signature against the grant's owner in the household's registry (`verifyGrantProof`), without seeing the address.

## Consequences

- No server, ours or the requester's, receives the session key in a request. A real requester's page can still forward the link to its own backend; holding the link is what the household consented to.
- The household sees where the link goes before it's sent, and the destination is the one the requester's public name lists, not one the request names. A request can claim any `ensName`, but the hand-off can only reach the page that name publishes.
- It works with a static page and no server, so the demo seller is just `/seller`.
- ENSIP-26 is still a draft. We use its `web` protocol as written and our own wording in `agent-context`.
