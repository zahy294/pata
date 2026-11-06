import { beforeEach, expect, it, vi } from "vitest";
import { deriveGrantIdentity, deriveHouseholdKeys } from "../keys";
import { formatCourierLink, fromBase64Url } from "../link";
import {
  addressRequestUrl,
  proveGrantHolder,
  receiveCourierLink,
  setUpSeller,
  suggestSellerLabel,
  verifyGrantProof,
} from "./seller";

const io = vi.hoisted(() => ({
  loadSellerRoot: vi.fn(),
  saveSellerRoot: vi.fn(),
  loadSellerState: vi.fn(),
  saveSellerState: vi.fn(),
  topup: vi.fn(),
  registerName: vi.fn(),
  householdLabelStatus: vi.fn(),
  deployRequesterContracts: vi.fn(),
  setRequesterRecords: vi.fn(),
  readRequesterRecords: vi.fn(),
  householdOwner: vi.fn(),
  grantStatusByName: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));
vi.mock("../keys/store", () => ({
  loadSellerRoot: io.loadSellerRoot,
  saveSellerRoot: io.saveSellerRoot,
  loadSellerState: io.loadSellerState,
  saveSellerState: io.saveSellerState,
}));
vi.mock("../server-client", () => ({ topup: io.topup, registerName: io.registerName }));
vi.mock("../ens/household", async (original) => ({
  ...(await original<typeof import("../ens/household")>()),
  householdLabelStatus: io.householdLabelStatus,
  deployRequesterContracts: io.deployRequesterContracts,
  setRequesterRecords: io.setRequesterRecords,
}));
vi.mock("../ens/lookup", () => ({
  readRequesterRecords: io.readRequesterRecords,
  householdOwner: io.householdOwner,
}));
vi.mock("../ens/grants", () => ({ grantStatusByName: io.grantStatusByName }));
vi.mock("../rpc", () => ({
  sepoliaPublicClient: () => ({ waitForTransactionReceipt: io.waitForTransactionReceipt }),
}));

const root = new Uint8Array(32).fill(5);
const contracts = {
  resolver: "0x2222222222222222222222222222222222222222",
  grantRegistry: "0x3333333333333333333333333333333333333333",
} as const;
const input = {
  label: "chai-kart",
  displayName: "Chai Kart",
  about: "Chai Kart, a demo seller. Asks for your door to deliver an order.",
  endpoint: "https://pata.example/seller/",
};
let saved: unknown;
beforeEach(() => {
  vi.resetAllMocks();
  saved = null;
  io.loadSellerRoot.mockResolvedValue(root);
  io.loadSellerState.mockImplementation(async () => structuredClone(saved));
  io.saveSellerState.mockImplementation(async (state) => {
    saved = structuredClone(state);
  });
  io.householdLabelStatus.mockResolvedValue(0);
  io.topup.mockResolvedValue({ txHash: "0x01", balanceWei: "500000000000000" });
  io.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
  io.deployRequesterContracts.mockResolvedValue(contracts);
  io.registerName.mockResolvedValue({ txHash: "0x02" });
  io.readRequesterRecords.mockResolvedValue({ about: input.about, endpoint: input.endpoint });
});

it("gives the seller a name with its agent records, through the same relay as households", async () => {
  const steps: string[] = [];
  const state = await setUpSeller(input, (step) => steps.push(step));
  const keys = await deriveHouseholdKeys(root);
  expect(state).toEqual({
    name: "chai-kart.pata.eth",
    displayName: "Chai Kart",
    about: input.about,
    endpoint: input.endpoint,
    ready: true,
  });
  expect(saved).toEqual(state);
  expect(steps).toEqual(["funding", "deploying", "registering", "checking"]);
  expect(io.topup).toHaveBeenCalledWith(expect.objectContaining({ address: keys.address }), {
    chain: "sepolia",
  });
  expect(io.deployRequesterContracts).toHaveBeenCalledWith(
    expect.objectContaining({ address: keys.address }),
    "chai-kart.pata.eth",
    { about: input.about, endpoint: input.endpoint },
  );
  expect(io.registerName).toHaveBeenCalledWith(expect.anything(), { label: "chai-kart", ...contracts });
  expect(io.waitForTransactionReceipt.mock.calls.map(([arg]) => arg.hash)).toEqual(["0x01", "0x02"]);
  expect(io.setRequesterRecords).not.toHaveBeenCalled();
});

it("makes the seller its own key, never the household's", async () => {
  io.loadSellerRoot.mockResolvedValue(null);
  await setUpSeller(input, () => {});
  expect(io.saveSellerRoot).toHaveBeenCalledWith(expect.any(Uint8Array));
  const [created] = io.saveSellerRoot.mock.calls[0];
  expect(created).toHaveLength(32);
});

it("refuses a name someone else holds before spending anything", async () => {
  io.householdLabelStatus.mockResolvedValue(2);
  io.householdOwner.mockResolvedValue("0x9999999999999999999999999999999999999999");
  await expect(setUpSeller(input, () => {})).rejects.toThrow(/^That name is taken\. Try another\.$/);
  expect(io.topup).not.toHaveBeenCalled();
  io.householdLabelStatus.mockResolvedValue(1);
  await expect(setUpSeller(input, () => {})).rejects.toThrow(/^That name is taken\. Try another\.$/);
});

it("finishes a seller whose name it already holds, without registering it again", async () => {
  const keys = await deriveHouseholdKeys(root);
  io.householdLabelStatus.mockResolvedValue(2);
  io.householdOwner.mockResolvedValue(keys.address);
  io.topup.mockResolvedValue({ txHash: null, balanceWei: "500000000000000" });
  expect((await setUpSeller(input, () => {})).ready).toBe(true);
  expect(io.registerName).not.toHaveBeenCalled();
});

it("rewrites the agent records when the name resolves with an earlier setup's records", async () => {
  io.readRequesterRecords
    .mockResolvedValueOnce({ about: "Old shop", endpoint: input.endpoint })
    .mockResolvedValue({ about: input.about, endpoint: input.endpoint });
  expect((await setUpSeller(input, () => {})).ready).toBe(true);
  expect(io.setRequesterRecords).toHaveBeenCalledWith(expect.anything(), contracts, "chai-kart.pata.eth", {
    about: input.about,
    endpoint: input.endpoint,
  });
});

it("keeps the first name once setup has started, and says so", async () => {
  saved = {
    name: "old-shop.pata.eth",
    displayName: "Old",
    about: "Old",
    endpoint: input.endpoint,
    ready: false,
  };
  await expect(setUpSeller(input, () => {})).rejects.toThrow(
    /^This phone is still setting up old-shop\.pata\.eth\. Finish that one first\.$/,
  );
  expect(io.topup).not.toHaveBeenCalled();
});

it("reports a failed step in plain words, never the raw error", async () => {
  io.deployRequesterContracts.mockRejectedValue(new Error("https://rpc body=private"));
  await expect(setUpSeller(input, () => {})).rejects.toThrow(
    /^Couldn't finish setting up the seller\. Tap Retry to carry on\.$/,
  );
});

it("suggests a name from the shop name, or none when it can't make a valid one", () => {
  expect(suggestSellerLabel("Chai Kart")).toBe("chai-kart");
  expect(suggestSellerLabel("  Mumbai  Masala & Co. ")).toBe("mumbai-masala-co");
  expect(suggestSellerLabel("!!")).toBeNull();
});

it("builds the request the consent screen reads, carrying the seller's name", () => {
  const url = addressRequestUrl(
    "https://pata.example",
    { name: "chai-kart.pata.eth", displayName: "Chai Kart" },
    {
      purpose: "Deliver order #4821",
      language: "hi",
      durationSeconds: 20,
    },
  );
  const [base, fragment] = url.split("#");
  expect(base).toBe("https://pata.example/approve/");
  expect(JSON.parse(new TextDecoder().decode(fromBase64Url(fragment)))).toEqual({
    requester: { displayName: "Chai Kart", ensName: "chai-kart.pata.eth" },
    purpose: "Deliver order #4821",
    language: "hi",
    durationSeconds: 20,
  });
});

async function courierLink() {
  const sessionKey = new Uint8Array(32).fill(8);
  const identity = await deriveGrantIdentity(sessionKey);
  const link = formatCourierLink("https://pata.example", {
    householdName: "sana.pata.eth",
    payloadKey: `0x${"12".repeat(32)}`,
    sessionKey,
  });
  return { link, identity };
}

it("receives a handed-off courier link for this site, and ignores anything else", async () => {
  const { link } = await courierLink();
  const hash = link.slice(link.indexOf("#"));
  expect(receiveCourierLink(hash, "https://pata.example/")).toEqual({
    courierLink: link,
    householdName: "sana.pata.eth",
  });
  expect(receiveCourierLink("#junk", "https://pata.example")).toBeNull();
  expect(receiveCourierLink("", "https://pata.example")).toBeNull();
});

it("the seller proves it holds the grant, and anyone can check that against the name's owner", async () => {
  const { link, identity } = await courierLink();
  const proof = await proveGrantHolder(link, "bank-challenge-7");
  expect(proof.grantName).toBe(`${identity.label}.sana.pata.eth`);
  expect(proof.message).toContain("bank-challenge-7");
  expect(proof.message).not.toContain(link.slice(link.lastIndexOf("~") + 1));
  io.grantStatusByName.mockResolvedValue({ live: true, owner: identity.owner.address });
  expect(await verifyGrantProof(proof)).toEqual({
    valid: true,
    grantName: proof.grantName,
    owner: identity.owner.address,
  });
  expect(io.grantStatusByName).toHaveBeenCalledWith(proof.grantName);
});

it("a proof fails once the grant has ended, or when another key signed it", async () => {
  const { link } = await courierLink();
  const proof = await proveGrantHolder(link, "bank-challenge-7");
  io.grantStatusByName.mockResolvedValue({ live: false });
  expect(await verifyGrantProof(proof)).toEqual({ valid: false, reason: "ended" });
  io.grantStatusByName.mockResolvedValue({ live: true, owner: "0x9999999999999999999999999999999999999999" });
  expect(await verifyGrantProof(proof)).toEqual({ valid: false, reason: "not-the-holder" });
  const forged = { ...proof, message: proof.message.replace("bank-challenge-7", "other") };
  io.grantStatusByName.mockResolvedValue({ live: true, owner: proof.owner });
  expect(await verifyGrantProof(forged)).toEqual({ valid: false, reason: "not-the-holder" });
});
