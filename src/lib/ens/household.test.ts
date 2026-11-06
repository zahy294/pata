import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeEventTopics, encodeAbiParameters, labelhash } from "viem";
import { deriveHouseholdKeys } from "../keys";
import {
  householdLabelStatus,
  deployHouseholdContracts,
  deployRequesterContracts,
  setLocality,
  setRequesterRecords,
} from "./household";
import { dnsEncode } from "./names";
import { permissionedResolverAbi, userRegistryAbi, verifiableFactoryAbi } from "./abis";
import { GRANT_REGISTRY_ROOT_ROLES, RESOLVER_ROOT_ROLES } from "./roles";
import { ENS } from "../../../shared/constants";

const rpc = vi.hoisted(() => ({
  readContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  getCode: vi.fn(),
  getTransactionCount: vi.fn(),
}));
vi.mock("../rpc", () => ({
  sepoliaPublicClient: () => ({
    readContract: rpc.readContract,
    waitForTransactionReceipt: rpc.waitForTransactionReceipt,
    getCode: rpc.getCode,
    getTransactionCount: rpc.getTransactionCount,
  }),
  sepoliaWalletClient: () => ({ writeContract: rpc.writeContract }),
}));

const registry = "0x1111111111111111111111111111111111111111";
const resolver = "0x2222222222222222222222222222222222222222";
const grantRegistry = "0x3333333333333333333333333333333333333333";
const locality = { name: "Dharavi", pinCode: "400017" };

beforeEach(() => {
  vi.resetAllMocks();
  rpc.getTransactionCount.mockResolvedValue(5);
  vi.stubEnv("NEXT_PUBLIC_PATA_REGISTRY", registry);
  rpc.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "predictProxyAddress")
      return args[1] === BigInt("0xcbe12e0426f2abb53e7c3c04acdbbda69bc4682c53c77c89f0f870ab5e0b5fe2")
        ? resolver
        : grantRegistry;
    if (functionName === "verifyContract")
      return args[0] === resolver ? ENS.permissionedResolverImpl : ENS.userRegistryImpl;
  });
});

