// AI/ML P0-7. One query per box; landmark phrases are intentionally never transmitted.
import { z } from "zod";
import type { OsmFeature } from "../../../shared/domain";
import { bboxSchema, type BBox } from "./nominatim";
import {
  GEO_CACHE_SECONDS,
  GEO_USER_AGENT,
  backoffGeo,
  geoCacheKey,
  paceGeo,
  queuedGeo,
  type GeoCache,
} from "./requests";

export interface Street {
  osmId: string;
  name?: string;
  /** Polyline as [lon, lat] pairs. */
  coords: [number, number][];
}

const pointSchema = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const elementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().nonnegative(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: pointSchema.optional(),
  geometry: z.array(pointSchema).optional(),
  tags: z.record(z.string(), z.string()).default({}),
});
// Places of worship use amenity=place_of_worship and are covered by amenity.
const categories = ["amenity", "shop", "building", "tourism", "leisure"];
const resultSchema = z.object({
  features: z.array(z.object({ osmId: z.string(), name: z.string(), kind: z.string(), point: pointSchema })),
  streets: z.array(
    z.object({
      osmId: z.string(),
      name: z.string().optional(),
      coords: z.array(z.tuple([z.number(), z.number()])),
    }),
  ),
});

export async function featuresInBox(
  kv: GeoCache,
  bbox: BBox,
  landmarkPhrases: string[],
  options: { overpassUrl?: string; overpassFallbackUrl?: string } = {},
): Promise<{ features: OsmFeature[]; streets: Street[] }> {
  void landmarkPhrases;
  if (!bboxSchema.safeParse(bbox).success) throw new Error("Invalid locality bounds");
  const endpoint = options.overpassUrl ?? "https://overpass-api.de/api/interpreter";
  const fallback = options.overpassFallbackUrl ?? "https://overpass.private.coffee/api/interpreter";
  const key = await geoCacheKey("features", `${endpoint}|${fallback}|${JSON.stringify(bbox)}`);
  return queuedGeo(kv, "overpass", async () => {
    try {
      const cached = await kv.get(key);
      if (cached !== null) return resultSchema.parse(JSON.parse(cached));
      const [west, south, east, north] = bbox;
      const query = `[out:json][timeout:60][maxsize:67108864][bbox:${south},${west},${north},${east}];\n(\n${categories.map((key) => `nwr["${key}"]["name"];`).join("\n")}\n);\nout tags center;\nway["highway"~"^(residential|service|living_street|unclassified|tertiary|secondary|primary|pedestrian|footway|path)$"];\nout tags geom;`;
      let response: Response | undefined;
      for (const url of [endpoint, fallback]) {
        await paceGeo(kv, "overpass");
        response = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": GEO_USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(90_000),
        });
        if (![429, 504, 406].includes(response.status)) break;
        await backoffGeo(kv, "overpass", response.headers.get("Retry-After"));
        await response.body?.cancel();
      }
      if (!response?.ok) throw new Error("Map search unavailable");
      const data = z
        .object({ elements: z.array(z.unknown()), remark: z.string().optional() })
        .parse(await response.json());
      if (data.remark) throw new Error();
      const features = new Map<string, OsmFeature>();
      const streets = new Map<string, Street>();
      for (const raw of data.elements) {
        const parsed = elementSchema.safeParse(raw);
        if (!parsed.success) continue;
        const element = parsed.data;
        const osmId = `${element.type}/${element.id}`;
        const name = element.tags.name;
        const kind = categories.find((key) => element.tags[key]);
        const point = element.type === "node" ? pointSchema.safeParse(element).data : element.center;
        if (
          name &&
          kind &&
          point &&
          point.lon >= west &&
          point.lon <= east &&
          point.lat >= south &&
          point.lat <= north
        ) {
          features.set(osmId, { osmId, name, kind: `${kind}=${element.tags[kind]}`, point });
        }
        if (
          element.type === "way" &&
          element.tags.highway &&
          element.geometry &&
          element.geometry.length >= 2
        ) {
          streets.set(osmId, {
            osmId,
            ...(name ? { name } : {}),
            coords: element.geometry.map(({ lon, lat }) => [lon, lat]),
          });
        }
      }
      const result = { features: [...features.values()], streets: [...streets.values()] };
      await kv.put(key, JSON.stringify(result), { expirationTtl: GEO_CACHE_SECONDS });
      return result;
    } catch {
      // Preserve hand-dropped-pin fallback; never cache a failed/partial map reply.
      return { features: [], streets: [] };
    }
  });
}
