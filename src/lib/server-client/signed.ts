import { sha256, toHex } from "viem";
import { SIGNATURE_HEADERS, signedMessage } from "../../../shared/api";
import type { HouseholdKeys } from "../keys";

/** Shared by JSON and raw-audio calls. `route` includes any query string. */
export async function signedPost(
  keys: HouseholdKeys,
  route: string,
  body: string | Blob,
  contentType = "application/json",
): Promise<Response> {
  try {
    const base = process.env.NEXT_PUBLIC_SERVER_URL;
    if (!base || !/^\/(?!\/)/.test(route) || route.includes("#")) throw new Error();
    const bytes =
      typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(await body.arrayBuffer());
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await keys.account.signMessage({
      message: signedMessage(route, timestamp, sha256(toHex(bytes)).slice(2)),
    });
    const response = await fetch(`${base.replace(/\/$/, "")}${route}`, {
      method: "POST",
      body,
      headers: {
        "content-type": contentType,
        [SIGNATURE_HEADERS.address]: keys.address,
        [SIGNATURE_HEADERS.timestamp]: String(timestamp),
        [SIGNATURE_HEADERS.signature]: signature,
      },
    });
    if (!response.ok) throw new Error();
    return response;
  } catch {
    // Never surface a signing, network or server error body to the UI.
    throw new Error("Server request failed");
  }
}
