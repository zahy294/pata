import { beforeEach, expect, it, vi } from "vitest";
import { checkRequester, handOffUrl } from "./requester";

const io = vi.hoisted(() => ({ readRequesterRecords: vi.fn() }));
vi.mock("../ens/lookup", () => ({ readRequesterRecords: io.readRequesterRecords }));
beforeEach(() => vi.resetAllMocks());

const link = `https://pata.example/c#1~sana.pata.eth~${"A".repeat(43)}~${"B".repeat(43)}`;

it("shows what a requester's own name says about it, and where the link would go", async () => {
  io.readRequesterRecords.mockResolvedValue({
    about: "  Chai Kart, a demo seller.  ",
    endpoint: "https://shop.example/pata/",
  });
  expect(await checkRequester("Chai-Kart.pata.eth")).toEqual({
    state: "verified",
    ensName: "chai-kart.pata.eth",
    about: "Chai Kart, a demo seller.",
    endpoint: "https://shop.example/pata/",
    endpointHost: "shop.example",
  });
  expect(io.readRequesterRecords).toHaveBeenCalledWith("chai-kart.pata.eth");
});

it("treats a name with no agent records, or one that isn't a name, as unverified", async () => {
  io.readRequesterRecords.mockResolvedValue({ about: null, endpoint: "https://shop.example/" });
  expect(await checkRequester("nobody.pata.eth")).toEqual({
    state: "unverified",
    ensName: "nobody.pata.eth",
  });
  expect(await checkRequester("not a name!")).toEqual({ state: "unverified", ensName: "not a name!" });
  expect(io.readRequesterRecords).toHaveBeenCalledOnce();
});

it("keeps the requester's description but offers no hand-off to an unsafe endpoint", async () => {
  for (const endpoint of ["http://shop.example/", "javascript:alert(1)", "https://shop.example/#x", null]) {
    io.readRequesterRecords.mockResolvedValue({ about: "Chai Kart", endpoint });
    expect(await checkRequester("chai-kart.pata.eth")).toMatchObject({
      state: "verified",
      endpoint: null,
      endpointHost: null,
    });
  }
});

it("says plainly when the requester's name can't be checked", async () => {
  io.readRequesterRecords.mockRejectedValue(new Error("secret request body"));
  await expect(checkRequester("chai-kart.pata.eth")).rejects.toThrow(
    /^Couldn't check who is asking right now\.$/,
  );
});

it("hands the courier link to the endpoint after its #, so no server ever receives the key", () => {
  expect(handOffUrl("https://shop.example/pata/", link)).toBe(
    `https://shop.example/pata/#1~sana.pata.eth~${"A".repeat(43)}~${"B".repeat(43)}`,
  );
  expect(() => handOffUrl("http://shop.example/", link)).toThrow("Unsafe requester endpoint");
  expect(() => handOffUrl("https://shop.example/", "https://pata.example/c#junk")).toThrow(
    "Invalid courier link",
  );
});
