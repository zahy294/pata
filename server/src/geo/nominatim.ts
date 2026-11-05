// AI/ML P0-7. Only locality + PIN code leave this adapter, never the way to the door.
import { z } from "zod";
import type { Locality } from "../../../shared/domain";
import { GEO_CACHE_SECONDS, GEO_USER_AGENT, geoCacheKey, paceGeo, queuedGeo, type GeoCache } from "./requests";

/** [west, south, east, north], WGS84 degrees. */
export type BBox = [number, number, number, number];
export const bboxSchema = z.tuple([
  z.number().min(-180).max(180), z.number().min(-90).max(90),
  z.number().min(-180).max(180), z.number().min(-90).max(90),
]).refine(([west, south, east, north]) => west < east && south < north);
const numericString = z.string().trim().min(1).pipe(z.coerce.number());
const rowsSchema = z.array(z.object({
  boundingbox: z.tuple([numericString, numericString, numericString, numericString]),
  type: z.string().optional(), addresstype: z.string().optional(),
  osm_type: z.enum(["node", "way", "relation"]),
  address: z.object({ postcode: z.string().optional() }).optional(),
}));

export async function localityBBox(kv: GeoCache, locality: Locality, options: { nominatimUrl?: string } = {}): Promise<BBox | null> {
  const name = locality.name.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80 || !/^\d{6}$/.test(locality.pinCode)) throw new Error("Invalid locality");
  const endpoint = options.nominatimUrl ?? "https://nominatim.openstreetmap.org/search";
  const key = await geoCacheKey("locality", `${endpoint}|${name.toLowerCase()}|${locality.pinCode}`);
  return queuedGeo(kv, "nominatim", async () => {
    try {
      const cached = await kv.get(key);
      if (cached !== null) return z.union([bboxSchema, z.null()]).parse(JSON.parse(cached));
      const url = new URL(endpoint);
      url.search = new URLSearchParams({ q: `${name}, ${locality.pinCode}`, countrycodes: "in", format: "jsonv2", limit: "1", addressdetails: "1", featureType: "settlement" }).toString();
      await paceGeo(kv, "nominatim");
      const response = await fetch(url.toString(), { headers: { "User-Agent": GEO_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error();
      const row = rowsSchema.parse(await response.json())[0];
      let bbox: BBox | null = null;
      if (row && row.type !== "postcode" && row.addresstype !== "postcode" &&
          (!row.address?.postcode || row.address.postcode.replace(/\s/g, "") === locality.pinCode)) {
        const [south, north, west, east] = row.boundingbox;
        bbox = bboxSchema.parse([west, south, east, north]);
      }
      await kv.put(key, JSON.stringify(bbox), { expirationTtl: GEO_CACHE_SECONDS });
      return bbox;
    } catch {
      throw new Error("Map search unavailable");
    }
  });
}
