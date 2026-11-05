import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import { testEnv } from "../test-env";
import { registerHouseholdName, topUp } from "./relay";
import { ENS, FOREVER_EXPIRY } from "../../../shared/constants";
import { HOUSEHOLD_NAME_ROLES } from "../../../src/lib/ens/roles";
import { topup } from "../routes/topup";
import { register } from "../routes/register";
import type { RouteContext } from "../env";

// External chain SDK boundary: real relay logic, no broadcasts or funded keys.
const chain = vi.hoisted(() => ({
  getBalance: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  sendTransaction: vi.fn(),
  writeContract: vi.fn(),
}));
vi.mock("viem", async (original) => ({
  ...(await original<typeof import("viem")>()),
  createPublicClient: vi.fn(() => chain),
  createWalletClient: vi.fn(() => chain),
}));
const household = `0x${"22".repeat(20)}` as const;
const hash = `0x${"aa".repeat(32)}` as const;
const resolver = `0x${"33".repeat(20)}` as const;
const grantRegistry = `0x${"44".repeat(20)}` as const;
function context(body: unknown): RouteContext {
  return {
    env: testEnv(),
    household,
    body: new Uint8Array(new TextEncoder().encode(JSON.stringify(body))).buffer,
    url: new URL("https://worker.test"),
    waitUntil() {},
  };
}

it("topup route validates the chain and returns decimal balance for the signing household", async () => {
  const response = await topup(context({ chain: "arkiv" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ txHash: hash, balanceWei: "0" });
  expect(chain.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ to: household }));
  expect((await topup(context({ chain: "mainnet" }))).status).toBe(400);
});

it("register route validates inputs and always assigns the name to the signer", async () => {
  const response = await register(context({ label: "sana", resolver, grantRegistry, owner: resolver }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ txHash: hash });
  expect(chain.writeContract).toHaveBeenCalledWith(
    expect.objectContaining({
      args: ["sana", household, grantRegistry, resolver, HOUSEHOLD_NAME_ROLES, FOREVER_EXPIRY],
    }),
  );
  expect((await register(context({ label: "BAD", resolver, grantRegistry }))).status).toBe(400);
  expect((await register(context({ label: "sana", resolver: "bad", grantRegistry }))).status).toBe(400);
});

beforeEach(() => {
  vi.resetAllMocks();
  chain.getBalance.mockResolvedValue(0n);
  chain.sendTransaction.mockResolvedValue(hash);
  chain.writeContract.mockResolvedValue(hash);
  chain.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
  chain.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "getStatus") return 0;
    if (functionName === "verifyContract")
      return args[0] === resolver ? ENS.permissionedResolverImpl : ENS.userRegistryImpl;
    throw new Error("Unexpected chain read");
  });
  chain.simulateContract.mockImplementation(async (request) => ({ request }));
});

it("registers a forever household name with the household as owner", async () => {
  const env = testEnv();
  expect(await registerHouseholdName(env, "sana", household, resolver, grantRegistry)).toBe(hash);
  expect(chain.writeContract).toHaveBeenCalledWith(
    expect.objectContaining({
      address: env.PATA_REGISTRY_ADDRESS,
      functionName: "register",
      args: ["sana", household, grantRegistry, resolver, HOUSEHOLD_NAME_ROLES, FOREVER_EXPIRY],
    }),
  );
  expect(chain.waitForTransactionReceipt).toHaveBeenCalledWith({
    hash,
    timeout: 90000,
    pollingInterval: 4000,
  });
});

