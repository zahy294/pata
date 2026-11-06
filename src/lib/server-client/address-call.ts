import type { z } from "zod";
import type { HouseholdKeys } from "../keys";
import { ServerError, signedPost } from "./signed";

/** Address schemas on the owner's common signed transport. */
export async function postAddress<T>(
  keys: HouseholdKeys,
  route: string,
  request: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const response = await signedPost(keys, route, JSON.stringify(request));
    return schema.parse(await response.json());
  } catch (failure) {
    if (failure instanceof ServerError) throw failure;
    throw new Error("Address service unavailable");
  }
}
