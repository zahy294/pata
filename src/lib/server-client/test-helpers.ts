import { privateKeyToAccount } from "viem/accounts";
import type { HouseholdKeys } from "../keys";

/** Public test key only; never used by application code or on-chain transactions. */
export async function testHouseholdKeys(): Promise<HouseholdKeys> {
  const account = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000001");
  return {
    account,
    address: account.address,
    sealKey: await crypto.subtle.importKey("raw", new ArrayBuffer(32), { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]),
  };
}
