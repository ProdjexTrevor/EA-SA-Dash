import { query, num } from "./db.js";
import { formatPlaceName } from "./formatPlaceName.js";
import {
  assessEngagement,
  type AssessmentResult,
  type DmmClassification,
} from "./dmmHealthAssessment.js";
import { normalizeQuarterEnd, priorQuarterEnd } from "./quarterDates.js";

type Raw = {
  ng_key: number;
  engagement_id: number | null;
  engagement_name: string;
  people_group: string;
  country: string;
  region: string;
  date: string;
  dbs: number | null;
  total_church: number | null;
  new_disciples: number | null;
  new_baptisms: number | null;
  leaders_in_training: number | null;
  active_trainers_choaches: number | null;
  lost_churches: number | null;
  merged_churches: number | null;
  gen: number | null;
  gen_to_date: number | null;
  mbb_disciples_calc: number | null;
  mbb_churches_calc: number | null;
  active: number | null;
  quality: number;
};

function optionalNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowKey(engagement_id: number | null, ng_key: number): string {
  return engagement_id != null ? `id:${engagement_id}` : `ng:${ng_key}`;
}

function mapRaw(r: Record<string, unknown>): Raw {
  const dbs = optionalNum(r.dbs);
  const total_church = optionalNum(r.total_church);
  const new_disciples = optionalNum(r.new_disciples);
  const new_baptisms = optionalNum(r.new_baptisms);
  return {
    ng_key: num(r.ng_key),
    engagement_id: r.engagement_id != null ? num(r.engagement_id) : null,
    engagement_name: String(r.engagement_name ?? ""),
    people_group: String(r.people_group ?? ""),
    country: String(r.country ?? ""),
    region: String(r.region ?? ""),
    date: String(r.date ?? ""),
    dbs,
    total_church,
    new_disciples,
    new_baptisms,
    leaders_in_training: optionalNum(r.leaders_in_training),
    active_trainers_choaches: optionalNum(r.active_trainers),
    lost_churches: optionalNum(r.lost_churches),
    merged_churches: optionalNum(r.merged_churches),
    gen: optionalNum(r.gen),
    gen_to_date: optionalNum(r.gen_to_date),
    mbb_disciples_calc: optionalNum(r.mbb_disciples_calc),
    mbb_churches_calc: optionalNum(r.mbb_churches_calc),
    active: r.active == null || r.active === "" ? null : num(r.active),
    quality:
      (total_church ?? 0) * 100 +
      (new_disciples ?? 0) +
      (new_baptisms ?? 0) +
      (dbs ?? 0),
  };
}

export type DmmHealthFilters = {
  region?: string;
  country?: string;
  classification?: DmmClassification;
  search?: string;
};

export type DmmHealthSummary = {
  total: number;
  avg_health_score: number;
  by_classification: Record<string, number>;
  baptism_needs_attention: number;
  leadership_needs_attention: number;
  movement_verified_count: number;
};

