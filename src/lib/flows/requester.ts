// Who is asking (P1-5): the consent screen reads the requester's own ENS name, not just what the request
// claims. ENSIP-26 records: `agent-context` (who it is) and `agent-endpoint[web]` (where it takes the link).
// The hand-off puts the courier link after the endpoint's "#", so it reaches the requester's page without
// any server, ours or theirs, receiving the session key in a request (ADR 0006, ADR 0013).
import { normalize } from "viem/ens";
import { readRequesterRecords } from "../ens/lookup";
import { isSafeRequesterEndpoint } from "../ens/household";
import { parseCourierFragment } from "../link";

export type RequesterCheck =
  | {
      state: "verified";
      ensName: string;
      /** The requester's `agent-context`, trimmed for display. */
      about: string;
      /** Null when the name publishes no endpoint we'd send a household to. */
      endpoint: string | null;
      endpointHost: string | null;
    }
  | { state: "unverified"; ensName: string };

export async function checkRequester(ensName: string): Promise<RequesterCheck> {
  let name: string;
  try {
    name = normalize(ensName.trim());
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) throw new Error();
  } catch {
    return { state: "unverified", ensName };
  }
  let records: { about: string | null; endpoint: string | null };
  try {
    records = await readRequesterRecords(name);
  } catch {
    throw new Error("Couldn't check who is asking right now.");
  }
  const about = records.about?.trim().slice(0, 600);
  if (!about) return { state: "unverified", ensName: name };
  const endpoint = records.endpoint && isSafeRequesterEndpoint(records.endpoint) ? records.endpoint : null;
  return {
    state: "verified",
    ensName: name,
    about,
    endpoint,
    endpointHost: endpoint ? new URL(endpoint).host : null,
  };
}

/** The requester's endpoint with the courier link's "#" part appended. */
export function handOffUrl(endpoint: string, courierLink: string): string {
  if (!isSafeRequesterEndpoint(endpoint)) throw new Error("Unsafe requester endpoint");
  const hash = courierLink.slice(courierLink.indexOf("#") + 1);
  if (!courierLink.includes("#") || !parseCourierFragment(hash)) throw new Error("Invalid courier link");
  return `${endpoint}#${hash}`;
}
