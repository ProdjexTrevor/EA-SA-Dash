import { query } from "./db.js";
import { getDmmHealthAssessments } from "./dmmHealthService.js";
import type { AssessmentResult, DmmClassification } from "./dmmHealthAssessment.js";
import { getHealthMap } from "./healthMapService.js";
import { getAdminBoundaries } from "./mapLayersService.js";
import { normalizeQuarterEnd, priorQuarterEnd } from "./quarterDates.js";
import { formatPlaceName } from "./formatPlaceName.js";
import { DEMO_NARRATIVES, matchNarrative, type DemoNarrative, type GenNode } from "./demoNarratives.js";
import { getNotReportingEngagements } from "./analyticsService.js";

const CLASS_ORDER: DmmClassification[] = [
  "Sustained Movement",
  "Movement",
  "Multiplying",
  "Fruitful",
  "Active",
  "Unhealthy",
  "Insufficient Data",
];

function engKey(r: AssessmentResult): string {
  if (r.engagement_id != null) return `id:${r.engagement_id}`;
  return `n:${(r.engagement_name || "").toLowerCase()}|${(r.country || "").toLowerCase()}`;
}

export type MoverRow = {
  engagement_id: number | null;
  engagement_name: string;
  region: string;
  country: string;
  health_score: number;
  prior_score: number | null;
  delta_score: number | null;
  classification: DmmClassification;
  prior_classification: string | null;
  classification_changed: boolean;
  direction: "up" | "down" | "flat" | "new";
  summary: string;
};

function buildMovers(
  current: AssessmentResult[],
  prior: AssessmentResult[],
  limit: number
): { gains: MoverRow[]; risks: MoverRow[]; all: MoverRow[] } {
  const priorBy = new Map(prior.map((p) => [engKey(p), p]));
  const all: MoverRow[] = [];

  for (const c of current) {
    const p = priorBy.get(engKey(c));
    let direction: MoverRow["direction"] = "new";
    let delta: number | null = null;
    if (p) {
      delta = Math.round((c.health_score - p.health_score) * 10) / 10;
      if (delta > 0.5) direction = "up";
      else if (delta < -0.5) direction = "down";
      else direction = "flat";
    }
    all.push({
      engagement_id: c.engagement_id,
      engagement_name: c.engagement_name,
      region: c.region ?? "",
      country: c.country ?? "",
      health_score: c.health_score,
      prior_score: p?.health_score ?? null,
      delta_score: delta,
      classification: c.classification,
      prior_classification: p?.classification ?? null,
      classification_changed: Boolean(p && p.classification !== c.classification),
      direction,
      summary: c.summary,
    });
  }

  const ranked = all.filter((m) => m.delta_score != null);
  const gains = [...ranked].sort((a, b) => (b.delta_score ?? 0) - (a.delta_score ?? 0)).slice(0, limit);
  const risks = [...ranked].sort((a, b) => (a.delta_score ?? 0) - (b.delta_score ?? 0)).slice(0, limit);
  return { gains, risks, all };
}

export async function getMovers(quarterEnd: string, limit = 15) {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return { quarter_end: quarterEnd, prior_quarter: null, gains: [], risks: [], flat_count: 0, new_count: 0 };
  }
  const priorQ = priorQuarterEnd(qEnd);
  const [curr, prev] = await Promise.all([
    getDmmHealthAssessments(qEnd, {}),
    getDmmHealthAssessments(priorQ, {}),
  ]);
  const { gains, risks, all } = buildMovers(curr.rows, prev.rows, limit);
  return {
    quarter_end: qEnd,
    prior_quarter: priorQ,
    gains,
    risks,
    flat_count: all.filter((m) => m.direction === "flat").length,
    new_count: all.filter((m) => m.direction === "new").length,
    compared: all.filter((m) => m.delta_score != null).length,
    total: all.length,
  };
}

