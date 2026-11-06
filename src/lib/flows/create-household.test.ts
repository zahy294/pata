import { beforeEach, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, hexToBytes } from "viem";
import { deriveHouseholdKeys } from "../keys";
import { openJson } from "../seal";
import { createHousehold, type NewHousehold } from "./setup-household";
import { ENS } from "../../../shared/constants";
import { verifiableFactoryAbi } from "../ens/abis";

const io = vi.hoisted(() => ({
  loadDeviceRoot: vi.fn(),
  saveDeviceRoot: vi.fn(),
  loadHouseholdState: vi.fn(),
  saveHouseholdState: vi.fn(),
  loadSetupCheckpoint: vi.fn(),
  saveSetupCheckpoint: vi.fn(),
  topup: vi.fn(),
  registerName: vi.fn(),
  readContract: vi.fn(),
  owner: vi.fn(),
  getCode: vi.fn(),
  getEnsText: vi.fn(),
  waitReceipt: vi.fn(),
  writeContract: vi.fn(),
  createEntity: vi.fn(),
}));
vi.mock("../keys/store", () => io);
vi.mock("../server-client", () => ({ topup: io.topup, registerName: io.registerName }));
// AI/ML-owned dependency is still a stub in this checkout. Its independent canonical vector is the fixture.
vi.mock("../digipin", () => ({ encodeDigipin: () => "39J49LL8T4" }));
vi.mock("../rpc", () => ({
  sepoliaPublicClient: () => ({
    readContract: io.readContract,
    getCode: io.getCode,
    getEnsText: io.getEnsText,
    waitForTransactionReceipt: io.waitReceipt,
  }),
  sepoliaWalletClient: () => ({ writeContract: io.writeContract }),
  arkivPublicClient: () => ({ waitForTransactionReceipt: io.waitReceipt }),
  arkivWalletClient: () => ({ createEntity: io.createEntity }),
}));
const resolver = "0x2222222222222222222222222222222222222222";
const grantRegistry = "0x3333333333333333333333333333333333333333";
const entityKey = `0x${"ab".repeat(32)}` as const;
const input: NewHousehold = {
  label: "sana",
  locality: { name: "Dharavi", pinCode: "400017" },
  confirmedPin: { lat: 28.622788, lon: 77.213033 },
  roomNumber: "private-room-731",
  writtenAddress: "private test address",
  directions: { en: "Private door instructions", hi: "हिंदी", mr: "मराठी" },
  voiceKeys: { en: entityKey, hi: entityKey, mr: entityKey },
  candidates: [],
};
let saved: unknown;
let checkpoint: unknown;
beforeEach(async () => {
  vi.resetAllMocks();
  saved = null;
  checkpoint = null;
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.loadHouseholdState.mockImplementation(async () => saved);
  io.saveHouseholdState.mockImplementation(async (state) => {
    saved = structuredClone(state);
  });
  io.loadSetupCheckpoint.mockImplementation(async () => structuredClone(checkpoint));
  io.saveSetupCheckpoint.mockImplementation(async (_address, value) => {
    checkpoint = structuredClone(value);
  });
  io.topup.mockResolvedValue({ txHash: null, balanceWei: "100000000000000000" });
  io.registerName.mockResolvedValue({ txHash: "0x99" });
  io.owner.mockResolvedValue(keys.address);
  io.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "predictProxyAddress")
      return args[1] === BigInt("0xcbe12e0426f2abb53e7c3c04acdbbda69bc4682c53c77c89f0f870ab5e0b5fe2")
        ? resolver
        : grantRegistry;
    if (functionName === "verifyContract")
      return args[0] === resolver ? ENS.permissionedResolverImpl : ENS.userRegistryImpl;
    return io.owner();
  });
  io.getEnsText.mockImplementation(async ({ key }) => (key === "location" ? "Dharavi, 400017" : "400017"));
  io.writeContract.mockResolvedValueOnce("0x01").mockResolvedValueOnce("0x02");
  io.waitReceipt.mockImplementation(async ({ hash }) => {
    if (hash === "0x99") return { status: "success", logs: [] };
    const i = hash === "0x01" ? 0 : 1;
    const [implementation, salt] = io.writeContract.mock.calls[i][0].args;
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
  io.createEntity.mockResolvedValue({ entityKey });
});

