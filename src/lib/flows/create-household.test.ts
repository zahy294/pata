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
  io.readContract.mockResolvedValue(keys.address);
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
  io.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
  io.getEnsText.mockResolvedValueOnce(null);
  expect((await createHousehold(keys, input)).name).toBe("sana.pata.eth");
  expect(
    io.getEnsText.mock.calls.every(([request]) => request.universalResolverAddress === ENS.universalResolver),
  ).toBe(true);
});

it("can retry a failed resolution check without repeating chain writes", async () => {
  const keys = await deriveHouseholdKeys(new Uint8Array(32));
  io.readContract.mockRejectedValue(new Error("SECRET_RPC_URL"));
  await expect(createHousehold(keys, input)).rejects.toThrow(/^Household name has not resolved yet/);
  expect(io.createEntity).not.toHaveBeenCalled();
  io.readContract.mockResolvedValue(keys.address);
  expect((await createHousehold(keys, input)).homeRecordKey).toBe(entityKey);
  expect(io.writeContract).toHaveBeenCalledTimes(2);
  expect(io.registerName).toHaveBeenCalledTimes(1);
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
