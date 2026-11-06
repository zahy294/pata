// The ONE Anon-RPC module (CLAUDE.md invariant). Owner: blockchain (P0-5; writes through Nox are P1-4).
// Read docs/research/anon-rpc.md and docs/research/viem.md first.
//
// - One long-lived AnonRpcWorker (Nox specifier on Sepolia), created lazily in the browser only.
//   Its bootstrap (two specifier reads + bundle download) is the one allowed direct read.
// - Reads: http(url, { fetchFn: worker.fetch, timeout: 30_000, retryCount: 2 }) for both Sepolia and
//   Rabdi, ccipRead: false, Rabdi pollingInterval 1,000 ms. The 30 s timeout outlasts Nox's 25 s call
//   deadline. A read is safe to ask again: on a phone on 2026-11-06 one failed read stopped setup at
//   "getting Sepolia gas" although the relay's top-up had landed.
// - Wallet transports keep retryCount 0: viem must never re-send a call Nox may still deliver
//   (workshop report).
// - warmUpPrivateRpc starts the worker when a page opens, so its 4–25 s bootstrap isn't spent inside
//   the first read's timeout. A worker whose start failed is dropped, and the next read starts another.
// - Writes: direct while env.directWrites (P0), through the worker from P1-4. A stalled write goes
//   through ./retry.ts, never a re-sign.
// - Nothing else in the app may create a viem transport. Screens never import viem clients directly;
//   they call ../ens, ../arkiv or ../flows.
import type { LocalAccount } from "viem/accounts";
import type { PublicClient, WalletClient } from "viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { AnonRpcWorker } from "@anon-rpc/browser-harness";
import {
  createPublicClient as createArkivPublicClient,
  createWalletClient as createArkivWalletClient,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { NOX_SPECIFIER } from "../../../shared/constants";
import { env } from "../env";

let worker: AnonRpcWorker | undefined;
let sepoliaReads: PublicClient | undefined;
let arkivReads: ReturnType<typeof makeArkivPublicClient> | undefined;

type RpcLogEntry = { chain: "sepolia" | "arkiv"; method: string; via: "nox" | "direct"; at: number };
const entries: RpcLogEntry[] = [];

function rpcTransport(
  chain: RpcLogEntry["chain"],
  url: string,
  via: RpcLogEntry["via"],
  use: "reads" | "wallet",
) {
  if (via === "nox") getWorker();
  return http(url, {
    // Looked up per call, so a worker that failed to start is replaced rather than reused.
    fetchFn: via === "nox" ? (input, init) => getWorker().fetch(input, init) : undefined,
    timeout: 30_000,
    retryCount: use === "reads" ? 2 : 0,
    retryDelay: 500,
    onFetchRequest(_request, init) {
      // The body is transient. Retain method names only, never params or URLs.
      const body = JSON.parse(String(init.body));
      for (const call of Array.isArray(body) ? body : [body]) {
        entries.push({ chain, method: call.method, via, at: Date.now() });
      }
    },
  });
}

function arkivUrl(): string {
  const key = env.arkivAccessKey;
  return env.arkivRpcUrl.replace(/\/+$/, "") + (key ? `/${encodeURIComponent(key)}` : "");
}

function makeArkivPublicClient() {
  return createArkivPublicClient({
    chain: rabdi({ accessKey: env.arkivAccessKey }),
    ccipRead: false,
    pollingInterval: 1000,
    transport: rpcTransport("arkiv", arkivUrl(), "nox", "reads"),
  });
}

function getWorker(): AnonRpcWorker {
  if (typeof window === "undefined") throw new Error("Private RPC is only available in the browser");
  if (!worker) {
    const bootstrap = createPublicClient({
      chain: sepolia,
      ccipRead: false,
      transport: rpcTransport("sepolia", env.sepoliaRpcUrl, "direct", "reads"),
    });
    const created = new AnonRpcWorker({
      address: NOX_SPECIFIER,
      config: undefined,
      preExisting: { rpcProvider: { request: (args) => bootstrap.transport.request(args) } },
    });
    worker = created;
    void discardWorkerLogs(created);
    // A caller may construct a client before awaiting readiness. A failed start is dropped, so the
    // next read starts a fresh worker instead of failing for the rest of the visit.
    void created.ready.catch(() => {
      if (worker === created) worker = undefined;
    });
  }
  return worker;
}

/** Starts Nox when a page opens, ahead of its first read. Never throws; reads retry the start. */
export function warmUpPrivateRpc(): void {
  if (typeof window === "undefined") return;
  void anonRpcReady().catch(() => {});
}

async function discardWorkerLogs(instance: AnonRpcWorker): Promise<void> {
  // Claim the stream immediately: unclaimed harness logs are echoed to console.
  try {
    while (true) await instance.acceptLog();
  } catch {
    /* Closed worker. Discard raw errors too. */
  }
}

/** Starts the worker if needed and resolves when it's ready. Safe to call many times. */
export async function anonRpcReady(): Promise<void> {
  const instance = getWorker();
  try {
    await instance.ready;
  } catch {
    throw new Error("Private RPC could not start");
  }
}

export function sepoliaPublicClient(): PublicClient {
  return (sepoliaReads ??= createPublicClient({
    chain: sepolia,
    ccipRead: false,
    transport: rpcTransport("sepolia", env.sepoliaRpcUrl, "nox", "reads"),
  }));
}

export function sepoliaWalletClient(account: LocalAccount): WalletClient {
  return createWalletClient({
    chain: sepolia,
    account,
    ccipRead: false,
    transport: rpcTransport("sepolia", env.sepoliaRpcUrl, env.directWrites ? "direct" : "nox", "wallet"),
  });
}

/** Arkiv SDK public client (createPublicClient from @arkiv-network/sdk) over the worker. */
export function arkivPublicClient() {
  return (arkivReads ??= makeArkivPublicClient());
}

/** Arkiv SDK wallet client for the household or the grant owner. */
export function arkivWalletClient(account: LocalAccount) {
  return createArkivWalletClient({
    chain: rabdi({ accessKey: env.arkivAccessKey }),
    account,
    ccipRead: false,
    pollingInterval: 1000,
    transport: rpcTransport("arkiv", arkivUrl(), env.directWrites ? "direct" : "nox", "wallet"),
  });
}

/** Every method name the worker carried, for the hour-0 test and the CROPS proof. */
export function rpcLog(): {
  chain: "sepolia" | "arkiv";
  method: string;
  via: "nox" | "direct";
  at: number;
}[] {
  return entries.map((entry) => ({ ...entry }));
}
