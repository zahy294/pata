import { sha256, toHex } from "viem";
import { ErrorResponse, SIGNATURE_HEADERS, signedMessage } from "../../../shared/api";
import type { HouseholdKeys } from "../keys";

/** Only HTTP status, a public error code and a plain message; no upstream body/cause. */
export class ServerError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServerError";
  }
}

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
    if (!response.ok) {
      let code = "server_error";
      let message = "Server request failed";
      try {
        const parsed = ErrorResponse.safeParse(await response.json());
        if (parsed.success) {
          code = parsed.data.code;
          message = parsed.data.error;
        }
      } catch {
        /* Invalid/HTML replies get the fixed fallback, preserving status. */
      }
      throw new ServerError(response.status, code, message);
    }
    return response;
  } catch (failure) {
    if (failure instanceof ServerError) throw failure;
    // Never surface signing or network details to the UI. Status 0 means no HTTP reply.
    throw new ServerError(0, "network_error", "Server request failed");
  }
}