it("resumes a failed final save without deploying, registering or creating a second home", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.saveHouseholdState.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(createHousehold(keys, input)).rejects.toThrow();
  const state = await createHousehold(keys, input);
  expect(state.homeRecordKey).toBe(entityKey);
  expect(io.writeContract).toHaveBeenCalledTimes(2);
  expect(io.registerName).toHaveBeenCalledTimes(1);
  expect(io.createEntity).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(checkpoint)).not.toContain(input.roomNumber);
});

it("does not send a second home create when the first write's outcome is uncertain", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.createEntity.mockRejectedValue(new Error("lost response after send; private URL"));
  await expect(createHousehold(keys, input)).rejects.toThrow();
  await expect(createHousehold(keys, input)).rejects.toThrow("needs transaction verification");
  expect(io.createEntity).toHaveBeenCalledTimes(1);
  expect(saved).toBeNull();
});

it("rejects invalid names and locality before asking the relay for funds", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  for (const invalid of [
    { ...input, label: "bad--name" },
    { ...input, locality: { name: "", pinCode: "123" } },
  ])
    await expect(createHousehold(keys, invalid)).rejects.toThrow("Invalid household details");
  expect(io.topup).not.toHaveBeenCalled();
});

it("never exposes relay errors containing request bodies or URLs", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.topup.mockRejectedValueOnce(new Error("SECRET_REQUEST_BODY_AND_URL"));
  await expect(createHousehold(keys, input)).rejects.toThrow(/^Could not fund household on sepolia$/);
});

it("sanitizes registration failures and stops a retry from repeating an uncertain registration", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.registerName.mockRejectedValue(new Error("SECRET_REQUEST_BODY_AND_URL"));
  await expect(createHousehold(keys, input)).rejects.toThrow(/^Could not register household name$/);
  await expect(createHousehold(keys, input)).rejects.toThrow("needs transaction verification");
  expect(io.registerName).toHaveBeenCalledTimes(1);
});

it("rechecks a known registration transaction after a receipt timeout without requesting another registration", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const normalReceipt = io.waitReceipt.getMockImplementation()!;
  let timedOut = false;
  io.waitReceipt.mockImplementation(async (request) => {
    if (request.hash === "0x99" && !timedOut) {
      timedOut = true;
      throw new Error("SECRET_RPC_URL");
    }
    return normalReceipt(request);
  });
  await expect(createHousehold(keys, input)).rejects.toThrow(/^Could not confirm household transaction$/);
  expect((await createHousehold(keys, input)).name).toBe("sana.pata.eth");
  expect(io.registerName).toHaveBeenCalledTimes(1);
});

it("waits for the household's owner and both locality records to resolve before writing its home", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.owner.mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
  io.getEnsText.mockResolvedValueOnce(null);
  expect((await createHousehold(keys, input)).name).toBe("sana.pata.eth");
  expect(
    io.getEnsText.mock.calls.every(([request]) => request.universalResolverAddress === ENS.universalResolver),
  ).toBe(true);
});

it("can retry a failed resolution check without repeating chain writes", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.owner.mockRejectedValue(new Error("SECRET_RPC_URL"));
  await expect(createHousehold(keys, input)).rejects.toThrow(/^Household name has not resolved yet/);
  expect(io.createEntity).not.toHaveBeenCalled();
  io.owner.mockResolvedValue(keys.address);
  expect((await createHousehold(keys, input)).homeRecordKey).toBe(entityKey);
  expect(io.writeContract).toHaveBeenCalledTimes(2);
  expect(io.registerName).toHaveBeenCalledTimes(1);
});

it("concurrent create calls and later repeats reuse the same home instead of duplicating writes", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const states = await Promise.all([createHousehold(keys, input), createHousehold(keys, input)]);
  expect(states[0]).toEqual(states[1]);
  expect(io.writeContract).toHaveBeenCalledTimes(2);
  expect(io.createEntity).toHaveBeenCalledTimes(1);
  await expect(createHousehold(keys, { ...input, roomNumber: "changed" })).rejects.toThrow(
    "original household details",
  );
  expect(io.createEntity).toHaveBeenCalledTimes(1);
});