export async function getPortfolio(quarterEnd: string) {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return emptyPortfolio(quarterEnd);
  }
  const priorQ = priorQuarterEnd(qEnd);
  const [dmm, movers, reporting] = await Promise.all([
    getDmmHealthAssessments(qEnd, {}),
    getMovers(qEnd, 8),
    getNotReportingEngagements(qEnd).catch(() => ({
      rows: [] as { engagement_name: string }[],
      summary: {
        total_engagements: 0,
        reporting_this_quarter: 0,
        not_reporting: 0,
      },
    })),
  ]);

  const regionMap = new Map<
    string,
    { region: string; count: number; score_sum: number; unhealthy: number; fruitful_plus: number }
  >();
  for (const r of dmm.rows) {
    const reg = r.region || "Unknown";
    if (!regionMap.has(reg)) {
      regionMap.set(reg, {
        region: reg,
        count: 0,
        score_sum: 0,
        unhealthy: 0,
        fruitful_plus: 0,
      });
    }
    const x = regionMap.get(reg)!;
    x.count++;
    x.score_sum += r.health_score;
    if (r.classification === "Unhealthy" || r.classification === "Insufficient Data") x.unhealthy++;
    if (
      r.classification === "Fruitful" ||
      r.classification === "Multiplying" ||
      r.classification === "Movement" ||
      r.classification === "Sustained Movement"
    ) {
      x.fruitful_plus++;
    }
  }

  const regions = Array.from(regionMap.values())
    .map((x) => ({
      region: x.region,
      engagements: x.count,
      avg_health_score: x.count ? Math.round((x.score_sum / x.count) * 10) / 10 : 0,
      unhealthy: x.unhealthy,
      fruitful_plus: x.fruitful_plus,
    }))
    .sort((a, b) => b.avg_health_score - a.avg_health_score);

  const funnel = CLASS_ORDER.map((c) => ({
    classification: c,
    count: dmm.summary.by_classification[c] ?? 0,
  }));

  const stories = DEMO_NARRATIVES.filter((n) => n.id !== "moon-generic").slice(0, 4);

  return {
    quarter_end: qEnd,
    prior_quarter: priorQ,
    headline: {
      engagements: dmm.summary.total,
      avg_health_score: dmm.summary.avg_health_score,
      baptism_needs_attention: dmm.summary.baptism_needs_attention,
      leadership_needs_attention: dmm.summary.leadership_needs_attention,
      movement_verified_count: dmm.summary.movement_verified_count,
    },
    funnel,
    regions,
    top_gains: movers.gains,
    top_risks: movers.risks,
    freshness: {
      expected: reporting.summary?.total_engagements ?? 0,
      reporting: reporting.summary?.reporting_this_quarter ?? 0,
      not_reporting: reporting.summary?.not_reporting ?? reporting.rows?.length ?? 0,
      reporting_rate:
        reporting.summary?.total_engagements > 0
          ? Math.round(
              (1000 * (reporting.summary.reporting_this_quarter ?? 0)) /
                reporting.summary.total_engagements
            ) / 10
          : null,
      late_examples: (reporting.rows ?? [])
        .slice(0, 5)
        .map((r: { engagement_name?: string }) =>
          formatPlaceName(r.engagement_name || "Unknown")
        ),
    },
    stories_preview: stories.map((s) => ({
      id: s.id,
      label: s.engagement_label,
      region: s.region,
      country: s.country,
      highlight: s.highlight.slice(0, 140) + (s.highlight.length > 140 ? "…" : ""),
    })),
    data_limitations: dmm.data_limitations,
  };
}

