// The demo seller (P1-5), clearly a mock: a shop that asks a household for its door, made through the app
// like everything else in the demo. It gets its own key and its own name under pata.eth, through the same
// relay and contracts as a household, with ENSIP-26 records instead of a locality:
//   agent-context        who it is and what it does with an address
//   agent-endpoint[web]  its page, where the consent screen hands back the courier link (ADR 0013)
// Holding a courier link, it can prove that to anyone (a courier firm, a bank checking consent) by signing
// with the grant's owner key; the check is a public ENS read, and the address stays sealed.
import { recoverMessageAddress } from "viem";
import type { GrantRequest, Language } from "../../../shared/domain";
import { PROVIDER_NAME } from "../../../shared/constants";
import { deriveGrantIdentity, deriveHouseholdKeys, newRandomRoot, type HouseholdKeys } from "../keys";
import {
  loadSellerRoot,
  loadSellerState,
  saveSellerRoot,
  saveSellerState,
  type SellerState,
} from "../keys/store";
import { topup, registerName } from "../server-client";
import {
  deployRequesterContracts,
  householdLabelStatus,
  setRequesterRecords,
  type RequesterProfile,
} from "../ens/household";
import { householdOwner, readRequesterRecords } from "../ens/lookup";
import { grantStatusByName } from "../ens/grants";
import { isValidHouseholdLabel } from "../ens/names";
import { sepoliaPublicClient } from "../rpc";
import { parseCourierFragment, toBase64Url } from "../link";

export type { SellerState } from "../keys/store";
export type SellerStep = "funding" | "deploying" | "registering" | "checking";

export interface SellerInput {
  label: string;
  displayName: string;
  about: string;
  endpoint: string;
}

async function sellerKeys(): Promise<HouseholdKeys> {
  let root = await loadSellerRoot();
  if (!root) {
    root = newRandomRoot();
    await saveSellerRoot(root);
  }
  return deriveHouseholdKeys(root);
}

export async function loadSeller(): Promise<SellerState | null> {
  try {
    return await loadSellerState();
  } catch {
    return null;
  }
}

/** "Chai Kart" → "chai-kart"; null when no valid name comes out of it. */
export function suggestSellerLabel(displayName: string): string | null {
  const label = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
  return isValidHouseholdLabel(label) ? label : null;
}

async function confirmed(hash: `0x${string}`): Promise<void> {
  const receipt = await sepoliaPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Seller transaction reverted");
}

function sameRecords(read: { about: string | null; endpoint: string | null }, profile: RequesterProfile) {
  return read.about === profile.about && read.endpoint === profile.endpoint;
}

/**
 * Funding, contracts, name, records. Every step is safe to repeat, so Retry carries on where it stopped.
 * Throws plain sentences only.
 */
