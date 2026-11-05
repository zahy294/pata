import type { z } from "zod";
import { SIGNATURE_HEADERS, signedMessage } from "../../../shared/api";
import type { HouseholdKeys } from "../keys";
import { env } from "../env";

/** Address-only transport. Chain owners can integrate their calls separately. */
export async function postAddress<T>(
  keys: HouseholdKeys,
  route: string,
  request: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const body = JSON.stringify(request);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await keys.account.signMessage({ message: signedMessage(route, timestamp, hash) });
    const response = await fetch(new URL(route, env.serverUrl).toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADERS.address]: keys.account.address,
        [SIGNATURE_HEADERS.timestamp]: String(timestamp),
        [SIGNATURE_HEADERS.signature]: signature,
      },
      body,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    return schema.parse(await response.json());
  } catch {
    throw new Error("Address service unavailable");
  }
}