it.each([1, 2])("refuses reserved or registered labels (status %s)", async (status) => {
  chain.readContract.mockResolvedValue(status);
  await expect(registerHouseholdName(testEnv(), "sana", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
  expect(chain.writeContract).not.toHaveBeenCalled();
});

it.each([resolver, grantRegistry])("refuses an unverified proxy %s", async (invalid) => {
  chain.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "getStatus") return 0;
    if (args[0] === invalid) return `0x${"00".repeat(20)}`;
    return args[0] === resolver ? ENS.permissionedResolverImpl : ENS.userRegistryImpl;
  });
  await expect(registerHouseholdName(testEnv(), "sana", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
  expect(chain.writeContract).not.toHaveBeenCalled();
});

it("registers only one name per household and returns the receipt for a retry", async () => {
  const env = testEnv();
  expect(await registerHouseholdName(env, "sana", household, resolver, grantRegistry)).toBe(hash);
  expect(await registerHouseholdName(env, "sana", household, resolver, grantRegistry)).toBe(hash);
  await expect(registerHouseholdName(env, "other", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
  expect(chain.writeContract).toHaveBeenCalledTimes(1);
});

it("hides registration failures and never broadcasts another name after an uncertain write", async () => {
  const env = testEnv();
  chain.writeContract.mockRejectedValueOnce(new Error("SECRET_RPC_BODY_AND_KEY"));
  await expect(registerHouseholdName(env, "sana", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
  await expect(registerHouseholdName(env, "other", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
  expect(chain.writeContract).toHaveBeenCalledTimes(1);
});

it("refuses to report a reverted registration as successful", async () => {
  chain.waitForTransactionReceipt.mockResolvedValue({ status: "reverted" });
  await expect(registerHouseholdName(testEnv(), "sana", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
});

it("uses env RPC URLs for Sepolia and keyed Rabdi", async () => {
  const { createPublicClient } = await import("viem");
  await topUp(testEnv(), "sepolia", household);
  await topUp(testEnv(), "arkiv", household);
  const configs = vi.mocked(createPublicClient).mock.calls.map(([config]) => config!);
  expect(configs.map((config) => config.chain?.id)).toEqual([11155111, 7794095]);
  expect(configs.map((config) => config.transport({ chain: config.chain }).value?.url)).toEqual([
    "https://sepolia.example",
    "https://arkiv.example/test-key",
  ]);
});

it("retains local reservations when KV reads are temporarily stale", async () => {
  const env = testEnv();
  env.PATA_KV.get = vi.fn().mockResolvedValue(null);
  await topUp(env, "sepolia", household);
  expect((await topUp(env, "sepolia", household)).txHash).toBeNull();
  await registerHouseholdName(env, "sana", household, resolver, grantRegistry);
  await expect(registerHouseholdName(env, "other", household, resolver, grantRegistry)).rejects.toThrow(
    /^Name registration unavailable$/,
  );
});
afterEach(() => {
  vi.useRealTimers();
});

it.each(["ab", "Sana", "a--b", "-sana", "sana-", "a".repeat(33), "sana~x"])(
  "refuses invalid household label %s before RPC",
  async (label) => {
    await expect(registerHouseholdName(testEnv(), label, household, resolver, grantRegistry)).rejects.toThrow(
      /^Name registration unavailable$/,
    );
    expect(chain.readContract).not.toHaveBeenCalled();
    expect(chain.writeContract).not.toHaveBeenCalled();
  },
);

it("sends the fixed Sepolia top-up and waits until it is spendable", async () => {
  chain.getBalance.mockResolvedValueOnce(parseEther("0.0001")).mockResolvedValueOnce(parseEther("0.0021"));
  expect(await topUp(testEnv(), "sepolia", household)).toEqual({
    txHash: hash,
    balanceWei: parseEther("0.0021"),
  });
  expect(chain.sendTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ to: household, value: 2000000000000000n }),
  );
  expect(chain.waitForTransactionReceipt).toHaveBeenCalledWith({
    hash,
    timeout: 90000,
    pollingInterval: 4000,
  });
});

it.each(["sepolia", "arkiv"] as const)("skips %s at or above half target", async (network) => {
  const balance = network === "sepolia" ? 1000000000000000n : 100000000000000000n;
  chain.getBalance.mockResolvedValue(balance);
  expect(await topUp(testEnv(), network, household)).toEqual({ txHash: null, balanceWei: balance });
  expect(chain.sendTransaction).not.toHaveBeenCalled();
});

it("limits concurrent top-ups to one per household and chain for 10 minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
  const env = testEnv();
  const results = await Promise.all([topUp(env, "sepolia", household), topUp(env, "sepolia", household)]);
  expect(results.map((r) => r.txHash)).toEqual([hash, null]);
  expect((await topUp(env, "arkiv", household)).txHash).toBe(hash);
  expect(chain.sendTransaction).toHaveBeenLastCalledWith(
    expect.objectContaining({ value: 200000000000000000n }),
  );
  vi.setSystemTime(Date.now() + 599000);
  expect((await topUp(env, "sepolia", household)).txHash).toBeNull();
  vi.setSystemTime(Date.now() + 1000);
  expect((await topUp(env, "sepolia", household)).txHash).toBe(hash);
});

it("rejects reverted receipts and hides RPC errors, retaining the cooldown after an ambiguous send", async () => {
  chain.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
  await expect(topUp(testEnv(), "arkiv", household)).rejects.toThrow(/^Gas top-up unavailable$/);
  const env = testEnv();
  chain.sendTransaction.mockRejectedValueOnce(new Error("SECRET_RPC_BODY_AND_KEY"));
  await expect(topUp(env, "arkiv", household)).rejects.toThrow(/^Gas top-up unavailable$/);
  expect((await topUp(env, "arkiv", household)).txHash).toBeNull();
});
