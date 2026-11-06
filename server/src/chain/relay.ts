// The relay's own transactions. Owner: chain ops (P0-6). Direct RPC is allowed here (CLAUDE.md).
// viem clients for Sepolia and Rabdi from the env RPC URLs; account from RELAY_PRIVATE_KEY.
// Never let a viem error object reach a response or a log: it carries request bodies and the Arkiv key.
import type { Env } from "../env";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  labelhash,
  parseAbi,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ENS, FOREVER_EXPIRY, HOUSEHOLD_LABEL_PATTERN, RABDI_CHAIN_ID } from "../../../shared/constants";
import { withKvLock } from "../guard";
import { HOUSEHOLD_NAME_ROLES } from "../../../src/lib/ens/roles";

const registryAbi = parseAbi([
  "function getStatus(uint256 anyId) view returns (uint8)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)",
]);
const factoryAbi = parseAbi(["function verifyContract(address proxy) view returns (address)"]);

const localValues = new WeakMap<
  Env["PATA_KV"],
  Map<string, { value: string | null; expires: number; written: number }>
>();
async function readReservation(env: Env, key: string): Promise<string | null> {
  const entries = localValues.get(env.PATA_KV);
  const entry = entries?.get(key);
  if (entry && entry.expires > Date.now()) return entry.value;
  entries?.delete(key);
  return env.PATA_KV.get(key);
}
async function reserve(env: Env, key: string, value: string | null, ttl?: number): Promise<void> {
  const lastWrite = localValues.get(env.PATA_KV)?.get(key)?.written ?? -Infinity;
  const delay = lastWrite + 1000 - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  if (value === null) await env.PATA_KV.delete(key);
  else await env.PATA_KV.put(key, value, ttl ? { expirationTtl: ttl } : undefined);
  let entries = localValues.get(env.PATA_KV);
  if (!entries) {
    entries = new Map();
    localValues.set(env.PATA_KV, entries);
  }
  for (const [name, entry] of entries) if (entry.expires <= Date.now()) entries.delete(name);
  entries.set(key, { value, expires: ttl ? Date.now() + ttl * 1000 : Infinity, written: Date.now() });
}

export class RelayDailyLimitError extends Error {
  constructor() {
    super("Relay daily top-up limit reached");
  }
}

async function reserveDailyTopup(env: Env, chain: "sepolia" | "arkiv", ip: string): Promise<void> {
  await withKvLock(env, "relay:daily", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const keys = [
      [`topup:daily:${date}:chain:${chain}`, 40],
      [`topup:daily:${date}:ip:${ip}`, 20],
    ] as const;
    const counts: number[] = [];
    for (const [key, cap] of keys) {
      const count = Number((await readReservation(env, key)) ?? 0);
      if (!Number.isSafeInteger(count) || count < 0 || count >= cap) throw new RelayDailyLimitError();
      counts.push(count);
    }
    for (const [index, [key]] of keys.entries()) await reserve(env, key, String(counts[index] + 1), 172800);
  });
}

// Measured 2026-11-06: a full 128 KiB Arkiv create is ~12.9M gas (~0.013 tGLM at ~1 gwei). Setup writes three
// clips and a home record (~0.041 tGLM) and each grant writes one clip plus a batch (~0.014 tGLM).
export const TOPUP_TARGETS = { sepolia: parseEther("0.0005"), arkiv: parseEther("0.1") } as const;

async function clearRegistration(env: Env, key: string): Promise<void> {
  await reserve(env, `${key}:hash`, null);
  await reserve(env, key, null);
}

function clients(env: Env, chain: "sepolia" | "arkiv") {
  const url =
    chain === "sepolia"
      ? env.SEPOLIA_RPC_URL
      : `${env.ARKIV_RPC_URL.replace(/\/$/, "")}/${encodeURIComponent(env.ARKIV_ACCESS_KEY)}`;
  const network =
    chain === "sepolia"
      ? sepolia
      : defineChain({
          id: RABDI_CHAIN_ID,
          name: "Rabdi",
          nativeCurrency: { name: "GLM", symbol: "tGLM", decimals: 18 },
          rpcUrls: { default: { http: [url] } },
          blockTime: 2000,
        });
  const transport = http(url, { retryCount: 0 });
  const account = privateKeyToAccount(env.RELAY_PRIVATE_KEY);
  return {
    publicClient: createPublicClient({ chain: network, transport, ccipRead: false }),
    wallet: createWalletClient({ chain: network, transport, account }),
    account,
  };
}

