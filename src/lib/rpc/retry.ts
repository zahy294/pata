// The stalled-write retry (CLAUDE.md invariant; P1-4, blockchain).
// 1. Sign once. 2. Send through Nox. 3. On timeout, check for a receipt by hash.
// 4. If none, re-send the SAME signed bytes directly (same hash, so no double spend) and
//    call onDirectRetry so the app can tell the user. Never re-sign with a new nonce.

export interface StallRetryOptions {
  /** Called once if the write falls back to a direct send. The UI must show this. */
  onDirectRetry?: () => void;
  timeoutMs?: number;
}

export async function sendSignedWithStallRetry(
  chain: "sepolia" | "arkiv",
  signedTx: `0x${string}`,
  options: StallRetryOptions = {},
): Promise<`0x${string}`> {
  void chain;
  void signedTx;
  void options;
  throw new Error("sendSignedWithStallRetry: not implemented (P1-4)");
}
