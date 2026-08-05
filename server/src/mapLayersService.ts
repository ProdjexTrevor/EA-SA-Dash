import { query, num } from "./db.js";

export type AdminLevel = 1 | 2;

export type AdminBoundaryFeature = {
  type: "Feature";
  properties: {
    id: number;
    country_iso: string;
    country_name: string;
    region: string | null;
    adm_level: number;
    shape_name: string;
    shape_id: string | null;
    centroid_lat: number | null;
    centroid_lon: number | null;
    source: string;
  };
  geometry: unknown;
};

export type PlaceLabel = {
  id: number;
  name: string;
  place_class: string | null;
  country_iso: string | null;
  country_name: string | null;
  latitude: number;
  longitude: number;
  population: number | null;
};

/**
 * Admin polygons from Dash_AdminBoundaries (seeded geoBoundaries simplified).
 * Optional bbox filter: minLon,minLat,maxLon,maxLat (WGS84).
 */
export async function getAdminBoundaries(params: {
  level: AdminLevel;
  country_iso?: string;
  bbox?: [number, number, number, number];
}): Promise<{
  type: "FeatureCollection";
  features: AdminBoundaryFeature[];
  meta: { count: number; source: string; level: number };
}> {
  const level = params.level;
  const clauses = ["adm_level = ?"];
  const args: unknown[] = [level];
  if (params.country_iso) {
    clauses.push("country_iso = ?");
    args.push(params.country_iso.toUpperCase());
  }
  if (params.bbox) {
    const [minLon, minLat, maxLon, maxLat] = params.bbox;
    clauses.push(
      "centroid_lon BETWEEN ? AND ? AND centroid_lat BETWEEN ? AND ?"
    );
    args.push(minLon, maxLon, minLat, maxLat);
  }

  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      id, country_iso, country_name, region, adm_level,
      shape_name, shape_id, geometry_json,
      centroid_lat, centroid_lon, source
    FROM Dash_AdminBoundaries
    WHERE ${clauses.join(" AND ")}
    ORDER BY country_iso, shape_name
    `
    ,
    args
  );

  const features: AdminBoundaryFeature[] = [];
  for (const r of rows) {
    let geometry: unknown;
    try {
      geometry = JSON.parse(String(r.geometry_json));
    } catch {
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        id: num(r.id),
        country_iso: String(r.country_iso),
        country_name: String(r.country_name),
        region: r.region != null ? String(r.region) : null,
        adm_level: num(r.adm_level),
        shape_name: String(r.shape_name),
        shape_id: r.shape_id != null ? String(r.shape_id) : null,
        centroid_lat: r.centroid_lat != null ? Number(r.centroid_lat) : null,
        centroid_lon: r.centroid_lon != null ? Number(r.centroid_lon) : null,
        source: String(r.source ?? "geoBoundaries"),
      },
      geometry,
    });
  }

  return {
    type: "FeatureCollection",
    features,
    meta: {
      count: features.length,
      source: "Dash_AdminBoundaries ← geoBoundaries simplified (CC BY 4.0)",
      level,
    },
  };
}

export async function getPlaceLabels(params?: {
  min_population?: number;
  limit?: number;
}): Promise<{ places: PlaceLabel[]; meta: { count: number; source: string } }> {
  const minPop = params?.min_population ?? 0;
  const limit = Math.min(params?.limit ?? 2000, 5000);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT id, name, place_class, country_iso, country_name,
           latitude, longitude, population
    FROM Dash_PlaceLabels
    WHERE (? = 0 OR population IS NULL OR population >= ?)
    ORDER BY COALESCE(population, 0) DESC
    LIMIT ?
    `,
    [minPop, minPop, limit]
  );

  const places: PlaceLabel[] = rows.map((r) => ({
    id: num(r.id),
    name: String(r.name),
    place_class: r.place_class != null ? String(r.place_class) : null,
    country_iso: r.country_iso != null ? String(r.country_iso) : null,
    country_name: r.country_name != null ? String(r.country_name) : null,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    population: r.population != null ? num(r.population) : null,
  }));

  return {
    places,
    meta: {
      count: places.length,
      source: "Dash_PlaceLabels ← Natural Earth 10m places (public domain)",
    },
  };
}
