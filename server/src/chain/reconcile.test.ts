import { afterEach, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionResult, parseAbi } from "viem";
import { testEnv } from "../test-env";
import { register } from "../routes/register";
import type { RouteContext } from "../env";
import { ENS } from "../../../shared/constants";

const owner = `0x${"22".repeat(20)}` as const;
const resolver = `0x${"33".repeat(20)}` as const;
const grantRegistry = `0x${"44".repeat(20)}` as const;
const hash = `0x${"aa".repeat(32)}` as const;
const abi = parseAbi([
  "function getStatus(uint256 anyId) view returns (uint8)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function verifyContract(address proxy) view returns (address)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)",
]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function reservedContext(): Promise<RouteContext> {
  const env = testEnv();
  await env.PATA_KV.put(`register:${env.PATA_REGISTRY_ADDRESS.toLowerCase()}:${owner}`, "sana");
  return {
    env,
    household: owner,
    ip: "192.0.2.1",
    body: new Uint8Array(new TextEncoder().encode(JSON.stringify({ label: "sana", resolver, grantRegistry })))
      .buffer,
    url: new URL("https://worker.test/register"),
    waitUntil() {},
  };
}

/** Real viem ABI encoding/decoding against a fake HTTP JSON-RPC server. */
function fakeRpc(status: number, registeredOwner: `0x${string}` = owner, failBroadcast = false) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      const request = JSON.parse(String(init?.body));
      let result: unknown;
      if (request.method === "eth_call") {
        const call = decodeFunctionData({ abi, data: request.params[0].data });
        calls.push(call.functionName);
        if (call.functionName === "getStatus")
          result = encodeFunctionResult({ abi, functionName: "getStatus", result: status });
        if (call.functionName === "getOwner")
          result = encodeFunctionResult({ abi, functionName: "getOwner", result: registeredOwner });
        if (call.functionName === "verifyContract")
          result = encodeFunctionResult({
            abi,
            functionName: "verifyContract",
            result: call.args[0] === resolver ? ENS.permissionedResolverImpl : ENS.userRegistryImpl,
          });
        if (call.functionName === "register")
          result = encodeFunctionResult({ abi, functionName: "register", result: 1n });
      }
      if (request.method === "eth_chainId") result = "0xaa36a7";
      if (request.method === "eth_getTransactionCount") result = "0x0";
      if (request.method === "eth_blockNumber") result = "0x100";
      if (request.method === "eth_maxPriorityFeePerGas") result = "0x0";
      if (request.method === "eth_estimateGas") result = "0x30d40";
      if (request.method === "eth_getBlockByNumber")
        result = {
          number: "0x100",
          hash,
          parentHash: hash,
          nonce: "0x0000000000000000",
          sha3Uncles: hash,
          logsBloom: `0x${"00".repeat(256)}`,
          transactionsRoot: hash,
          stateRoot: hash,
          receiptsRoot: hash,
          miner: owner,
          difficulty: "0x0",
          totalDifficulty: "0x0",
          extraData: "0x",
          size: "0x100",
          gasLimit: "0x1c9c380",
          gasUsed: "0x0",
          timestamp: "0x690bd980",
          transactions: [],
          uncles: [],
          baseFeePerGas: "0x3b9aca00",
        };
      if (request.method === "eth_sendRawTransaction") {
        calls.push("eth_sendRawTransaction");
        if (failBroadcast)
          return Response.json({
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32000, message: "private RPC detail" },
          });
        result = hash;
      }
      if (request.method === "eth_getTransactionReceipt")
        result = {
          transactionHash: hash,
          transactionIndex: "0x0",
          blockHash: hash,
          blockNumber: "0x100",
          from: owner,
          to: grantRegistry,
          cumulativeGasUsed: "0x30d40",
          gasUsed: "0x30d40",
          contractAddress: null,
          logs: [],
          logsBloom: `0x${"00".repeat(256)}`,
          status: "0x1",
          type: "0x2",
          effectiveGasPrice: "0x3b9aca00",
        };
      if (request.method === "eth_fillTransaction")
        return Response.json({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "Unsupported method" },
        });
      if (result === undefined) throw new Error(`Unexpected test RPC: ${request.method}`);
      return Response.json({ jsonrpc: "2.0", id: request.id, result });
    }),
  );
  return calls;
}

it("confirms a hashless registration already owned by the household without broadcasting", async () => {
  const ctx = await reservedContext();
  const calls = fakeRpc(2);
  const response = await register(ctx);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ txHash: null });
  expect(calls).toEqual(["getStatus", "getOwner"]);
});

it("clears an available hashless reservation and retries registration once", async () => {
  const ctx = await reservedContext();
  const calls = fakeRpc(0);
  const response = await register(ctx);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ txHash: hash });
  expect(calls.filter((call) => call === "eth_sendRawTransaction")).toHaveLength(1);
  expect(calls.filter((call) => call === "register")).toHaveLength(1);
  expect((await register(ctx)).status).toBe(200);
  expect(calls.filter((call) => call === "eth_sendRawTransaction")).toHaveLength(1);
});

it.each([1, 2])(
  "keeps a hashless reservation blocked when unavailable to this household (status %s)",
  async (status) => {
    const ctx = await reservedContext();
    const calls = fakeRpc(status, resolver);
    const response = await register(ctx);
    expect(response.status).toBe(503);
    expect(calls).not.toContain("eth_sendRawTransaction");
  },
);

it("stops after one failed retry and returns no JSON-RPC details", async () => {
  const ctx = await reservedContext();
  const calls = fakeRpc(0, owner, true);
  const response = await register(ctx);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    code: "relay_unavailable",
    error: "Name registration unavailable",
  });
  expect(calls.filter((call) => call === "eth_sendRawTransaction")).toHaveLength(1);
});
