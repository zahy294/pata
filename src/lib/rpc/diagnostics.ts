// Opt-in read-only hour-0 probe. Contains no development wallet or secret-file access.
import { labelhash, parseAbi, zeroAddress } from "viem";
import { ENS, RABDI_CHAIN_ID, SEPOLIA_CHAIN_ID } from "../../../shared/constants";
import { env } from "../env";
import { anonRpcReady, arkivPublicClient, rpcLog, sepoliaPublicClient } from "./index";

export interface RpcReadCheck {
  name: string;
  ok: boolean;
  elapsedMs: number;
  value?: number;
  message?: string;
}

export interface RpcReadReport {
  checkedAt: string;
  accessKeyConfigured: boolean;
  checks: RpcReadCheck[];
  methods: ReturnType<typeof rpcLog>;
}

export async function runRpcReadChecks(): Promise<RpcReadReport> {
  const checks: RpcReadCheck[] = [];
  const logStart = rpcLog().length;
  async function check(name: string, run: () => Promise<number | void>): Promise<boolean> {
    const start = performance.now();
    try {
      const value = await run();
      checks.push({
        name,
        ok: true,
        elapsedMs: Math.round(performance.now() - start),
        ...(value === undefined ? {} : { value }),
      });
      return true;
    } catch {
      // viem errors include request bodies and key-bearing URLs. Never render them.
      checks.push({
        name,
        ok: false,
        elapsedMs: Math.round(performance.now() - start),
        message: "Private RPC check failed",
      });
      return false;
    }
  }
  if (await check("Nox ready", anonRpcReady)) {
    await check("Sepolia chain ID", async () => {
      const id = await sepoliaPublicClient().getChainId();
      if (id !== SEPOLIA_CHAIN_ID) throw new Error("Wrong chain");
      return id;
    });
    await check("ENS registry status", () =>
      sepoliaPublicClient().readContract({
        address: ENS.ethRegistry,
        abi: parseAbi(["function getStatus(uint256 anyId) view returns (uint8)"]),
        functionName: "getStatus",
        args: [BigInt(labelhash("pata"))],
      }),
    );
    await check("Rabdi chain ID", async () => {
      const id = await arkivPublicClient().getChainId();
      if (id !== RABDI_CHAIN_ID) throw new Error("Wrong chain");
      return id;
    });
    await check("Arkiv owner query", async () => {
      const page = await arkivPublicClient().select({ $key: true }).ownedBy(zeroAddress).limit(1).fetch();
      return page.entities.length;
    });
  }
  return {
    checkedAt: new Date().toISOString(),
    accessKeyConfigured: Boolean(env.arkivAccessKey),
    checks,
    methods: rpcLog().slice(logStart),
  };
}
