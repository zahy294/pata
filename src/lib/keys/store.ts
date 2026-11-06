// What the household's device remembers. Owner: blockchain (P0-5).
// P0 keeps the random root here (IndexedDB). From P1-3 the root comes from the passkey and is never stored.
// Also keeps the household's public state so the app can start without a chain read.
// Never store a session key here: those live only in the courier's sessionStorage (ADR 0006).

export interface HouseholdState {
  /** e.g. "sana.pata.eth" */
  name: string;
  resolver: `0x${string}`;
  grantRegistry: `0x${string}`;
  homeRecordKey: `0x${string}`;
}

/** A setup journal holds exact-address input only inside household-sealed bytes. */
export interface SetupCheckpoint {
  name: string;
  /** Version 2 seals the home draft and MP3 bytes, rather than pre-uploaded voice keys. */
  inputVersion?: 2;
  sealedHome: Uint8Array;
  voiceKeys?: Partial<Record<import("../../../shared/domain").Language, `0x${string}`>>;
  sepoliaFunded?: boolean;
  arkivFunded?: boolean;
  fundingHashes?: { sepolia?: `0x${string}`; arkiv?: `0x${string}` };
  contracts?: { resolver: `0x${string}`; grantRegistry: `0x${string}` };
  registrationHash?: `0x${string}`;
  registered?: boolean;
  resolved?: boolean;
  homeRecordKey?: `0x${string}`;
  /** Legacy intent only: setup clears it and reconciles before doing any new work. */
  pending?: "topup-sepolia" | "topup-arkiv" | "deploy" | "register" | "home-record";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pata", 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore("household");
    request.onerror = () => reject(new Error("Could not open device storage"));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Device storage is blocked. Close other Pata tabs and try again."));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("household", mode);
      const request = operation(tx.objectStore("household"));
      // A request succeeding does not mean its transaction committed.
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(new Error("Device storage operation failed"));
    });
  } finally {
    db.close();
  }
}

export async function saveDeviceRoot(root: Uint8Array): Promise<void> {
  if (typeof indexedDB === "undefined") throw new Error("Device storage is unavailable");
  if (root.length !== 32) throw new Error("Device root must be 32 bytes");
  await transaction("readwrite", (store) => store.put(root, "device-root"));
}

export async function loadDeviceRoot(): Promise<Uint8Array | null> {
  if (typeof indexedDB === "undefined") return null;
  return (await transaction<Uint8Array | undefined>("readonly", (store) => store.get("device-root"))) ?? null;
}

export async function saveHouseholdState(state: HouseholdState): Promise<void> {
  if (typeof indexedDB === "undefined") throw new Error("Device storage is unavailable");
  await transaction("readwrite", (store) => store.put(state, "household-state"));
}

export async function loadHouseholdState(): Promise<HouseholdState | null> {
  if (typeof indexedDB === "undefined") return null;
  return (
    (await transaction<HouseholdState | undefined>("readonly", (store) => store.get("household-state"))) ??
    null
  );
}

export async function saveSetupCheckpoint(
  address: `0x${string}`,
  checkpoint: SetupCheckpoint,
): Promise<void> {
  if (typeof indexedDB === "undefined") throw new Error("Device storage is unavailable");
  await transaction("readwrite", (store) => store.put(checkpoint, `setup:${address.toLowerCase()}`));
}

export async function loadSetupCheckpoint(address: `0x${string}`): Promise<SetupCheckpoint | null> {
  if (typeof indexedDB === "undefined") return null;
  return (
    (await transaction<SetupCheckpoint | undefined>("readonly", (store) =>
      store.get(`setup:${address.toLowerCase()}`),
    )) ?? null
  );
}
