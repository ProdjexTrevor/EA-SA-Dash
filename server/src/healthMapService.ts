import { query, num } from "./db.js";
import { getDmmHealthAssessments } from "./dmmHealthService.js";
import type { AssessmentResult } from "./dmmHealthAssessment.js";
import { computeMovementSpread } from "./healthMapSpread.js";
import { normalizeQuarterEnd } from "./quarterDates.js";

export type HealthMapPoint = {
  engagement_id: number;
  engagement_name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  locality: string | null;
  population_local: number | null;
  pop_density_per_km2: number;
  urban_rural: string | null;
  is_demo: boolean;
  geocode_source: string;
  health_score: number;
  classification: string;
  movement_verified: boolean;
  summary: string;
  heat: number; // 0–1 for heatmap intensity
  spread_radius_mi: number;
  healthy_ideal_radius_mi: number;
  estimated_people_in_radius: number;
  density_factor: number;
  score_factor: number;
  assessment: AssessmentResult;
};

export async function getHealthMap(quarterEnd: string): Promise<{
  quarter_end: string;
  points: HealthMapPoint[];
  legend: {
    heat: string;
    spread: string;
    data_note: string;
  };
  summary: {
    points: number;
    avg_health_score: number;
    avg_spread_mi: number;
    total_estimated_people_in_radii: number;
  };
}> {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return {
      quarter_end: quarterEnd,
      points: [],
      legend: {
        heat: "Color by DMM health score (red low → green high).",
        spread: "Circle radius = model miles a healthy pattern can spread at this score & density.",
        data_note: "Geocodes from Dash_EngagementGeo only.",
      },
      summary: {
        points: 0,
        avg_health_score: 0,
        avg_spread_mi: 0,
        total_estimated_people_in_radii: 0,
      },
    };
  }

  const [geoRows, dmm] = await Promise.all([
    query<Record<string, unknown>>(
      `
      SELECT
        engagement_id,
        engagement_name,
        country,
        region,
        latitude,
        longitude,
        locality,
        population_local,
        pop_density_per_km2,
        urban_rural,
        is_demo,
        geocode_source
      FROM Dash_EngagementGeo
      `
    ),
    getDmmHealthAssessments(qEnd, {}),
  ]);

  const byEngId = new Map<number, AssessmentResult>();
  for (const a of dmm.rows) {
    if (a.engagement_id != null) byEngId.set(a.engagement_id, a);
  }

  const points: HealthMapPoint[] = [];
  for (const g of geoRows) {
    const eid = num(g.engagement_id);
    const assessment = byEngId.get(eid);
    if (!assessment) continue;

    const density = Number(g.pop_density_per_km2) || 50;
    const spread = computeMovementSpread({
      health_score: assessment.health_score,
      pop_density_per_km2: density,
      classification: assessment.classification,
    });

    points.push({
      engagement_id: eid,
      engagement_name: assessment.engagement_name,
      country: String(g.country ?? assessment.country ?? ""),
      region: String(g.region ?? assessment.region ?? ""),
      latitude: Number(g.latitude),
      longitude: Number(g.longitude),
      locality: g.locality != null ? String(g.locality) : null,
      population_local: g.population_local != null ? num(g.population_local) : null,
      pop_density_per_km2: density,
      urban_rural: g.urban_rural != null ? String(g.urban_rural) : null,
      is_demo: num(g.is_demo) === 1,
      geocode_source: String(g.geocode_source ?? "seeded"),
      health_score: assessment.health_score,
      classification: assessment.classification,
      movement_verified: assessment.movement_verified,
      summary: assessment.summary,
      heat: Math.max(0.05, assessment.health_score / 100),
      spread_radius_mi: spread.spread_radius_mi,
      healthy_ideal_radius_mi: spread.healthy_ideal_radius_mi,
      estimated_people_in_radius: spread.estimated_people_in_radius,
      density_factor: spread.density_factor,
      score_factor: spread.score_factor,
      assessment,
    });
  }

  const sumScore = points.reduce((s, p) => s + p.health_score, 0);
  const sumSpread = points.reduce((s, p) => s + p.spread_radius_mi, 0);
  const sumPeople = points.reduce((s, p) => s + p.estimated_people_in_radius, 0);

  return {
    quarter_end: qEnd,
    points,
    legend: {
      heat: "Marker color: DMM health score — red (low) → amber → green (high).",
      spread:
        "Circle size: estimated miles of healthy movement reach (score × density compression × classification). High density = fewer miles, more people.",
      data_note:
        "Locations from Dash_EngagementGeo (synthetic seed). Population density is seeded, not census. Scores recompute from Dash_all_data each request.",
    },
    summary: {
      points: points.length,
      avg_health_score: points.length ? Math.round((sumScore / points.length) * 10) / 10 : 0,
      avg_spread_mi: points.length ? Math.round((sumSpread / points.length) * 10) / 10 : 0,
      total_estimated_people_in_radii: sumPeople,
    },
  };
}