export async function getDmmHealthAssessments(
  quarterEnd: string,
  filters: DmmHealthFilters = {}
): Promise<{
  quarter_end: string;
  prior_quarter: string | null;
  rows: AssessmentResult[];
  summary: DmmHealthSummary;
  data_limitations: string[];
}> {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return {
      quarter_end: quarterEnd,
      prior_quarter: null,
      rows: [],
      summary: emptySummary(),
      data_limitations: [],
    };
  }

  const priorQ = priorQuarterEnd(qEnd);

  const rawRows = await query<Record<string, unknown>>(
    `
    SELECT
      ng_key,
      engagement_id,
      engagment_name AS engagement_name,
      people_group,
      country,
      region,
      DATE_FORMAT(\`date\`, '%Y-%m-%d') AS date,
      dbs,
      total_church,
      new_disciples,
      new_baptisms,
      leaders_in_training,
      active_trainers_choaches AS active_trainers,
      lost_churches,
      merged_churches,
      gen,
      gen_to_date,
      mbb_disciples_calc,
      mbb_churches_calc,
      active
    FROM Dash_all_data
    WHERE \`date\` IN (?, ?)
    `,
    [qEnd, priorQ]
  );

  const byKeyDate = new Map<string, Map<string, Raw>>();
  for (const r of rawRows) {
    const row = mapRaw(r);
    const key = rowKey(row.engagement_id, row.ng_key);
    if (!byKeyDate.has(key)) byKeyDate.set(key, new Map());
    const dates = byKeyDate.get(key)!;
    const existing = dates.get(row.date);
    if (!existing || row.quality > existing.quality) {
      dates.set(row.date, row);
    }
  }

  const rows: AssessmentResult[] = [];
  for (const [, dates] of byKeyDate) {
    const current = dates.get(qEnd);
    if (!current) continue;
    const previous = dates.get(priorQ) ?? null;

    const assessed = assessEngagement({
      engagement_id: current.engagement_id,
      engagement_name: formatPlaceName(current.engagement_name || current.people_group),
      reporting_period: qEnd,
      region: formatPlaceName(current.region),
      country: formatPlaceName(current.country),
      people_group: formatPlaceName(current.people_group),
      active: current.active,
      dbs: current.dbs,
      total_church: current.total_church,
      new_disciples: current.new_disciples,
      new_baptisms: current.new_baptisms,
      leaders_in_training: current.leaders_in_training,
      active_trainers_choaches: current.active_trainers_choaches,
      lost_churches: current.lost_churches,
      merged_churches: current.merged_churches,
      gen: current.gen,
      gen_to_date: current.gen_to_date,
      mbb_disciples_calc: current.mbb_disciples_calc,
      mbb_churches_calc: current.mbb_churches_calc,
      previous: previous
        ? {
            total_church: previous.total_church,
            new_disciples: previous.new_disciples,
            dbs: previous.dbs,
            gen: previous.gen,
            gen_to_date: previous.gen_to_date,
            mbb_disciples_calc: previous.mbb_disciples_calc,
            mbb_churches_calc: previous.mbb_churches_calc,
            new_baptisms: previous.new_baptisms,
            leaders_in_training: previous.leaders_in_training,
          }
        : null,
      history: previous
        ? [
            {
              total_church: previous.total_church,
              new_disciples: previous.new_disciples,
              gen: previous.gen,
              gen_to_date: previous.gen_to_date,
            },
          ]
        : [],
      streams_verifiable: false,
      multi_stream_g4: false,
    });

    if (filters.region && assessed.region !== filters.region) continue;
    if (filters.country && assessed.country !== filters.country) continue;
    if (filters.classification && assessed.classification !== filters.classification) continue;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${assessed.engagement_name} ${assessed.country} ${assessed.region} ${assessed.people_group}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    rows.push(assessed);
  }

  rows.sort((a, b) => b.health_score - a.health_score || a.engagement_name.localeCompare(b.engagement_name));

  const by_classification: Record<string, number> = {};
  let sum = 0;
  let baptism_needs_attention = 0;
  let leadership_needs_attention = 0;
  let movement_verified_count = 0;
  for (const r of rows) {
    sum += r.health_score;
    by_classification[r.classification] = (by_classification[r.classification] ?? 0) + 1;
    if (r.baptism_simple_band === "needs_attention") baptism_needs_attention++;
    if (r.leadership_simple_band === "needs_attention") leadership_needs_attention++;
    if (r.movement_verified) movement_verified_count++;
  }

  return {
    quarter_end: qEnd,
    prior_quarter: priorQ,
    rows,
    summary: {
      total: rows.length,
      avg_health_score: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
      by_classification,
      baptism_needs_attention,
      leadership_needs_attention,
      movement_verified_count,
    },
    data_limitations: [
      "Dash_all_data has no parent_group_id, parent_church_id, movement_stream_id, or leader lineage fields.",
      "Movement and Sustained Movement require verified multi-stream G4 reproduction — not computable from totals alone.",
      "field engagment_name and active_trainers_choaches use existing DB spellings.",
      "dbs is treated as active Discovery Bible Study / discipleship groups.",
      "merged_churches are not counted as lost churches.",
    ],
  };
}

function emptySummary(): DmmHealthSummary {
  return {
    total: 0,
    avg_health_score: 0,
    by_classification: {},
    baptism_needs_attention: 0,
    leadership_needs_attention: 0,
    movement_verified_count: 0,
  };
}
