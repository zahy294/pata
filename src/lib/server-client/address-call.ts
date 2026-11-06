import type { z } from "zod";
import type { HouseholdKeys } from "../keys";
import { ServerError, signedPost } from "./signed";

// Anthropic intermittently answers 403 "forbidden / Request not allowed" depending on the network path
// Cloudflare uses for the Worker's outbound call (~1 call in 7 on 2026-11-06, for every model). The path
// holds for one request but usually differs on the next, so a fresh request is the fix. Only the routes'
// "model unavailable" 502s are retried; a refused call isn't billed.
const RETRYABLE = new Set(["address_unavailable", "directions_unavailable"]);
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

/** Address schemas on the owner's common signed transport. */
export async function postAddress<T>(
  keys: HouseholdKeys,
  route: string,
  request: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const body = JSON.stringify(request);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await signedPost(keys, route, body);
      return schema.parse(await response.json());
    } catch (failure) {
      if (
        failure instanceof ServerError &&
        failure.status === 502 &&
        RETRYABLE.has(failure.code) &&
        attempt < ATTEMPTS
      ) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      if (failure instanceof ServerError) throw failure;
      throw new Error("Address service unavailable");
    }
  }
}
