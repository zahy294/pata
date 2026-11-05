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

export async function saveDeviceRoot(root: Uint8Array): Promise<void> {
  void root;
  throw new Error("saveDeviceRoot: not implemented (P0-5)");
}

export async function loadDeviceRoot(): Promise<Uint8Array | null> {
  throw new Error("loadDeviceRoot: not implemented (P0-5)");
}

export async function saveHouseholdState(state: HouseholdState): Promise<void> {
  void state;
  throw new Error("saveHouseholdState: not implemented (P0-8)");
}

export async function loadHouseholdState(): Promise<HouseholdState | null> {
  throw new Error("loadHouseholdState: not implemented (P0-8)");
}
