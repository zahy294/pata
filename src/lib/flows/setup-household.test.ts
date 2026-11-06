import { beforeEach, expect, it, vi } from "vitest";
import { signIn } from "./setup-household";

const storage = vi.hoisted(() => ({ loadDeviceRoot: vi.fn(), saveDeviceRoot: vi.fn() }));
vi.mock("../keys/store", () => storage);
beforeEach(() => vi.resetAllMocks());

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