function emptyPortfolio(quarter_end: string) {
  return {
    quarter_end,
    prior_quarter: null as string | null,
    headline: {
      engagements: 0,
      avg_health_score: 0,
      baptism_needs_attention: 0,
      leadership_needs_attention: 0,
      movement_verified_count: 0,
    },
    funnel: CLASS_ORDER.map((c) => ({ classification: c, count: 0 })),
    regions: [] as Array<{
      region: string;
      engagements: number;
      avg_health_score: number;
      unhealthy: number;
      fruitful_plus: number;
    }>,
    top_gains: [] as MoverRow[],
    top_risks: [] as MoverRow[],
    freshness: {
      expected: 0,
      reporting: 0,
      not_reporting: 0,
      reporting_rate: null as number | null,
      late_examples: [] as string[],
    },
    stories_preview: [],
    data_limitations: [] as string[],
  };
}

export type HistoryPoint = {
  quarter_end: string;
  dbs: number | null;
  total_church: number | null;
  new_disciples: number | null;
  new_baptisms: number | null;
  gen: number | null;
  leaders_in_training: number | null;
  active_trainers: number | null;
};

const NEXT_LEVEL: Record<DmmClassification, DmmClassification | null> = {
  "Insufficient Data": "Active",
  Unhealthy: "Active",
  Active: "Fruitful",
  Fruitful: "Multiplying",
  Multiplying: "Movement",
  Movement: "Sustained Movement",
  "Sustained Movement": null,
};

