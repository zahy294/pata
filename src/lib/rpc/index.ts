// The ONE Anon-RPC module (CLAUDE.md invariant). Owner: blockchain (P0-5; writes through Nox are P1-4).
// Read docs/research/anon-rpc.md and docs/research/viem.md first.
//
// - One long-lived AnonRpcWorker (Nox specifier on Sepolia), created lazily in the browser only.
//   Its bootstrap (two specifier reads + bundle download) is the one allowed direct read.
// - Reads: http(url, { fetchFn: worker.fetch, timeout: 30_000, retryCount: 0 }) for both Sepolia and
//   Rabdi, ccipRead: false, Rabdi pollingInterval 1,000 ms. The 30 s timeout outlasts Nox's 25 s call
//   deadline, and retryCount 0 stops viem re-sending a call Nox may still deliver (workshop report).
// - Writes: direct while env.directWrites (P0), through the worker from P1-4. A stalled write goes
//   through ./retry.ts, never a re-sign.
// - Nothing else in the app may create a viem transport. Screens never import viem clients directly;
//   they call ../ens, ../arkiv or ../flows.
import type { LocalAccount } from "viem/accounts";
import type { PublicClient, WalletClient } from "viem";

/** Starts the worker if needed and resolves when it's ready. Safe to call many times. */
export async function anonRpcReady(): Promise<void> {
  throw new Error("anonRpcReady: not implemented (P0-5)");
}

export function sepoliaPublicClient(): PublicClient {
  throw new Error("sepoliaPublicClient: not implemented (P0-5)");
}

export function sepoliaWalletClient(account: LocalAccount): WalletClient {
  void account;
  throw new Error("sepoliaWalletClient: not implemented (P0-5)");
}

/** Arkiv SDK public client (createPublicClient from @arkiv-network/sdk) over the worker. */
export function arkivPublicClient(): unknown {
  throw new Error("arkivPublicClient: not implemented (P0-5)");
}

/** Arkiv SDK wallet client for the household or the grant owner. */
export function arkivWalletClient(account: LocalAccount): unknown {
  void account;
  throw new Error("arkivWalletClient: not implemented (P0-5)");
}

/** Every method name the worker carried, for the hour-0 test and the CROPS proof. */
export function rpcLog(): {
  chain: "sepolia" | "arkiv";
  method: string;
  via: "nox" | "direct";
  at: number;
}[] {
  throw new Error("rpcLog: not implemented (P0-5)");
}
