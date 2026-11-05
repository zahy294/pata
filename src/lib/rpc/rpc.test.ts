import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  init: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
  acceptLog: vi.fn((): Promise<unknown> => new Promise(() => {})),
  readyError: undefined as Error | undefined,
}));

vi.mock("@anon-rpc/browser-harness", () => ({
  AnonRpcWorker: class {
    ready = harness.readyError ? Promise.reject(harness.readyError) : Promise.resolve();
    fetch = harness.fetch;
    constructor(init: unknown) {
      harness.init(init);
    }
    acceptLog = harness.acceptLog;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  harness.readyError = undefined;
  vi.stubGlobal("window", {});
  vi.stubEnv("NEXT_PUBLIC_SEPOLIA_RPC_URL", "https://sepolia.test");
  vi.stubEnv("NEXT_PUBLIC_ARKIV_RPC_URL", "https://arkiv.test");
  vi.stubEnv("NEXT_PUBLIC_ARKIV_ACCESS_KEY", "test-public-key");
  vi.stubEnv("NEXT_PUBLIC_DIRECT_WRITES", "1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("RPC clients", () => {
  it("reports a plain readiness failure without disclosing the upstream error", async () => {
    harness.readyError = new Error("https://arkiv.test/test-public-key body=private");
    const rpc = await import("./index");
    await expect(rpc.anonRpcReady()).rejects.toThrow(/^Private RPC could not start$/);
  });
  it("claims worker logs so sensitive log contents are not echoed to the console", async () => {
    const rpc = await import("./index");
    await rpc.anonRpcReady();
    expect(harness.acceptLog).toHaveBeenCalled();
  });
  it("logs only method metadata and returns independent snapshots", async () => {
    harness.fetch.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0xaa36a7" });
    });
    const rpc = await import("./index");
    await rpc.sepoliaPublicClient().getChainId();
    const snapshot = rpc.rpcLog();
    expect(snapshot).toEqual([
      { chain: "sepolia", method: "eth_chainId", via: "nox", at: expect.any(Number) },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("test-public-key");
    snapshot[0].method = "changed";
    snapshot.pop();
    expect(rpc.rpcLog()[0].method).toBe("eth_chainId");
  });
  it("never falls back to a direct read when Nox fails", async () => {
    const direct = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", direct);
    harness.fetch.mockRejectedValue(new Error("network failed"));
    const rpc = await import("./index");
    await expect(rpc.sepoliaPublicClient().getChainId()).rejects.toThrow();
    expect(harness.fetch).toHaveBeenCalledTimes(1);
    expect(direct).not.toHaveBeenCalled();
  });
  it("routes both wallets through Nox when direct writes are disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_DIRECT_WRITES", "0");
    const direct = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", direct);
    harness.fetch.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x" + "1".repeat(64) });
    });
    const { deriveHouseholdKeys } = await import("../keys");
    const { account } = await deriveHouseholdKeys(new Uint8Array(32));
    const rpc = await import("./index");
    await rpc.sepoliaWalletClient(account).sendRawTransaction({ serializedTransaction: "0x01" });
    await rpc.arkivWalletClient(account).sendRawTransaction({ serializedTransaction: "0x02" });
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(direct).not.toHaveBeenCalled();
    expect(harness.init).toHaveBeenCalledTimes(1);
  });
  it("routes wallet requests directly only while the P0 switch is on", async () => {
    const direct = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x" + "1".repeat(64) });
    });
    vi.stubGlobal("fetch", direct);
    const { deriveHouseholdKeys } = await import("../keys");
    const { account } = await deriveHouseholdKeys(new Uint8Array(32));
    const rpc = await import("./index");
    await rpc.sepoliaWalletClient(account).sendRawTransaction({ serializedTransaction: "0x01" });
    await rpc.arkivWalletClient(account).sendRawTransaction({ serializedTransaction: "0x02" });
    expect(direct).toHaveBeenCalledTimes(2);
    expect(harness.fetch).not.toHaveBeenCalled();
    expect(typeof rpc.arkivWalletClient(account).createEntity).toBe("function");
    expect(rpc.arkivWalletClient(account).pollingInterval).toBe(1000);
  });
  it("sends Arkiv reads through the same worker with the key in the URL path", async () => {
    harness.fetch.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x76edaf" });
    });
    const rpc = await import("./index");
    await rpc.anonRpcReady();
    const client = rpc.arkivPublicClient();
    expect(await client.getChainId()).toBe(7794095);
    expect(client.pollingInterval).toBe(1000);
    expect(client.ccipRead).toBe(false);
    expect(typeof client.query).toBe("function");
    expect(client.transport.timeout).toBe(30_000);
    expect(client.transport.retryCount).toBe(0);
    expect(harness.fetch).toHaveBeenCalledWith("https://arkiv.test/test-public-key", expect.anything());
    expect(harness.init).toHaveBeenCalledTimes(1);
    expect(rpc.arkivPublicClient()).toBe(client);
  });
  it("sends Sepolia reads through Nox with no CCIP bypass", async () => {
    harness.fetch.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({ jsonrpc: "2.0", id: body.id, result: "0xaa36a7" });
    });
    const rpc = await import("./index");
    const client = rpc.sepoliaPublicClient();
    expect(await client.getChainId()).toBe(11155111);
    expect(client.ccipRead).toBe(false);
    expect(client.transport.timeout).toBe(30_000);
    expect(client.transport.retryCount).toBe(0);
    expect(harness.fetch).toHaveBeenCalledWith("https://sepolia.test/", expect.anything());
    expect(rpc.sepoliaPublicClient()).toBe(client);
  });
  it("refuses to boot outside the browser", async () => {
    vi.stubGlobal("window", undefined);
    const rpc = await import("./index");
    await expect(rpc.anonRpcReady()).rejects.toThrow("browser");
    expect(harness.init).not.toHaveBeenCalled();
  });
  it("creates one worker lazily and shares concurrent readiness calls", async () => {
    const rpc = await import("./index");
    expect(harness.init).not.toHaveBeenCalled();
    await Promise.all([rpc.anonRpcReady(), rpc.anonRpcReady()]);
    expect(harness.init).toHaveBeenCalledTimes(1);
    expect(harness.init).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A",
        config: undefined,
        preExisting: { rpcProvider: expect.objectContaining({ request: expect.any(Function) }) },
      }),
    );
  });
});