export async function getEngagementProfile(params: {
  date: string;
  engagement_id?: number;
  name?: string;
}): Promise<{
  quarter_end: string;
  assessment: AssessmentResult | null;
  history: HistoryPoint[];
  geo: {
    latitude: number;
    longitude: number;
    locality: string | null;
    pop_density_per_km2: number | null;
  } | null;
  narrative: DemoNarrative | null;
  path_to_next: {
    current: DmmClassification;
    next: DmmClassification | null;
    blockers: string[];
    actions: string[];
  } | null;
  demo_lineage: { enabled: boolean; tree: GenNode | null; note: string };
}> {
  const qEnd = normalizeQuarterEnd(params.date);
  if (!qEnd) {
    return {
      quarter_end: params.date,
      assessment: null,
      history: [],
      geo: null,
      narrative: null,
      path_to_next: null,
      demo_lineage: { enabled: false, tree: null, note: "" },
    };
  }

  const dmm = await getDmmHealthAssessments(qEnd, {});
  let assessment =
    params.engagement_id != null
      ? dmm.rows.find((r) => r.engagement_id === params.engagement_id) ?? null
      : null;
  if (!assessment && params.name) {
    const q = params.name.toLowerCase();
    assessment =
      dmm.rows.find((r) => r.engagement_name.toLowerCase().includes(q)) ??
      dmm.rows.find((r) => (r.people_group || "").toLowerCase().includes(q)) ??
      null;
  }

  if (!assessment && params.engagement_id == null && !params.name) {
    assessment = dmm.rows[0] ?? null;
  }

  const engagementId = assessment?.engagement_id ?? params.engagement_id ?? null;
  const engName = assessment?.engagement_name ?? params.name ?? "";

  const historyRows = await query<Record<string, unknown>>(
    engagementId != null
      ? `
      SELECT DATE_FORMAT(\`date\`, '%Y-%m-%d') AS quarter_end,
             dbs, total_church, new_disciples, new_baptisms, gen,
             leaders_in_training, active_trainers_choaches AS active_trainers
      FROM Dash_all_data
      WHERE engagement_id = ?
      ORDER BY \`date\` ASC
      LIMIT 24
      `
      : `
      SELECT DATE_FORMAT(\`date\`, '%Y-%m-%d') AS quarter_end,
             dbs, total_church, new_disciples, new_baptisms, gen,
             leaders_in_training, active_trainers_choaches AS active_trainers
      FROM Dash_all_data
      WHERE engagment_name LIKE ?
      ORDER BY \`date\` ASC
      LIMIT 24
      `,
    engagementId != null ? [engagementId] : [`%${engName.slice(0, 40)}%`]
  );

  // Dedupe by quarter keep densest row
  const histMap = new Map<string, HistoryPoint & { q: number }>();
  for (const r of historyRows) {
    const qe = String(r.quarter_end);
    const quality =
      (Number(r.total_church) || 0) * 100 +
      (Number(r.new_disciples) || 0) +
      (Number(r.new_baptisms) || 0);
    const prev = histMap.get(qe);
    if (prev && prev.q >= quality) continue;
    histMap.set(qe, {
      quarter_end: qe,
      dbs: r.dbs != null ? Number(r.dbs) : null,
      total_church: r.total_church != null ? Number(r.total_church) : null,
      new_disciples: r.new_disciples != null ? Number(r.new_disciples) : null,
      new_baptisms: r.new_baptisms != null ? Number(r.new_baptisms) : null,
      gen: r.gen != null ? Number(r.gen) : null,
      leaders_in_training: r.leaders_in_training != null ? Number(r.leaders_in_training) : null,
      active_trainers: r.active_trainers != null ? Number(r.active_trainers) : null,
      q: quality,
    });
  }
  const history = Array.from(histMap.values())
    .sort((a, b) => a.quarter_end.localeCompare(b.quarter_end))
    .map(({ q: _q, ...rest }) => rest);

  let geo: {
    latitude: number;
    longitude: number;
    locality: string | null;
    pop_density_per_km2: number | null;
  } | null = null;
  if (engagementId != null) {
    const g = await query<Record<string, unknown>>(
      `
      SELECT latitude, longitude, locality, pop_density_per_km2
      FROM Dash_EngagementGeo WHERE engagement_id = ? LIMIT 1
      `,
      [engagementId]
    );
    if (g[0]) {
      geo = {
        latitude: Number(g[0].latitude),
        longitude: Number(g[0].longitude),
        locality: g[0].locality != null ? String(g[0].locality) : null,
        pop_density_per_km2:
          g[0].pop_density_per_km2 != null ? Number(g[0].pop_density_per_km2) : null,
      };
    }
  }

  const narrative = matchNarrative({
    engagement_id: engagementId,
    engagement_name: engName,
    region: assessment?.region,
    country: assessment?.country,
  });

  const path_to_next = assessment
    ? {
        current: assessment.classification,
        next: NEXT_LEVEL[assessment.classification],
        blockers: [
          ...assessment.warnings.slice(0, 4),
          ...Object.entries(assessment.metrics)
            .filter(([, m]) => m.status === "red")
            .map(([k]) => `Red indicator: ${k.replace(/_/g, " ")}`)
            .slice(0, 3),
        ],
        actions: assessment.recommended_actions.slice(0, 5),
      }
    : null;

  return {
    quarter_end: qEnd,
    assessment: assessment ?? null,
    history,
    geo,
    narrative,
    path_to_next,
    demo_lineage: {
      enabled: Boolean(narrative?.demo_lineage && narrative.generation_tree),
      tree: narrative?.generation_tree ?? null,
      note: narrative?.demo_lineage
        ? "Demo lineage for client walkthroughs — not multi-stream field verification."
        : "Multi-stream movement verification requires parent/stream lineage fields not yet in Dash_all_data.",
    },
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Coverage / opportunity markers with planting-priority ranking. */
export type CoverageOpportunity = {
  kind: "weak_dense" | "uncovered_district";
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  health_score?: number;
  pop_density_per_km2?: number;
  nearest_engagement_km?: number;
  engagement_id?: number;
  note: string;
  /** Higher = stronger demo “go plant / coach here” signal. */
  planting_priority: number;
};

export async function getCoverageGaps(quarterEnd: string, limit = 40) {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return { quarter_end: quarterEnd, opportunities: [] as CoverageOpportunity[], meta: { note: "" } };
  }

  const [map, adm2] = await Promise.all([
    getHealthMap(qEnd),
    getAdminBoundaries({ level: 2 }),
  ]);

  const opportunities: CoverageOpportunity[] = [];

  // Dense population + weak health at engagement points
  for (const p of map.points) {
    if (p.pop_density_per_km2 >= 120 && p.health_score < 48) {
      const planting_priority = Math.round(
        (48 - p.health_score) * 2 + Math.min(p.pop_density_per_km2, 800) / 20
      );
      opportunities.push({
        kind: "weak_dense",
        id: `weak-${p.engagement_id}`,
        label: p.engagement_name,
        latitude: p.latitude,
        longitude: p.longitude,
        country: p.country,
        region: p.region,
        health_score: p.health_score,
        pop_density_per_km2: p.pop_density_per_km2,
        engagement_id: p.engagement_id,
        planting_priority,
        note: `High density (${Math.round(p.pop_density_per_km2)}/km²) with health ${p.health_score} · priority ${planting_priority}`,
      });
    }
  }

  // Districts whose centroid is far from any engagement
  const pts = map.points.filter((p) => !p.is_demo || p.region === "The Moon");
  for (const f of adm2.features) {
    const lat = f.properties.centroid_lat;
    const lon = f.properties.centroid_lon;
    if (lat == null || lon == null) continue;
    // Skip moon-ish ocean coords for district coverage (EA/SA land focus)
    if (lat < -35 || lat > 25 || lon < 10 || lon > 52) continue;

    let nearest = Infinity;
    for (const p of pts) {
      if (p.is_demo) continue;
      const d = haversineKm(lat, lon, p.latitude, p.longitude);
      if (d < nearest) nearest = d;
    }
    if (nearest > 90 && nearest < 5000) {
      const planting_priority = Math.round(Math.min(nearest, 400) / 4);
      opportunities.push({
        kind: "uncovered_district",
        id: `dist-${f.properties.id}`,
        label: f.properties.shape_name,
        latitude: lat,
        longitude: lon,
        country: f.properties.country_name,
        nearest_engagement_km: Math.round(nearest),
        planting_priority,
        note: `No engagement within ~${Math.round(nearest)} km · plant priority ${planting_priority}`,
      });
    }
  }

  // Higher planting priority first
  opportunities.sort((a, b) => b.planting_priority - a.planting_priority);

  return {
    quarter_end: qEnd,
    opportunities: opportunities.slice(0, limit),
    meta: {
      note: "Model opportunities from density + DMM score and ADM2 distance — directional only for demos.",
      weak_dense: opportunities.filter((o) => o.kind === "weak_dense").length,
      uncovered: opportunities.filter((o) => o.kind === "uncovered_district").length,
    },
  };
}

export async function getStories() {
  return {
    stories: DEMO_NARRATIVES,
    meta: {
      source: "In-app demo narratives (not production field reports)",
      count: DEMO_NARRATIVES.length,
    },
  };
}

export async function getShareBundle(quarterEnd: string, region?: string) {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return { quarter_end: quarterEnd, generated_at: new Date().toISOString(), portfolio: null, text: "" };
  }
  const portfolio = await getPortfolio(qEnd);
  const regions = region
    ? portfolio.regions.filter((r) => r.region.toLowerCase() === region.toLowerCase())
    : portfolio.regions;

  const lines = [
    `EA-SA Dash — Executive brief`,
    `Quarter ending ${qEnd}`,
    ``,
    `Engagements assessed: ${portfolio.headline.engagements}`,
    `Average health score: ${portfolio.headline.avg_health_score}`,
    `Baptism needs attention: ${portfolio.headline.baptism_needs_attention}`,
    `Leadership needs attention: ${portfolio.headline.leadership_needs_attention}`,
    ``,
    `Classification funnel:`,
    ...portfolio.funnel.map((f) => `  ${f.classification}: ${f.count}`),
    ``,
    `Regions:`,
    ...regions.map(
      (r) =>
        `  ${r.region}: n=${r.engagements}, avg=${r.avg_health_score}, unhealthy=${r.unhealthy}, fruitful+=${r.fruitful_plus}`
    ),
    ``,
    `Top gains:`,
    ...portfolio.top_gains.slice(0, 5).map(
      (m) => `  ${m.engagement_name} (${m.delta_score! > 0 ? "+" : ""}${m.delta_score}) → ${m.health_score}`
    ),
    ``,
    `Top risks:`,
    ...portfolio.top_risks.slice(0, 5).map(
      (m) => `  ${m.engagement_name} (${m.delta_score}) → ${m.health_score}`
    ),
    ``,
    `Reporting: ${portfolio.freshness.reporting}/${portfolio.freshness.expected || "?"} sites`,
    ``,
    `— Generated from Dash_* data only. Moon + stories are demo overlays where labeled.`,
  ];

  return {
    quarter_end: qEnd,
    region: region ?? null,
    generated_at: new Date().toISOString(),
    portfolio: { ...portfolio, regions },
    text: lines.join("\n"),
    share_path: `/share?date=${qEnd}${region ? `&region=${encodeURIComponent(region)}` : ""}`,
  };
}