export async function setUpSeller(
  input: SellerInput,
  onProgress: (step: SellerStep) => void,
): Promise<SellerState> {
  const label = input.label.trim().toLowerCase();
  const name = `${label}.${PROVIDER_NAME}`;
  const profile: RequesterProfile = { about: input.about.trim(), endpoint: input.endpoint };
  const keys = await sellerKeys();
  const saved = await loadSellerState();
  if (saved && saved.name !== name)
    throw new Error(
      saved.ready
        ? `This phone already has a seller: ${saved.name}.`
        : `This phone is still setting up ${saved.name}. Finish that one first.`,
    );
  if (!isValidHouseholdLabel(label))
    throw new Error("Use 3–32 lowercase letters, numbers, or single hyphens.");
  const status = await householdLabelStatus(label).catch(() => {
    throw new Error("Couldn't check that name right now. Tap Retry.");
  });
  let alreadyOurs = false;
  if (status !== 0) {
    const owner = status === 2 ? await householdOwner(name).catch(() => null) : null;
    alreadyOurs = owner?.toLowerCase() === keys.address.toLowerCase();
    if (!alreadyOurs) throw new Error("That name is taken. Try another.");
  }
  const draft: SellerState = {
    name,
    displayName: input.displayName.trim(),
    about: profile.about,
    endpoint: profile.endpoint,
    ready: false,
  };
  await saveSellerState(draft);
  try {
    onProgress("funding");
    const funding = await topup(keys, { chain: "sepolia" });
    if (funding.txHash) await confirmed(funding.txHash);
    onProgress("deploying");
    const contracts = await deployRequesterContracts(keys, name, profile);
    if (!alreadyOurs) {
      onProgress("registering");
      const registration = await registerName(keys, { label, ...contracts });
      if (registration.txHash) await confirmed(registration.txHash);
    }
    onProgress("checking");
    let rewritten = false;
    for (let attempt = 0; ; attempt++) {
      const read = await readRequesterRecords(name);
      if (sameRecords(read, profile)) break;
      if (read.about !== null && !rewritten) {
        // The resolver's address depends only on the key, so it may hold an earlier name's records.
        await setRequesterRecords(keys, contracts, name, profile);
        rewritten = true;
        continue;
      }
      if (attempt >= 5) throw new Error("Seller records not visible yet");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } catch {
    throw new Error("Couldn't finish setting up the seller. Tap Retry to carry on.");
  }
  const ready = { ...draft, ready: true };
  await saveSellerState(ready);
  return ready;
}

/** The link the seller sends: /approve#<base64url GrantRequest>, read by the consent screen. */
export function addressRequestUrl(
  origin: string,
  seller: Pick<SellerState, "name" | "displayName">,
  order: { purpose: string; language: Language; durationSeconds: number },
): string {
  const request: GrantRequest = {
    requester: { displayName: seller.displayName, ensName: seller.name },
    purpose: order.purpose,
    language: order.language,
    durationSeconds: order.durationSeconds,
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(request)));
  return `${origin.replace(/\/+$/, "")}/approve/#${encoded}`;
}

/** The consent screen hands the link over in this page's "#": the full courier link, or null. */
export function receiveCourierLink(
  hash: string,
  origin: string,
): { courierLink: string; householdName: string } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const link = raw ? parseCourierFragment(raw) : null;
  if (!link || !link.householdName.endsWith(`.${PROVIDER_NAME}`)) return null;
  link.sessionKey.fill(0);
  return { courierLink: `${origin.replace(/\/+$/, "")}/c#${raw}`, householdName: link.householdName };
}

export interface GrantProof {
  grantName: string;
  challenge: string;
  owner: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}

function proofMessage(grantName: string, challenge: string): string {
  return `Pata grant proof\nGrant: ${grantName}\nChallenge: ${challenge}`;
}

/** A fresh challenge, as a verifier (say, a bank) would send one. */
export function newChallenge(): string {
  return `pata-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Signs the challenge with the grant's owner key, derived from the courier link's session key. */
export async function proveGrantHolder(courierLink: string, challenge: string): Promise<GrantProof> {
  const link = parseCourierFragment(courierLink.slice(courierLink.indexOf("#") + 1));
  if (!courierLink.includes("#") || !link) throw new Error("Invalid courier link");
  try {
    const identity = await deriveGrantIdentity(link.sessionKey);
    const grantName = `${identity.label}.${link.householdName}`;
    const message = proofMessage(grantName, challenge);
    return {
      grantName,
      challenge,
      owner: identity.owner.address,
      message,
      signature: await identity.owner.signMessage({ message }),
    };
  } finally {
    link.sessionKey.fill(0);
  }
}

/** Anyone can run this: the grant must be live, and the signer must be the owner ENS records for it. */
export async function verifyGrantProof(
  proof: GrantProof,
): Promise<
  | { valid: true; grantName: string; owner: `0x${string}` }
  | { valid: false; reason: "ended" | "not-the-holder" }
> {
  let status;
  try {
    status = await grantStatusByName(proof.grantName);
  } catch {
    throw new Error("Couldn't check the proof right now.");
  }
  if (!status.live) return { valid: false, reason: "ended" };
  if (proof.message !== proofMessage(proof.grantName, proof.challenge))
    return { valid: false, reason: "not-the-holder" };
  let signer: `0x${string}`;
  try {
    signer = await recoverMessageAddress({ message: proof.message, signature: proof.signature });
  } catch {
    return { valid: false, reason: "not-the-holder" };
  }
  if (signer.toLowerCase() !== status.owner.toLowerCase()) return { valid: false, reason: "not-the-holder" };
  return { valid: true, grantName: proof.grantName, owner: status.owner };
}
