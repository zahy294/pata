// Arkiv gas for the household's next writes. A full 128 KiB create costs ~0.013 tGLM, so setup and each
// grant ask the relay first; it sends nothing while the balance is above half its target (server/chain/relay.ts).
import type { HouseholdKeys } from "../keys";
import { topup } from "../server-client";
import { arkivPublicClient } from "../rpc";

export async function ensureArkivGas(keys: HouseholdKeys): Promise<void> {
  const response = await topup(keys, { chain: "arkiv" }).catch(() => {
    throw new Error("Could not fund household on arkiv");
  });
  if (!response.txHash) return;
  try {
    const receipt = await arkivPublicClient().waitForTransactionReceipt({ hash: response.txHash });
    if (receipt.status === "success") return;
  } catch {
    /* RPC errors may carry request bodies: expose only the plain message below. */
  }
  throw new Error("Household funding transaction failed. Retry to request funding again.");
}
