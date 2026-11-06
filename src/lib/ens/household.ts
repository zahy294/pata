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

/**
 * A requester's public ENSIP-26 records (P1-5): `agent-context` says who it is and what it does with an
 * address; `agent-endpoint[web]` is where a household's consent screen hands the courier link (ADR 0013).
 */
export interface RequesterProfile {
  about: string;
  endpoint: string;
}

/** The endpoint must be a page a household can be sent to: https, or plain http on this computer only. */
export function isSafeRequesterEndpoint(endpoint: string): boolean {
  if (endpoint.length > 300) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return (
    (url.protocol === "https:" || (url.protocol === "http:" && local)) &&
    !url.username &&
    !url.password &&
    !url.hash &&
    !endpoint.includes("#")
  );
}

function requesterCalls(fullName: string, profile: RequesterProfile): Hex[] {
  const about = profile.about.trim();
  if (!about || about.length > 600 || !isSafeRequesterEndpoint(profile.endpoint))
    throw new Error("Invalid requester records");
  return [
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [dnsEncode(fullName), RECORD_KEYS.agentContext, about],
    }),
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [dnsEncode(fullName), RECORD_KEYS.agentEndpointWeb, profile.endpoint],
    }),
  ];
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
  return deployNameContracts(keys, fullName, localityCalls(fullName, locality));
}

/** A requester's name gets the same two contracts, with its agent records written at deploy (P1-5). */
export async function deployRequesterContracts(
  keys: HouseholdKeys,
  fullName: string,
  profile: RequesterProfile,
): Promise<HouseholdContracts> {
  fullName = householdName(fullName);
  // Both checks throw before any RPC, so unsafe records never reach a transaction.
  return deployNameContracts(keys, fullName, requesterCalls(fullName, profile));
}

async function deployNameContracts(
  keys: HouseholdKeys,
  fullName: string,
  calls: Hex[],
): Promise<HouseholdContracts> {
  const client = sepoliaPublicClient();
  const wallet = sepoliaWalletClient(keys.account);
  // Writes go to a load-balanced RPC that can lag the read path, so its nonce fill can reuse a nonce the
  // first deploy already mined (seen 2026-11-06). Number the deploys here instead.
  let nextNonce: number | undefined;
  async function deploy(implementation: Hex, salt: bigint, data: Hex): Promise<Hex> {
    try {
      const predicted = await client.readContract({
        address: ENS.verifiableFactory,
        abi: verifiableFactoryAbi,
        functionName: "predictProxyAddress",
        args: [keys.address, salt],
      });
      const code = await client.getCode({ address: predicted });
      if (code && code !== "0x") {
        const actualImplementation = await client.readContract({
          address: ENS.verifiableFactory,
          abi: verifiableFactoryAbi,
          functionName: "verifyContract",
          args: [predicted],
        });
        if (actualImplementation.toLowerCase() !== implementation.toLowerCase())
          throw new Error("Unexpected household implementation");
        return predicted;
      }
      const nonce =
        nextNonce ?? (await client.getTransactionCount({ address: keys.address, blockTag: "pending" }));
      const hash = await wallet.writeContract({
        chain: sepolia,
        account: keys.account,
        address: ENS.verifiableFactory,
        abi: verifiableFactoryAbi,
        functionName: "deployProxy",
        args: [implementation, salt, data],
        nonce,
      });
      nextNonce = nonce + 1;
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
          args.proxyAddress.toLowerCase() === predicted.toLowerCase() &&
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

/**
 * Rewrites a requester's agent records. The resolver's address depends only on the owner key, so after a
 * renamed setup it already exists holding records for the earlier name.
 */
export async function setRequesterRecords(
  keys: HouseholdKeys,
  contracts: HouseholdContracts,
  fullName: string,
  profile: RequesterProfile,
): Promise<void> {
  fullName = householdName(fullName);
  const calls = requesterCalls(fullName, profile);
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
    if (receipt.status !== "success") throw new Error("Requester records update failed");
  } catch {
    throw new Error("Could not update requester records");
  }
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
