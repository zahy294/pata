// AI/ML P0-7. Only locality + PIN code leave this adapter, never the way to the door.
import { z } from "zod";
import type { Locality } from "../../../shared/domain";
import {
  GEO_CACHE_SECONDS,
  GEO_USER_AGENT,
  geoCacheKey,
  paceGeo,
  queuedGeo,
  type GeoCache,
} from "./requests";

/** [west, south, east, north], WGS84 degrees. */
export type BBox = [number, number, number, number];
export const bboxSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine(([west, south, east, north]) => west < east && south < north);
const numericString = z.string().trim().min(1).pipe(z.coerce.number());
const rowsSchema = z.array(
  z.object({
    boundingbox: z.tuple([numericString, numericString, numericString, numericString]),
    type: z.string().optional(),
    addresstype: z.string().optional(),
    osm_type: z.enum(["node", "way", "relation"]),
    address: z.object({ postcode: z.string().optional() }).optional(),
  }),
);
const postcodeRowsSchema = z.array(
  z.object({
    lat: numericString.pipe(z.number().min(-90).max(90)),
    lon: numericString.pipe(z.number().min(-180).max(180)),
  }),
);
/** Half the side of the search box around a PIN code's centre: 0.012° ≈ 1.3 km. */
const PIN_BOX_DEGREES = 0.012;

export async function localityBBox(
  kv: GeoCache,
  locality: Locality,
  options: { nominatimUrl?: string } = {},
): Promise<BBox | null> {
  const name = locality.name.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80 || !/^\d{6}$/.test(locality.pinCode)) throw new Error("Invalid locality");
  const endpoint = options.nominatimUrl ?? "https://nominatim.openstreetmap.org/search";
  // v2: v1 cached "not found" for 30 days before the PIN-centre fallback existed.
  const key = await geoCacheKey("locality", `v2|${endpoint}|${name.toLowerCase()}|${locality.pinCode}`);
  const search = async (params: Record<string, string>): Promise<unknown> => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      countrycodes: "in",
      format: "jsonv2",
      limit: "1",
      ...params,
    }).toString();
    await paceGeo(kv, "nominatim");
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": GEO_USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error();
    return response.json();
  };
  return queuedGeo(kv, "nominatim", async () => {
    try {
      const cached = await kv.get(key);
      if (cached !== null) return z.union([bboxSchema, z.null()]).parse(JSON.parse(cached));
      const row = rowsSchema.parse(
        await search({ q: `${name}, ${locality.pinCode}`, addressdetails: "1", featureType: "settlement" }),
      )[0];
      let bbox: BBox | null = null;
      if (
        row &&
        row.type !== "postcode" &&
        row.addresstype !== "postcode" &&
        (!row.address?.postcode || row.address.postcode.replace(/\s/g, "") === locality.pinCode)
      ) {
        const [south, north, west, east] = row.boundingbox;
        bbox = bboxSchema.parse([west, south, east, north]);
      }
      if (!bbox) {
        // OSM's Indian postcodes are patchy (BKC is filed under 400098, not 400051), so "area, PIN" often
        // finds nothing. Fall back to the PIN's centre: Nominatim's own postcode box is a fixed ~10 km
        // square, too big for a landmark search, so search a ~2.6 km box around the centre instead.
        const centre = postcodeRowsSchema.parse(await search({ postalcode: locality.pinCode }))[0];
        if (centre)
          bbox = bboxSchema.parse([
            centre.lon - PIN_BOX_DEGREES,
            centre.lat - PIN_BOX_DEGREES,
            centre.lon + PIN_BOX_DEGREES,
            centre.lat + PIN_BOX_DEGREES,
          ]);
      }
      await kv.put(key, JSON.stringify(bbox), { expirationTtl: GEO_CACHE_SECONDS });
      return bbox;
    } catch {
      throw new Error("Map search unavailable");
    }
  });
}
