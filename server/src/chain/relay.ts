// The relay's own transactions. Owner: chain ops (P0-6). Direct RPC is allowed here (CLAUDE.md).
// viem clients for Sepolia and Rabdi from the env RPC URLs; account from RELAY_PRIVATE_KEY.
// Never let a viem error object reach a response or a log: it carries request bodies and the Arkiv key.
import type { Env } from "../env";

export async function topUp(
  env: Env,
  chain: "sepolia" | "arkiv",
  to: `0x${string}`,
): Promise<{ txHash: `0x${string}` | null; balanceWei: bigint }> {
  void env;
  void chain;
  void to;
  throw new Error("topUp: not implemented (P0-6)");
}

/** register(label, owner, grantRegistry, resolver, forever roles, FOREVER_EXPIRY) in pata.eth's registry. */
export async function registerHouseholdName(
  env: Env,
  label: string,
  owner: `0x${string}`,
  resolver: `0x${string}`,
  grantRegistry: `0x${string}`,
): Promise<`0x${string}`> {
  void env;
  void label;
  void owner;
  void resolver;
  void grantRegistry;
  throw new Error("registerHouseholdName: not implemented (P0-6)");
}