describe("household ENS setup", () => {
  it("reuses already deployed household proxies only after verifying their implementations", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.getCode.mockResolvedValue("0x6000");
    expect(await deployHouseholdContracts(keys, "sana.pata.eth", locality)).toEqual({
      resolver,
      grantRegistry,
    });
    expect(rpc.writeContract).not.toHaveBeenCalled();
    expect(rpc.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "predictProxyAddress",
        args: [keys.address, expect.any(BigInt)],
      }),
    );
    expect(rpc.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "verifyContract", args: [resolver] }),
    );
  });
  it("fails closed when predicted code belongs to an unexpected implementation", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.getCode.mockResolvedValue("0x6000");
    const normalRead = rpc.readContract.getMockImplementation()!;
    rpc.readContract.mockImplementation(async (request) =>
      request.functionName === "verifyContract" ? registry : normalRead(request),
    );
    await expect(deployHouseholdContracts(keys, "sana.pata.eth", locality)).rejects.toThrow(
      /^Could not deploy household contract$/,
    );
    expect(rpc.writeContract).not.toHaveBeenCalled();
  });
  it("resumes after a resolver deployment without sending that deployment again", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.getCode.mockImplementation(async ({ address }) => (address === resolver ? "0x6000" : undefined));
    rpc.writeContract.mockResolvedValue("0x02");
    rpc.waitForTransactionReceipt.mockImplementation(async () => {
      const [implementation, salt] = rpc.writeContract.mock.calls[0][0].args;
      return {
        status: "success",
        logs: [
          {
            address: ENS.verifiableFactory,
            topics: encodeEventTopics({
              abi: verifiableFactoryAbi,
              eventName: "ProxyDeployed",
              args: { sender: keys.address, proxyAddress: grantRegistry },
            }),
            data: encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [salt, implementation]),
          },
        ],
      };
    });
    expect(await deployHouseholdContracts(keys, "sana.pata.eth", locality)).toEqual({
      resolver,
      grantRegistry,
    });
    expect(rpc.writeContract).toHaveBeenCalledTimes(1);
    expect(rpc.writeContract.mock.calls[0][0].args[0]).toBe(ENS.userRegistryImpl);
  });
  it.each(["reverted", "missing", "wrong factory", "wrong salt"])(
    "rejects a %s deployment receipt without starting the second deploy",
    async (problem) => {
      const keys = await deriveHouseholdKeys(new Uint8Array(32));
      rpc.writeContract.mockResolvedValue("0x01");
      rpc.waitForTransactionReceipt.mockImplementation(async () => {
        const [implementation, salt] = rpc.writeContract.mock.calls[0][0].args;
        return {
          status: problem === "reverted" ? "reverted" : "success",
          logs:
            problem === "missing"
              ? []
              : [
                  {
                    address: problem === "wrong factory" ? registry : ENS.verifiableFactory,
                    topics: encodeEventTopics({
                      abi: verifiableFactoryAbi,
                      eventName: "ProxyDeployed",
                      args: { sender: keys.address, proxyAddress: resolver },
                    }),
                    data: encodeAbiParameters(
                      [{ type: "uint256" }, { type: "address" }],
                      [problem === "wrong salt" ? 0n : salt, implementation],
                    ),
                  },
                ],
        };
      });
      await expect(deployHouseholdContracts(keys, "sana.pata.eth", locality)).rejects.toThrow(
        "Could not deploy household contract",
      );
      expect(rpc.writeContract).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects malformed locality data before writing public records", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    for (const invalid of [
      { name: "", pinCode: "400017" },
      { name: "Dharavi", pinCode: "room 14" },
    ]) {
      await expect(deployHouseholdContracts(keys, "sana.pata.eth", invalid)).rejects.toThrow(
        "Invalid locality",
      );
      await expect(setLocality(keys, { resolver, grantRegistry }, "sana.pata.eth", invalid)).rejects.toThrow(
        "Invalid locality",
      );
    }
    expect(rpc.writeContract).not.toHaveBeenCalled();
  });
  it("does not expose RPC error bodies from name checks or writes", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    const upstream = new Error("private request body and RPC URL");
    rpc.readContract.mockRejectedValue(upstream);
    await expect(householdLabelStatus("sana")).rejects.toThrow(/^Could not check household name$/);
    rpc.writeContract.mockRejectedValue(upstream);
    await expect(deployHouseholdContracts(keys, "sana.pata.eth", locality)).rejects.toThrow(
      /^Could not deploy household contract$/,
    );
    await expect(setLocality(keys, { resolver, grantRegistry }, "sana.pata.eth", locality)).rejects.toThrow(
      /^Could not update locality$/,
    );
  });
  it("updates only the two public locality records and waits for their receipt", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.writeContract.mockResolvedValue("0x03");
    rpc.waitForTransactionReceipt.mockResolvedValue({ status: "success", logs: [] });
    await setLocality(keys, { resolver, grantRegistry }, "sana.pata.eth", locality);
    const call = rpc.writeContract.mock.calls[0][0];
    expect(call.address).toBe(resolver);
    expect(call.functionName).toBe("multicall");
    expect(
      call.args[0].map(
        (data: `0x${string}`) => decodeFunctionData({ abi: permissionedResolverAbi, data }).args,
      ),
    ).toEqual([
      ["0x0473616e6104706174610365746800", "location", "Dharavi, 400017"],
      ["0x0473616e6104706174610365746800", "eth.pata.pincode", "400017"],
    ]);
    expect(rpc.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: "0x03" });
  });
  it("never deploys locality records for the resolver root or a grant name", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    for (const name of ["", "pata.eth", "grant.sana.pata.eth", "sana.other.eth"]) {
      await expect(deployHouseholdContracts(keys, name, locality)).rejects.toThrow("Invalid household name");
    }
    expect(rpc.writeContract).not.toHaveBeenCalled();
  });
  it("deploys the household resolver and revoke-capable registry with locality initialized", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.writeContract.mockResolvedValueOnce("0x01").mockResolvedValueOnce("0x02");
    rpc.waitForTransactionReceipt.mockImplementation(async ({ hash }) => {
      const i = hash === "0x01" ? 0 : 1;
      const [implementation, salt] = rpc.writeContract.mock.calls[i][0].args;
      return {
        status: "success",
        logs: [
          {
            address: ENS.verifiableFactory,
            topics: encodeEventTopics({
              abi: verifiableFactoryAbi,
              eventName: "ProxyDeployed",
              args: { sender: keys.address, proxyAddress: i === 0 ? resolver : grantRegistry },
            }),
            data: encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [salt, implementation]),
          },
        ],
      };
    });
    expect(await deployHouseholdContracts(keys, "sana.pata.eth", locality)).toEqual({
      resolver,
      grantRegistry,
    });
    const [resolverCall, registryCall] = rpc.writeContract.mock.calls.map(([call]) => call);
    // A lagging write node once refilled nonce 0 for the second deploy; the nonces are now numbered here.
    expect([resolverCall.nonce, registryCall.nonce]).toEqual([5, 6]);
    expect(rpc.getTransactionCount).toHaveBeenCalledTimes(1);
    expect(resolverCall.address).toBe(ENS.verifiableFactory);
    expect(resolverCall.functionName).toBe("deployProxy");
    expect(resolverCall.args[0]).toBe(ENS.permissionedResolverImpl);
    expect(resolverCall.args[1]).toBe(0xcbe12e0426f2abb53e7c3c04acdbbda69bc4682c53c77c89f0f870ab5e0b5fe2n);
    const initializer = decodeFunctionData({ abi: permissionedResolverAbi, data: resolverCall.args[2] });
    expect(initializer.functionName).toBe("initialize");
    if (initializer.functionName !== "initialize") throw new Error("Wrong initializer");
    expect(initializer.args[0]).toEqual([{ account: keys.address, roleBitmap: RESOLVER_ROOT_ROLES }]);
    const records = initializer.args[1].map((data) =>
      decodeFunctionData({ abi: permissionedResolverAbi, data }),
    );
    expect(records.map((record) => record.args)).toEqual([
      ["0x0473616e6104706174610365746800", "location", "Dharavi, 400017"],
      ["0x0473616e6104706174610365746800", "eth.pata.pincode", "400017"],
    ]);
    expect(registryCall.args[0]).toBe(ENS.userRegistryImpl);
    expect(registryCall.args[1]).toBe(0x327289979bf4dd5c2669449799d88ae28346dd097cbafdbea394930e109672cfn);
    const registryInit = decodeFunctionData({ abi: userRegistryAbi, data: registryCall.args[2] });
    expect(registryInit.args).toEqual([[{ account: keys.address, roleBitmap: GRANT_REGISTRY_ROOT_ROLES }]]);
  });
  it("rejects an invalid household label before any RPC call", async () => {
    await expect(householdLabelStatus("sana.eth")).rejects.toThrow("Invalid household label");
    expect(rpc.readContract).not.toHaveBeenCalled();
  });
  it("reads a household label status from the configured parent registry by labelhash", async () => {
    rpc.readContract.mockResolvedValue(2);
    expect(await householdLabelStatus("blue-gate")).toBe(2);
    expect(rpc.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: registry,
        functionName: "getStatus",
        args: [BigInt(labelhash("blue-gate"))],
      }),
    );
  });
});

