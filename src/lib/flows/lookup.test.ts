import { beforeEach, expect, it, vi } from "vitest";
import { lookupHousehold } from "./lookup";

const lookupLocality = vi.hoisted(() => vi.fn());
vi.mock("../ens/lookup", () => ({ lookupLocality }));
beforeEach(() => {
  lookupLocality.mockReset();
  lookupLocality.mockResolvedValue({ name: "Dharavi", pinCode: "400017" });
});

it("accepts a bare label or the full household name", async () => {
  expect(await lookupHousehold(" Blue-Gate ")).toEqual({ name: "Dharavi", pinCode: "400017" });
  expect(await lookupHousehold("blue-gate.pata.eth")).toEqual({ name: "Dharavi", pinCode: "400017" });
  expect(lookupLocality.mock.calls).toEqual([["blue-gate.pata.eth"], ["blue-gate.pata.eth"]]);
});

it("returns null for malformed names without a chain read", async () => {
  expect(await lookupHousehold("-bad")).toBeNull();
  expect(await lookupHousehold("abcdefgh.blue-gate.pata.eth")).toBeNull();
  expect(lookupLocality).not.toHaveBeenCalled();
});