/** Lightweight engagement list for Profiles page. */
export async function listEngagementProfiles(quarterEnd: string, search?: string) {
  const dmm = await getDmmHealthAssessments(quarterEnd, { search });
  return {
    quarter_end: dmm.quarter_end,
    rows: dmm.rows.map((r) => ({
      engagement_id: r.engagement_id,
      engagement_name: r.engagement_name,
      region: r.region,
      country: r.country,
      classification: r.classification,
      health_score: r.health_score,
      summary: r.summary,
    })),
    total: dmm.rows.length,
  };
}

export type RiskRadarRow = {
  engagement_id: number | null;
  engagement_name: string;
  region: string;
  country: string;
  health_score: number;
  urgency: number;
  flags: string[];
  delta_score: number | null;
  classification: string;
  baptism_band: string;
  summary: string;
};

/** Composite urgency for regional directors (demo ops radar). */
export async function getRiskRadar(quarterEnd: string, limit = 25) {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return { quarter_end: quarterEnd, prior_quarter: null, rows: [] as RiskRadarRow[] };
  }
  const priorQ = priorQuarterEnd(qEnd);
  const [curr, prev, reporting] = await Promise.all([
    getDmmHealthAssessments(qEnd, {}),
    getDmmHealthAssessments(priorQ, {}),
    getNotReportingEngagements(qEnd).catch(() => ({ rows: [] as { engagement_id: number; engagement_name: string }[] })),
  ]);
  const priorBy = new Map(prev.rows.map((p) => [engKey(p), p]));
  const lateIds = new Set(
    (reporting.rows ?? []).map((r) => r.engagement_id).filter((id): id is number => id != null)
  );
  const lateNames = new Set(
    (reporting.rows ?? []).map((r) => (r.engagement_name || "").toLowerCase())
  );

  const rows: RiskRadarRow[] = [];
  for (const c of curr.rows) {
    const p = priorBy.get(engKey(c));
    const flags: string[] = [];
    let urgency = 0;
    const delta = p ? Math.round((c.health_score - p.health_score) * 10) / 10 : null;

    if (delta != null && delta <= -5) {
      urgency += Math.min(40, Math.abs(delta) * 2.5);
      flags.push(`Score ${delta}`);
    }
    if (c.baptism_simple_band === "needs_attention") {
      urgency += 18;
      flags.push("Baptism watch");
    }
    if (c.leadership_simple_band === "needs_attention") {
      urgency += 12;
      flags.push("Leadership watch");
    }
    if (c.classification === "Unhealthy" || c.classification === "Insufficient Data") {
      urgency += 14;
      flags.push(c.classification);
    }
    if (p && p.classification !== c.classification) {
      const worse =
        CLASS_ORDER.indexOf(c.classification) > CLASS_ORDER.indexOf(p.classification);
      if (worse) {
        urgency += 16;
        flags.push(`Class ↓ from ${p.classification}`);
      }
    }
    if (c.health_score < 40) {
      urgency += 10;
      flags.push("Low score");
    }
    const late =
      (c.engagement_id != null && lateIds.has(c.engagement_id)) ||
      lateNames.has(c.engagement_name.toLowerCase());
    if (late) {
      urgency += 22;
      flags.push("Late report");
    }

    if (urgency < 12 || flags.length === 0) continue;

    rows.push({
      engagement_id: c.engagement_id,
      engagement_name: c.engagement_name,
      region: c.region ?? "",
      country: c.country ?? "",
      health_score: c.health_score,
      urgency: Math.round(urgency),
      flags,
      delta_score: delta,
      classification: c.classification,
      baptism_band: c.baptism_simple_band,
      summary: c.summary,
    });
  }

  rows.sort((a, b) => b.urgency - a.urgency);
  return {
    quarter_end: qEnd,
    prior_quarter: priorQ,
    rows: rows.slice(0, limit),
    meta: {
      note: "Urgency combines score drops, baptism/leadership watch, class decline, and late reporting.",
      total_flagged: rows.length,
    },
  };
}

