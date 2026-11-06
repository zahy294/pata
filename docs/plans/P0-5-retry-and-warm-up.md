# P0-5 follow-up: Nox reads retry, and every page starts Nox when it opens

2026-11-07, after the OnePlus setup failure of 2026-11-06 at 23:35 IST.

## Evidence

- On the phone, setup stopped "while getting Sepolia gas", and the name check showed "Retry check".
- Chain record: the relay's top-up to that household (`0x50e926…`, 0.0005 ETH, 23:35:36 IST) succeeded, and the household's nonce stayed 0. So the server side worked, and the phone's own read of the funding receipt failed.
- viem's `waitForTransactionReceipt` rejects on the first read error that isn't "not found yet". Each Nox read had a 30 s timeout and `retryCount: 0`, and the first read also waited for the worker's bootstrap, which took 4–25 s on desktop. One slow or failed read was enough.
- The phone's own diagnostics later passed (Nox ready 3.8 s, reads about 2 s), so the failure was intermittent rather than a blocked network.

## Change

- Public (read) transports retry twice, 500 ms apart. Wallet transports keep `retryCount: 0`, because a write must never be re-sent ([`src/lib/rpc/index.ts`](../../src/lib/rpc/index.ts)).
- `warmUpPrivateRpc` starts the worker from the root layout when any page opens (`src/components/PrivateRpcWarmUp.tsx`).
- A worker whose start failed is dropped, and the next read starts a fresh one, instead of every read failing until a reload.

## Tests (seam: the RPC clients)

- A read that fails once through Nox succeeds on the retry; one that keeps failing is tried 3 times and never falls back to a direct read.
- A write through Nox that fails is sent once.
- The warm-up never throws, and a failed start is replaced on the next read.

## Result

On localhost against live chains, the name check took 0.75 s (25.8 s on the live build earlier that night), and `/lookup?debug=1` reported "Nox ready" in 1.1 s, against 6–24 s before. A full setup took about 72 s.

An apparent local reproduction of the phone failure turned out to be a missing `NEXT_PUBLIC_SEPOLIA_RPC_URL` in the worktree, not Nox. Local runs now pass the public values the live app ships.