export async function topUp(
  env: Env,
  chain: "sepolia" | "arkiv",
  to: `0x${string}`,
  ip = "local",
): Promise<{ txHash: `0x${string}` | null; balanceWei: bigint }> {
  try {
    return await withKvLock(env, `relay:${chain}`, async () => {
      const { publicClient, wallet } = clients(env, chain);
      const balanceWei = await publicClient.getBalance({ address: to });
      if (balanceWei >= TOPUP_TARGETS[chain] / 2n) return { txHash: null, balanceWei };
      const key = `topup:${chain}:${to.toLowerCase()}`;
      const previous = await readReservation(env, key);
      if (previous !== null && Date.now() - Number(previous) < 600000) return { txHash: null, balanceWei };
      await reserveDailyTopup(env, chain, ip);
      // Reserve before broadcast: an ambiguous RPC failure must not cause a second payment.
      await reserve(env, key, String(Date.now()), 600);
      const txHash = await wallet.sendTransaction({ to, value: TOPUP_TARGETS[chain] });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 90000,
        pollingInterval: 4000,
      });
      if (receipt.status !== "success") throw new Error();
      return { txHash, balanceWei: await publicClient.getBalance({ address: to }) };
    });
  } catch (failure) {
    if (failure instanceof RelayDailyLimitError) throw failure;
    throw new Error("Gas top-up unavailable");
  }
}

/** register(label, owner, grantRegistry, resolver, forever roles, FOREVER_EXPIRY) in pata.eth's registry. */
export async function registerHouseholdName(
  env: Env,
  label: string,
  owner: `0x${string}`,
  resolver: `0x${string}`,
  grantRegistry: `0x${string}`,
): Promise<`0x${string}` | null> {
  try {
    if (!HOUSEHOLD_LABEL_PATTERN.test(label)) throw new Error();
    return await withKvLock(env, "relay:sepolia", async () => {
      const { publicClient, wallet, account } = clients(env, "sepolia");
      const registry = env.PATA_REGISTRY_ADDRESS as `0x${string}`;
      const key = `register:${registry.toLowerCase()}:${owner.toLowerCase()}`;
      const existing = await readReservation(env, key);
      if (existing !== null) {
        const hash = await readReservation(env, `${key}:hash`);
        const id = BigInt(labelhash(existing));
        const status = await publicClient.readContract({
          address: registry,
          abi: registryAbi,
          functionName: "getStatus",
          args: [id],
        });
        if (status === 2) {
          const registeredOwner = await publicClient.readContract({
            address: registry,
            abi: registryAbi,
            functionName: "getOwner",
            args: [id],
          });
          if (registeredOwner.toLowerCase() !== owner.toLowerCase()) {
            await clearRegistration(env, key);
            throw new Error();
          }
        }
        if (hash) {
          if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error();
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
            timeout: 90000,
            pollingInterval: 4000,
          });
          if (receipt.status === "reverted") await clearRegistration(env, key);
          if (receipt.status !== "success") throw new Error();
        }
        if (!hash && status === 0) {
          // No registration landed: release the old label before considering a new one.
          await reserve(env, key, null);
        } else {
          if (existing !== label) throw new Error();
          if (hash) return hash as `0x${string}`;
          if (status === 2) return null;
          throw new Error();
        }
      }
      const status = await publicClient.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getStatus",
        args: [BigInt(labelhash(label))],
      });
      if (status !== 0) throw new Error();
      for (const [proxy, implementation] of [
        [resolver, ENS.permissionedResolverImpl],
        [grantRegistry, ENS.userRegistryImpl],
      ] as const) {
        const actual = await publicClient.readContract({
          address: ENS.verifiableFactory,
          abi: factoryAbi,
          functionName: "verifyContract",
          args: [proxy],
        });
        if (actual.toLowerCase() !== implementation.toLowerCase()) throw new Error();
      }
      const { request } = await publicClient.simulateContract({
        account,
        address: env.PATA_REGISTRY_ADDRESS as `0x${string}`,
        abi: registryAbi,
        functionName: "register",
        args: [label, owner, grantRegistry, resolver, HOUSEHOLD_NAME_ROLES, FOREVER_EXPIRY],
      });
      // Preserve the intent across uncertain broadcasts. A later request reconciles a
      // missing hash against registry ownership/availability before retrying once.
      await reserve(env, key, label);
      const txHash = await wallet.writeContract(request);
      await reserve(env, `${key}:hash`, txHash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 90000,
        pollingInterval: 4000,
      });
      if (receipt.status === "reverted") await clearRegistration(env, key);
      if (receipt.status !== "success") throw new Error();
      return txHash;
    });
  } catch {
    throw new Error("Name registration unavailable");
  }
}
