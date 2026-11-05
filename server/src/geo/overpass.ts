// AI/ML P0-7. One query per box; landmark phrases are intentionally never transmitted.
import { z } from "zod";
import type { OsmFeature } from "../../../shared/domain";
import type { BBox } from "./nominatim";
import { GEO_CACHE_SECONDS, GEO_USER_AGENT, geoCacheKey, paceGeo, queuedGeo, type GeoCache } from "./requests";

export interface Street {
  osmId: string;
  name?: string;
  /** Polyline as [lon, lat] pairs. */
  coords: [number, number][];
}

const pointSchema = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const elementSchema = z.object({
  type: z.enum(["node", "way", "relation"]), id: z.number().int().nonnegative(),
  lat: z.number().optional(), lon: z.number().optional(),
  center: pointSchema.optional(), geometry: z.array(pointSchema).optional(),
  tags: z.record(z.string(), z.string()).default({}),
});
const categories = ["amenity", "shop", "building", "tourism", "leisure", "place_of_worship"];
const resultSchema = z.object({
  features: z.array(z.object({ osmId: z.string(), name: z.string(), kind: z.string(), point: pointSchema })),
  streets: z.array(z.object({ osmId: z.string(), name: z.string().optional(), coords: z.array(z.tuple([z.number(), z.number()])) })),
});

export async function featuresInBox(
  kv: GeoCache, bbox: BBox, landmarkPhrases: string[],
): Promise<{ features: OsmFeature[]; streets: Street[] }> {
  void landmarkPhrases;
  const key = await geoCacheKey("features", JSON.stringify(bbox));
  return queuedGeo(kv, "overpass", async () => {
  const cached = await kv.get(key);
  if (cached !== null) return resultSchema.parse(JSON.parse(cached));
  const [west, south, east, north] = bbox;
  const query = `[out:json][timeout:25][maxsize:67108864][bbox:${south},${west},${north},${east}];\n(\n${categories.map((key) => `nwr["${key}"]["name"];`).join("\n")}\n);\nout tags center;\nway["highway"];\nout tags geom;`;
  await paceGeo(kv, "overpass");
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST", headers: { "User-Agent": GEO_USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }).toString(), signal: AbortSignal.timeout(35_000),
  });
  const data = z.object({ elements: z.array(z.unknown()) }).parse(await response.json());
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
    if (name && kind && point && point.lon >= west && point.lon <= east && point.lat >= south && point.lat <= north) {
      features.set(osmId, { osmId, name, kind: `${kind}=${element.tags[kind]}`, point });
    }
    if (element.type === "way" && element.tags.highway && element.geometry && element.geometry.length >= 2) {
      streets.set(osmId, { osmId, ...(name ? { name } : {}), coords: element.geometry.map(({ lon, lat }) => [lon, lat]) });
    }
  }
  const result = { features: [...features.values()], streets: [...streets.values()] };
  await kv.put(key, JSON.stringify(result), { expirationTtl: GEO_CACHE_SECONDS });
  return result;
  });
}
