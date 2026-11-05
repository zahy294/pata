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

function rpcTransport(chain: RpcLogEntry["chain"], url: string, via: RpcLogEntry["via"]) {
  return http(url, {
    fetchFn: via === "nox" ? getWorker().fetch : undefined,
    timeout: 30_000,
    retryCount: 0,
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
    transport: rpcTransport("arkiv", arkivUrl(), "nox"),
  });
}

function getWorker(): AnonRpcWorker {
  if (typeof window === "undefined") throw new Error("Private RPC is only available in the browser");
  if (!worker) {
    const bootstrap = createPublicClient({
      chain: sepolia,
      ccipRead: false,
      transport: rpcTransport("sepolia", env.sepoliaRpcUrl, "direct"),
    });
    worker = new AnonRpcWorker({
      address: NOX_SPECIFIER,
      config: undefined,
      preExisting: { rpcProvider: { request: (args) => bootstrap.transport.request(args) } },
    });
    void discardWorkerLogs(worker);
    // A caller may construct a client before awaiting readiness.
    void worker.ready.catch(() => {});
  }
  return worker;
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
    transport: rpcTransport("sepolia", env.sepoliaRpcUrl, "nox"),
  }));
}

export function sepoliaWalletClient(account: LocalAccount): WalletClient {
  return createWalletClient({
    chain: sepolia,
    account,
    ccipRead: false,
    transport: rpcTransport("sepolia", env.sepoliaRpcUrl, env.directWrites ? "direct" : "nox"),
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
    transport: rpcTransport("arkiv", arkivUrl(), env.directWrites ? "direct" : "nox"),
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
