// Household setup on ENSv2. Owner: blockchain (P0-8). Read docs/research/ens-v2.md §3 and §5.
// Order (docs/plan.md, "Set up a household" step 7):
//   1. server /topup (Sepolia)
//   2. deployHouseholdContracts: the household's Permissioned Resolver and its grant registry
//      (VerifiableFactory.deployProxy; resolver initialize may write the locality records in the same tx)
//   3. server /register (the relay registers <label>.pata.eth to the household)
//   4. setLocality, if it wasn't written in step 2
// Never write records to the root name 0x00, and never write records for grant names (ens-v2.md Gotchas 1, 3).
import type { Locality } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  labelhash,
  parseAbiParameters,
  parseEventLogs,
  stringToHex,
  type Hex,
} from "viem";
import { namehash, normalize } from "viem/ens";
import { sepolia } from "viem/chains";
import { env } from "../env";
import { sepoliaPublicClient, sepoliaWalletClient } from "../rpc";
import { permissionedResolverAbi, userRegistryAbi, verifiableFactoryAbi } from "./abis";
import { dnsEncode, isValidHouseholdLabel } from "./names";
import { ENS, PROVIDER_NAME, RECORD_KEYS } from "../../../shared/constants";
import { GRANT_REGISTRY_ROOT_ROLES, RESOLVER_ROOT_ROLES } from "./roles";

function householdName(name: string): string {
  const suffix = `.${PROVIDER_NAME}`;
  let canonical: string;
  try {
    canonical = normalize(name);
  } catch {
    throw new Error("Invalid household name");
  }
  if (!canonical.endsWith(suffix) || !isValidHouseholdLabel(canonical.slice(0, -suffix.length))) {
    throw new Error("Invalid household name");
  }
  return canonical;
}

function localityCalls(fullName: string, locality: Locality): Hex[] {
  if (!locality.name.trim() || locality.name.length > 80 || !/^\d{6}$/.test(locality.pinCode))
    throw new Error("Invalid locality");
  return [
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [dnsEncode(fullName), RECORD_KEYS.location, `${locality.name}, ${locality.pinCode}`],
    }),
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [dnsEncode(fullName), RECORD_KEYS.pinCode, locality.pinCode],
    }),
  ];
}

export interface HouseholdContracts {
  resolver: `0x${string}`;
  grantRegistry: `0x${string}`;
}

/** 0 available, 1 reserved, 2 registered, read from pata.eth's registry. */
export async function householdLabelStatus(label: string): Promise<0 | 1 | 2> {
  if (!isValidHouseholdLabel(label)) throw new Error("Invalid household label");
  try {
    const status = await sepoliaPublicClient().readContract({
      address: env.pataRegistry,
      abi: userRegistryAbi,
      functionName: "getStatus",
      args: [BigInt(labelhash(label))],
    });
    if (status !== 0 && status !== 1 && status !== 2) throw new Error("Invalid household name status");
    return status;
  } catch {
    throw new Error("Could not check household name");
  }
}

export async function deployHouseholdContracts(
  keys: HouseholdKeys,
  fullName: string,
  locality: Locality,
): Promise<HouseholdContracts> {
  fullName = householdName(fullName);
  const calls = localityCalls(fullName, locality);
  const client = sepoliaPublicClient();
  const wallet = sepoliaWalletClient(keys.account);
  async function deploy(implementation: Hex, salt: bigint, data: Hex): Promise<Hex> {
    try {
      const hash = await wallet.writeContract({
        chain: sepolia,
        account: keys.account,
        address: ENS.verifiableFactory,
        abi: verifiableFactoryAbi,
        functionName: "deployProxy",
        args: [implementation, salt, data],
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Household contract deployment failed");
      const events = parseEventLogs({
        abi: verifiableFactoryAbi,
        eventName: "ProxyDeployed",
        logs: receipt.logs.filter((log) => log.address.toLowerCase() === ENS.verifiableFactory.toLowerCase()),
      });
      const event = events.find(
        ({ args }) =>
          args.sender.toLowerCase() === keys.address.toLowerCase() &&
          args.implementation.toLowerCase() === implementation.toLowerCase() &&
          args.salt === salt,
      );
      if (!event) throw new Error("Household deployment receipt is missing its proxy address");
      return event.args.proxyAddress;
    } catch {
      throw new Error("Could not deploy household contract");
    }
  }
  const resolverSalt = BigInt(
    keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, address, uint256"), [
        keccak256(stringToHex("OwnedResolver")),
        keys.address,
        0n,
      ]),
    ),
  );
  const registrySalt = BigInt(
    keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, bytes32, uint256"), [
        keccak256(stringToHex("UserRegistry")),
        namehash(fullName),
        0n,
      ]),
    ),
  );
  const resolver = await deploy(
    ENS.permissionedResolverImpl,
    resolverSalt,
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "initialize",
      args: [[{ account: keys.address, roleBitmap: RESOLVER_ROOT_ROLES }], calls],
    }),
  );
  const grantRegistry = await deploy(
    ENS.userRegistryImpl,
    registrySalt,
    encodeFunctionData({
      abi: userRegistryAbi,
      functionName: "initialize",
      args: [[{ account: keys.address, roleBitmap: GRANT_REGISTRY_ROOT_ROLES }]],
    }),
  );
  return { resolver, grantRegistry };
}

/** Writes the public locality records (`location`, `eth.pata.pincode`) on the household's resolver. */
export async function setLocality(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  fullName: string,
  locality: Locality,
): Promise<void> {
  fullName = householdName(fullName);
  const calls = localityCalls(fullName, locality);
  try {
    const hash = await sepoliaWalletClient(keys.account).writeContract({
      chain: sepolia,
      account: keys.account,
      address: contracts.resolver,
      abi: permissionedResolverAbi,
      functionName: "multicall",
      args: [calls],
    });
    const receipt = await sepoliaPublicClient().waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Locality update failed");
  } catch {
    throw new Error("Could not update locality");
  }
}
