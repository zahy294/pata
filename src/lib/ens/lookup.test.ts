import { beforeEach, expect, it, vi } from "vitest";
import { householdOwner, lookupLocality } from "./lookup";
import { grantStatusByName } from "./grants";
const io = vi.hoisted(() => ({ readContract: vi.fn(), getEnsText: vi.fn() }));
vi.mock("../rpc", () => ({ sepoliaPublicClient: () => io }));
const owner = "0x1111111111111111111111111111111111111111";
beforeEach(() => vi.resetAllMocks());
it("distinguishes missing locality/ownership from sanitized network failures", async () => {
  io.getEnsText.mockResolvedValue(null);
  io.readContract.mockResolvedValue("0x0000000000000000000000000000000000000000");
  expect(await lookupLocality("home.pata.eth")).toBeNull();
  expect(await householdOwner("home.pata.eth")).toBeNull();
  io.getEnsText.mockRejectedValue(new Error("secret request"));
  io.readContract.mockRejectedValue(new Error("secret request"));
  await expect(lookupLocality("home.pata.eth")).rejects.toThrow(/^Could not read locality$/);
  await expect(grantStatusByName("abcdefgh.home.pata.eth")).rejects.toThrow(/^Could not read grant status$/);
});
it("checks grant registry ownership independently of resolver records", async () => {
  io.readContract
    .mockResolvedValueOnce(owner)
    .mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
  expect(await grantStatusByName("abcdefgh.home.pata.eth")).toEqual({ live: true, owner });
  expect(await grantStatusByName("abcdefgh.home.pata.eth")).toEqual({ live: false });
  expect(io.getEnsText).not.toHaveBeenCalled();
});
it("reads both public locality text records through the universal resolver", async () => {
  io.getEnsText.mockImplementation(async ({ key }) => (key === "location" ? "Dharavi" : "400017"));
  expect(await lookupLocality("home.pata.eth")).toEqual({ name: "Dharavi", pinCode: "400017" });
  expect(io.getEnsText.mock.calls.map(([arg]) => arg.key)).toEqual(["location", "eth.pata.pincode"]);
});
it("finds exact household ownership using the full DNS name", async () => {
  io.readContract.mockResolvedValue(owner);
  expect(await householdOwner("home.pata.eth")).toBe(owner);
  expect(io.readContract).toHaveBeenCalledWith(
    expect.objectContaining({
      functionName: "findExactOwner",
      args: ["0x04686f6d6504706174610365746800"],
    }),
  );
});
