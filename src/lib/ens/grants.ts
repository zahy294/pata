// Grants as expiring subnames in the household's grant registry. Owner: blockchain (P0-10, P0-12).
// Read docs/research/ens-v2.md §4 and ADRs 0002, 0004.
// - Mint: register(label, grantOwner, 0x0, 0x0, GRANT_ROLES, grantEnd). No resolver, no records.
// - grantEnd comes from ../flows/approve-grant (latest Sepolia block time + duration + margin), never the phone clock alone.
// - Liveness comes ONLY from the registry (ADR 0002): an expired grant still resolves through the household's resolver.
// - Revoke reads the status first: unregister reverts LabelExpired on an expired grant.
import type { HouseholdContracts } from "./household";
import type { HouseholdKeys } from "../keys";
import { sepoliaPublicClient, sepoliaWalletClient } from "../rpc";
import { sepolia } from "viem/chains";
import { zeroAddress, BaseError, ContractFunctionRevertedError, isAddress, labelhash } from "viem";
import { GRANT_LATENCY_MARGIN_SECONDS } from "../../../shared/constants";
import { userRegistryAbi } from "./abis";
import { GRANT_ROLES } from "./roles";
import { householdOwner } from "./lookup";

export type GrantStatus = { live: true; owner: `0x${string}` } | { live: false };

export async function mintGrant(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  label: string,
  grantOwner: `0x${string}`,
  grantEnd: number,
  options?: { refreshGrantEnd: () => Promise<number> },
): Promise<`0x${string}`> {
  if (
    !/^[a-z2-7]{8}$/.test(label) ||
    !Number.isSafeInteger(grantEnd) ||
    grantEnd <= 0 ||
    !isAddress(grantOwner) ||
    grantOwner === zeroAddress
  )
    throw new Error("Invalid grant");
  try {
    const initialNow = await sepoliaNow();
    const lifetime = Math.max(GRANT_LATENCY_MARGIN_SECONDS, grantEnd - initialNow);
    const client = sepoliaPublicClient();
    const wallet = sepoliaWalletClient(keys.account);
    let end = grantEnd;
    for (let attempt = 0; attempt < 2; attempt++) {
      const request = {
        chain: sepolia,
        account: keys.account,
        address: contracts.grantRegistry,
        abi: userRegistryAbi,
        functionName: "register" as const,
        args: [label, grantOwner, zeroAddress, zeroAddress, GRANT_ROLES, BigInt(end)] as const,
      };
      try {
        const hash = await wallet.writeContract(request);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          // A reverted receipt has no decoded reason. Re-simulate only to classify it.
          await client.simulateContract(request);
          throw new Error("Grant registration reverted");
        }
        return hash;
      } catch (error) {
        const reverted =
          error instanceof BaseError
            ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
            : undefined;
        if (
          attempt !== 0 ||
          !(reverted instanceof ContractFunctionRevertedError) ||
          reverted.data?.errorName !== "CannotSetPastExpiry"
        )
          throw error;
        end = options ? await options.refreshGrantEnd() : Math.max(end + 1, (await sepoliaNow()) + lifetime);
        if (!Number.isSafeInteger(end) || end <= grantEnd) throw new Error("Invalid refreshed expiry");
      }
    }
    throw new Error("Grant registration failed");
  } catch {
    throw new Error("Could not mint grant");
  }
}

/** From the full grant name alone (courier view): UniversalHelper.findExactOwner; zero means not live. */
export async function grantStatusByName(grantName: string): Promise<GrantStatus> {
  try {
    const owner = await householdOwner(grantName);
    return owner ? { live: true, owner } : { live: false };
  } catch {
    throw new Error("Could not read grant status");
  }
}

/** Status read, then unregister if live. Returns "already-ended" without a transaction otherwise. */
export async function unregisterGrant(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  label: string,
): Promise<"revoked" | "already-ended"> {
  try {
    if (!/^[a-z2-7]{8}$/.test(label)) throw new Error("Invalid grant label");
    const client = sepoliaPublicClient();
    const id = BigInt(labelhash(label));
    const status = await client.readContract({
      address: contracts.grantRegistry,
      abi: userRegistryAbi,
      functionName: "getStatus",
      args: [id],
    });
    if (status !== 2) return "already-ended";
    const request = {
      chain: sepolia,
      account: keys.account,
      address: contracts.grantRegistry,
      abi: userRegistryAbi,
      functionName: "unregister" as const,
      args: [id] as const,
    };
    const hash = await sepoliaWalletClient(keys.account).writeContract(request);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      await client.simulateContract(request);
      throw new Error("Reverted");
    }
    return "revoked";
  } catch (error) {
    const reverted =
      error instanceof BaseError
        ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
        : undefined;
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName === "LabelExpired")
      return "already-ended";
    throw new Error("Could not unregister grant");
  }
}

/** Latest Sepolia block timestamp, for computing grantEnd. */
export async function sepoliaNow(): Promise<number> {
  try {
    const timestamp = Number((await sepoliaPublicClient().getBlock({ blockTag: "latest" })).timestamp);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error("Invalid timestamp");
    return timestamp;
  } catch {
    throw new Error("Could not read Sepolia time");
  }
}