describe("requester names (P1-5, ENSIP-26)", () => {
  const profile = {
    about: "Chai Kart, a demo seller. Asks for your door to deliver an order; never stores it.",
    endpoint: "https://pata.example/seller/",
  };
  function deployedReceipts(keys: { address: `0x${string}` }) {
    rpc.waitForTransactionReceipt.mockImplementation(async ({ hash }) => {
      const i = hash === "0x01" ? 0 : 1;
      const [implementation, salt] = rpc.writeContract.mock.calls[i][0].args;
      return {
        status: "success",
        logs: [
          {
            address: ENS.verifiableFactory,
            topics: encodeEventTopics({
              abi: verifiableFactoryAbi,
              eventName: "ProxyDeployed",
              args: { sender: keys.address, proxyAddress: i === 0 ? resolver : grantRegistry },
            }),
            data: encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [salt, implementation]),
          },
        ],
      };
    });
  }
  it("deploys a requester's resolver with its agent records and no locality", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.writeContract.mockResolvedValueOnce("0x01").mockResolvedValueOnce("0x02");
    deployedReceipts(keys);
    expect(await deployRequesterContracts(keys, "chai-kart.pata.eth", profile)).toEqual({
      resolver,
      grantRegistry,
    });
    const initializer = decodeFunctionData({
      abi: permissionedResolverAbi,
      data: rpc.writeContract.mock.calls[0][0].args[2],
    });
    if (initializer.functionName !== "initialize") throw new Error("Wrong initializer");
    expect(
      initializer.args[1].map((data) => decodeFunctionData({ abi: permissionedResolverAbi, data }).args),
    ).toEqual([
      [dnsEncode("chai-kart.pata.eth"), "agent-context", profile.about],
      [dnsEncode("chai-kart.pata.eth"), "agent-endpoint[web]", profile.endpoint],
    ]);
  });
  it("refuses records a household couldn't safely be shown or sent to, before any RPC", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    for (const bad of [
      { ...profile, about: "  " },
      { ...profile, about: "x".repeat(601) },
      { ...profile, endpoint: "http://pata.example/seller/" },
      { ...profile, endpoint: "javascript:alert(1)" },
      { ...profile, endpoint: "https://user:pass@pata.example/" },
      { ...profile, endpoint: "https://pata.example/seller/#old" },
    ]) {
      await expect(deployRequesterContracts(keys, "chai-kart.pata.eth", bad)).rejects.toThrow(
        "Invalid requester records",
      );
    }
    expect(rpc.readContract).not.toHaveBeenCalled();
    expect(rpc.writeContract).not.toHaveBeenCalled();
  });
  it("allows a plain-http endpoint only on this computer, for local testing", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.getCode.mockResolvedValue("0x6000");
    await expect(
      deployRequesterContracts(keys, "chai-kart.pata.eth", { ...profile, endpoint: "http://localhost:3000/seller/" }),
    ).resolves.toEqual({ resolver, grantRegistry });
  });
  it("rewrites both agent records when the resolver already existed for another name", async () => {
    const keys = await deriveHouseholdKeys(new Uint8Array(32));
    rpc.writeContract.mockResolvedValue("0x03");
    rpc.waitForTransactionReceipt.mockResolvedValue({ status: "success", logs: [] });
    await setRequesterRecords(keys, { resolver, grantRegistry }, "chai-kart.pata.eth", profile);
    const call = rpc.writeContract.mock.calls[0][0];
    expect([call.address, call.functionName]).toEqual([resolver, "multicall"]);
    expect(
      call.args[0].map((data: `0x${string}`) => decodeFunctionData({ abi: permissionedResolverAbi, data }).args[1]),
    ).toEqual(["agent-context", "agent-endpoint[web]"]);
    expect(rpc.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: "0x03" });
  });
});