export type WinWallRow = {
  engagement_id: number | null;
  engagement_name: string;
  region: string;
  country: string;
  health_score: number;
  prior_score: number | null;
  delta_score: number;
  classification: string;
  prior_classification: string | null;
  headline: string;
  story_snippet: string | null;
};

/** Biggest positive movers as celebratory cards. */
export async function getWinWall(quarterEnd: string, limit = 8) {
  const movers = await getMovers(quarterEnd, limit + 5);
  const wins = movers.gains
    .filter((g) => (g.delta_score ?? 0) > 0)
    .slice(0, limit)
    .map((g): WinWallRow => {
      const narrative = matchNarrative({
        engagement_id: g.engagement_id,
        engagement_name: g.engagement_name,
        region: g.region,
        country: g.country,
      });
      return {
        engagement_id: g.engagement_id,
        engagement_name: g.engagement_name,
        region: g.region,
        country: g.country,
        health_score: g.health_score,
        prior_score: g.prior_score,
        delta_score: g.delta_score ?? 0,
        classification: g.classification,
        prior_classification: g.prior_classification,
        headline:
          g.classification_changed && g.prior_classification
            ? `Climbed from ${g.prior_classification} to ${g.classification}`
            : `Health +${g.delta_score} this quarter`,
        story_snippet: narrative ? narrative.highlight.slice(0, 160) : null,
      };
    });

  return {
    quarter_end: movers.quarter_end,
    prior_quarter: movers.prior_quarter,
    wins,
    meta: { count: wins.length },
  };
}