it("rechecks a known funding transaction instead of requesting a second top-up after a timeout", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.topup.mockResolvedValueOnce({ txHash: "0xaa", balanceWei: "0" });
  const normalReceipt = io.waitReceipt.getMockImplementation()!;
  let timedOut = false;
  io.waitReceipt.mockImplementation(async (request) => {
    if (request.hash === "0xaa") {
      if (!timedOut) {
        timedOut = true;
        throw new Error("SECRET_RPC_URL");
      }
      return { status: "success", logs: [] };
    }
    return normalReceipt(request);
  });
  await expect(createHousehold(keys, input)).rejects.toThrow("Could not confirm");
  expect((await createHousehold(keys, input)).name).toBe("sana.pata.eth");
  expect(io.topup.mock.calls.filter(([, request]) => request.chain === "sepolia")).toHaveLength(1);
});

it("allows a new registration only after its previous transaction is confirmed reverted", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.registerName.mockResolvedValueOnce({ txHash: "0x99" }).mockResolvedValueOnce({ txHash: "0x98" });
  const normalReceipt = io.waitReceipt.getMockImplementation()!;
  io.waitReceipt.mockImplementation(async (request) => {
    if (request.hash === "0x99") return { status: "reverted", logs: [] };
    if (request.hash === "0x98") return { status: "success", logs: [] };
    return normalReceipt(request);
  });
  await expect(createHousehold(keys, input)).rejects.toThrow("registration transaction reverted");
  expect((await createHousehold(keys, input)).homeRecordKey).toBe(entityKey);
  expect(io.registerName).toHaveBeenCalledTimes(2);
  expect(io.writeContract).toHaveBeenCalledTimes(2);
});

it("does not repeat a top-up request whose response was lost", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.topup.mockRejectedValue(new Error("lost funding response"));
  await expect(createHousehold(keys, input)).rejects.toThrow("Could not fund household");
  await expect(createHousehold(keys, input)).rejects.toThrow("needs transaction verification");
  expect(io.topup).toHaveBeenCalledTimes(1);
});

it("rejects a home larger than Arkiv's sealed bytes budget before requesting funds", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  await expect(createHousehold(keys, { ...input, writtenAddress: "x".repeat(128 * 1024) })).rejects.toThrow(
    "Home record is too large",
  );
  expect(io.topup).not.toHaveBeenCalled();
});

it("accepts an already registered household without a transaction hash and still verifies its resolution", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.registerName.mockResolvedValue({ txHash: null });
  const normalReceipt = io.waitReceipt.getMockImplementation()!;
  io.waitReceipt.mockImplementation(async (request) => {
    if (!request.hash) throw new Error("No transaction hash to confirm");
    return normalReceipt(request);
  });
  expect((await createHousehold(keys, input)).name).toBe("sana.pata.eth");
  expect(io.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "findExactOwner" }));
  expect(io.getEnsText).toHaveBeenCalledWith(
    expect.objectContaining({ name: "sana.pata.eth", key: "location" }),
  );
  expect(io.waitReceipt.mock.calls.every(([request]) => Boolean(request.hash))).toBe(true);
});

it("creates a household with progress and seals the complete confirmed home before saving public state", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  const progress: string[] = [];
  const state = await createHousehold(keys, input, (step) => {
    progress.push(step);
  });
  expect(state).toEqual({ name: "sana.pata.eth", resolver, grantRegistry, homeRecordKey: entityKey });
  expect(saved).toEqual(state);
  expect(progress).toEqual([
    "topup-sepolia",
    "topup-arkiv",
    "deploy",
    "register",
    "resolve",
    "home-record",
    "save",
    "complete",
  ]);
  expect(io.topup.mock.calls.map(([, request]) => request)).toEqual([
    { chain: "sepolia" },
    { chain: "arkiv" },
  ]);
  expect(io.registerName.mock.calls[0][1]).toEqual({ label: "sana", resolver, grantRegistry });
  const values = io.createEntity.mock.calls[0][1];
  expect(await openJson(keys.sealKey, hexToBytes(values.sealed.value))).toEqual({
    version: 1,
    digipin: "39J49LL8T4",
    pin: input.confirmedPin,
    locality: input.locality,
    roomNumber: input.roomNumber,
    writtenAddress: input.writtenAddress,
    directions: input.directions,
    voiceKeys: input.voiceKeys,
  });
});
