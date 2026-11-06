import { asc } from "@arkiv-network/sdk/query";
import { hexToBytes, type Hex } from "viem";
import type { HouseholdKeys } from "../keys";
import { arkivPublicClient } from "../rpc";
import type { homeSchema } from "./schemas";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}

// Discovery errors propagate: a failed query is never permission to send a duplicate create.
export async function findSealedRecord(
  keys: HouseholdKeys,
  schema: typeof homeSchema,
  matches: (sealed: Uint8Array) => Promise<boolean>,
): Promise<Hex | null> {
  for (let offset = 0; ; offset += 100) {
    const page = await arkivPublicClient()
      .select({ $key: true, $owner: true, sealed: true })
      .from(schema)
      .ownedBy(keys.address)
      .orderBy(asc("$key"))
      .limit(100)
      .offset(offset)
      .fetch();
    for (const row of page.entities) {
      if (row.$owner.toLowerCase() !== keys.address.toLowerCase()) continue;
      try {
        if (await matches(hexToBytes(row.sealed.value))) return row.$key;
      } catch {
        /* An unreadable or unrelated entity is not a matching home/clip. */
      }
    }
    if (page.entities.length + page.skipped < 100) return null;
  }
}
