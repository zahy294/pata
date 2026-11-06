import { beforeEach, expect, it, vi } from "vitest";
import { checkHouseholdName, signIn } from "./setup-household";

const storage = vi.hoisted(() => ({ loadDeviceRoot: vi.fn(), saveDeviceRoot: vi.fn() }));
vi.mock("../keys/store", () => storage);
const labelStatus = vi.hoisted(() => vi.fn());
vi.mock("../ens/household", () => ({ householdLabelStatus: labelStatus, deployHouseholdContracts: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it("reports a household name as available only when the pata.eth registry has it unregistered", async () => {
  labelStatus.mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
  expect(await checkHouseholdName("blue-gate")).toBe("available");
  expect(await checkHouseholdName("blue-gate")).toBe("taken");
  expect(await checkHouseholdName("blue-gate")).toBe("taken");
  expect(await checkHouseholdName("Blue Gate")).toBe("invalid");
  expect(labelStatus).toHaveBeenCalledTimes(3);
});

it("persists a new device identity before returning it, and reuses it on later sign-ins", async () => {
  let root: Uint8Array | null = null;
  storage.loadDeviceRoot.mockImplementation(async () => root);
  storage.saveDeviceRoot.mockImplementation(async (value) => {
    root = value;
  });
  const first = await signIn();
  const second = await signIn();
  expect(root).toHaveLength(32);
  expect(first.address).toBe(second.address);
  expect(first.sealKey.extractable).toBe(false);
});

it("concurrent sign-ins share the same persisted identity", async () => {
  let root: Uint8Array | null = null;
  storage.loadDeviceRoot.mockImplementation(async () => root);
  storage.saveDeviceRoot.mockImplementation(async (value) => {
    await Promise.resolve();
    root = value;
  });
  const identities = await Promise.all([signIn(), signIn(), signIn()]);
  expect(new Set(identities.map((keys) => keys.address)).size).toBe(1);
});

it("does not return an unpersisted identity, and a failed sign-in does not poison future attempts", async () => {
  storage.loadDeviceRoot.mockResolvedValue(null);
  storage.saveDeviceRoot.mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue(undefined);
  await expect(signIn()).rejects.toThrow("storage unavailable");
  expect((await signIn()).address).toMatch(/^0x[0-9a-fA-F]{40}$/);
});

it("explains a failed description in plain words without echoing the raw error", async () => {
  const { describeTheWayError } = await import("./setup-household");
  const { RecordingInputError } = await import("../server-client/recording");
  const { ServerError } = await import("../server-client/signed");
  expect(describeTheWayError(new RecordingInputError("Recording must be at most 30 seconds", 422))).toMatch(
    /too long/,
  );
  expect(describeTheWayError(new RecordingInputError("Invalid or unsupported speech recording"))).toMatch(
    /format isn't supported/,
  );
  expect(describeTheWayError(new ServerError(502, "speech_unavailable", "secret upstream detail"))).toMatch(
    /couldn't hear any words/,
  );
  const generic = describeTheWayError(new Error("https://private.example request body"));
  expect(generic).toBe("Could not understand the address description right now. Please tap Retry.");
});

it("tells a missing locality apart from a temporary landmark-search failure", async () => {
  const { isLocalityNotFound } = await import("./setup-household");
  const { ServerError } = await import("../server-client/signed");
  expect(isLocalityNotFound(new ServerError(422, "locality_not_found", "Locality not found"))).toBe(true);
  expect(isLocalityNotFound(new ServerError(502, "address_unavailable", "Address search unavailable"))).toBe(
    false,
  );
  expect(isLocalityNotFound(new Error("network"))).toBe(false);
});

it("names the setup step a failed save stopped at, without the raw error", async () => {
  const { createHouseholdError } = await import("./setup-household");
  expect(createHouseholdError(new Error("https://private.example body"), "deploy")).toBe(
    "Could not finish saving your home right now. It stopped while deploying your home's contracts. Tap Retry to resume from where it stopped.",
  );
  expect(
    createHouseholdError(new Error("Resume setup with the original household details"), "deploy"),
  ).toMatch(/clear this site's data/);
  expect(createHouseholdError(new Error("x"), null)).not.toMatch(/stopped while/);
});