/** Short spoken brief lines for Share page (browser TTS). */
export async function getSpokenBrief(quarterEnd: string) {
  const portfolio = await getPortfolio(quarterEnd);
  const q = portfolio.quarter_end;
  const topGain = portfolio.top_gains[0];
  const topRisk = portfolio.top_risks[0];
  const lines = [
    `EA S A Dash executive brief for quarter ending ${q}.`,
    `${portfolio.headline.engagements} engagements assessed. Average health score ${portfolio.headline.avg_health_score}.`,
    `${portfolio.headline.baptism_needs_attention} on baptism watch. ${portfolio.headline.leadership_needs_attention} on leadership watch.`,
    portfolio.freshness.not_reporting
      ? `${portfolio.freshness.not_reporting} sites late or not reporting.`
      : `Reporting looks complete for this quarter.`,
  ];
  if (topGain) {
    lines.push(
      `Biggest gain: ${topGain.engagement_name}, up ${topGain.delta_score} points to ${topGain.health_score}.`
    );
  }
  if (topRisk && (topRisk.delta_score ?? 0) < 0) {
    lines.push(
      `Biggest risk: ${topRisk.engagement_name}, down ${Math.abs(topRisk.delta_score ?? 0)} to ${topRisk.health_score}.`
    );
  }
  lines.push(`Open the Share page for the full brief.`);
  return {
    quarter_end: q,
    script: lines.join(" "),
    lines,
  };
}
