import { beforeEach, expect, it, vi } from "vitest";
import { deriveHouseholdKeys } from "../keys";
import { mintGrant, sepoliaNow } from "./grants";
import { ContractFunctionRevertedError, encodeErrorResult, parseAbi } from "viem";
const errorAbi = parseAbi(["error CannotSetPastExpiry(uint64 expiry)"]);
function expired() {
  return new ContractFunctionRevertedError({
    abi: errorAbi,
    functionName: "register",
    data: encodeErrorResult({ abi: errorAbi, errorName: "CannotSetPastExpiry", args: [1050n] }),
  });
}

const rpc = vi.hoisted(() => ({
  getBlock: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  simulateContract: vi.fn(),
}));
vi.mock("../rpc", () => ({ sepoliaPublicClient: () => rpc, sepoliaWalletClient: () => rpc }));
const contracts = {
  resolver: "0x2222222222222222222222222222222222222222",
  grantRegistry: "0x3333333333333333333333333333333333333333",
} as const;
const owner = "0x4444444444444444444444444444444444444444";
beforeEach(() => {
  vi.resetAllMocks();
  rpc.getBlock.mockResolvedValue({ timestamp: 1000n });
  rpc.writeContract.mockResolvedValue("0x01");
  rpc.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
});

it("reads time from the latest Sepolia block", async () => {
  expect(await sepoliaNow()).toBe(1000);
  expect(rpc.getBlock).toHaveBeenCalledWith({ blockTag: "latest" });
});

it("mints an opaque grant to its one-time owner with no resolver, subregistry or roles", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  expect(await mintGrant(keys, contracts, "abcdefgh", owner, 1050)).toBe("0x01");
  expect(rpc.writeContract).toHaveBeenCalledWith(
    expect.objectContaining({
      address: contracts.grantRegistry,
      functionName: "register",
      args: [
        "abcdefgh",
        owner,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0n,
        1050n,
      ],
    }),
  );
  expect(rpc.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: "0x01" });
});

it("retries only the decoded past-expiry revert once, using fresh Sepolia time", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  rpc.getBlock.mockResolvedValueOnce({ timestamp: 1000n }).mockResolvedValueOnce({ timestamp: 1060n });
  rpc.writeContract.mockRejectedValueOnce(expired()).mockResolvedValueOnce("0x02");
  expect(await mintGrant(keys, contracts, "abcdefgh", owner, 1050)).toBe("0x02");
  expect(rpc.writeContract.mock.calls.map(([request]) => request.args[5])).toEqual([1050n, 1110n]);
});

it("does not retry an uncertain send or an error string that only mentions the expiry error", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  rpc.writeContract.mockRejectedValue(new Error("CannotSetPastExpiry: private URL and request"));
  await expect(mintGrant(keys, contracts, "abcdefgh", owner, 1050)).rejects.toThrow(/^Could not mint grant$/);
  expect(rpc.writeContract).toHaveBeenCalledTimes(1);
});

it("never retries a second past-expiry revert", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  rpc.writeContract.mockRejectedValue(expired());
  await expect(mintGrant(keys, contracts, "abcdefgh", owner, 1050)).rejects.toThrow(/^Could not mint grant$/);
  expect(rpc.writeContract).toHaveBeenCalledTimes(2);
});

it("awaits the caller's refreshed batch deadline before the single retry", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  let refreshed = false;
  rpc.writeContract.mockRejectedValueOnce(expired()).mockImplementationOnce(async ({ args }) => {
    expect(refreshed).toBe(true);
    expect(args[5]).toBe(1200n);
    return "0x02";
  });
  expect(
    await mintGrant(keys, contracts, "abcdefgh", owner, 1050, {
      refreshGrantEnd: async () => {
        refreshed = true;
        return 1200;
      },
    }),
  ).toBe("0x02");
});

it("classifies a mined revert by simulation before deciding whether to retry", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  rpc.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
  rpc.simulateContract.mockRejectedValueOnce(expired());
  expect(await mintGrant(keys, contracts, "abcdefgh", owner, 1050)).toBe("0x01");
  expect(rpc.simulateContract).toHaveBeenCalledTimes(1);
  expect(rpc.writeContract).toHaveBeenCalledTimes(2);
});
