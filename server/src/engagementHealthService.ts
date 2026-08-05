import { query, num } from "./db.js";
import { formatPlaceName } from "./formatPlaceName.js";
import {
  ATTRITION_RATE_BANDS,
  DBS_CHURCH_RATIO_IDEAL,
  DBS_CHURCH_RATIO_PENALTY,
  DISCIPLE_ACTIVITY_BONUS_POINTS,
  DISCIPLE_ACTIVITY_BONUS_THRESHOLD,
  ENGAGEMENT_ACTIVITY_POINTS,
  GENERATION_SCORE_MAP,
  GROWTH_RATE_BANDS,
  HEALTH_BANDS,
  HEALTH_WEIGHTS,
  INACTIVE_SUSTAINABILITY_PENALTY,
  LEADERS_PER_CHURCH_BANDS,
  TRAINERS_PER_CHURCH_BANDS,
  TRAININGS_HELD_BANDS,
} from "./engagementHealthConfig.js";
import { normalizeQuarterEnd, priorQuarterEnd } from "./quarterDates.js";

export type HealthBandLabel =
  | "Movement Multiplying"
  | "Healthy Movement"
  | "Stable but Needs Attention"
  | "At Risk"
  | "Critical";

export type EngagementHealthRow = {
  ng_key: number;
  engagement_id: number | null;
  engagement_name: string;
  people_group: string;
  country: string;
  region: string;
  date: string;
  priority: string | null;
  stage_tag: string | null;
  level_tag: string | null;
  health_score: number;
  health_band: HealthBandLabel;
  growth_momentum_score: number;
  multiplication_health_score: number;
  leadership_development_score: number;
  sustainability_score: number;
  engagement_activity_score: number;
  growth_rate: number | null;
  disciple_activity_rate: number | null;
  effective_generation: number | null;
  dbs_to_church_ratio: number | null;
  leaders_per_church: number | null;
  trainers_per_church: number | null;
  trainings_held: number;
  attrition_rate: number | null;
  multiplication_velocity: number | null;
  generation_velocity: number | null;
  leader_pipeline: number | null;
  baptism_effectiveness: number | null;
  church_reproduction_rate: number | null;
};

export type EngagementHealthSummary = {
  total_scored: number;
  avg_health_score: number;
  by_band: Record<HealthBandLabel, number>;
};

type RawRow = {
  ng_key: number;
  engagement_id: number | null;
  engagement_name: string;
  people_group: string;
  country: string;
  region: string;
  date: string;
  priority: string | null;
  stage_tag: string | null;
  level_tag: string | null;
  dbs: number;
  com_church: number;
  cat_church: number;
  total_church: number;
  gen: number;
  gen_to_date: number;
  churches_to_date: number;
  new_disciples: number;
  new_baptisms: number;
  lost_churches: number;
  merged_churches: number;
  mb_churches: number;
  leaders_in_training: number;
  active_trainers: number;
  trainings_held: number;
  notes: string | null;
  active: number | null;
};

function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "nan") return 0;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function safeDiv(a: number, b: number): number | null {
  if (!b || b === 0) return null;
  return a / b;
}

function bandScore<T extends { min?: number; max?: number; score: number }>(
  value: number,
  bands: readonly T[],
  mode: "min" | "max"
): number {
  for (const b of bands) {
    if (mode === "min" && b.min != null && value >= b.min) return b.score;
    if (mode === "max" && b.max != null && value <= b.max) return b.score;
  }
  return bands[bands.length - 1]?.score ?? 0;
}

function quarterBack(quarterEnd: string, steps: number): string {
  let q = normalizeQuarterEnd(quarterEnd) ?? quarterEnd;
  for (let i = 0; i < steps; i++) q = priorQuarterEnd(q);
  return q;
}

/** Active flag: explicit 1 = yes; 0 = no; null/empty = infer from reported activity. */
function isEngagementActive(row: RawRow): boolean {
  if (row.active === 1) return true;
  if (row.active === 0) return false;
  return (
    row.new_disciples > 0 ||
    row.new_baptisms > 0 ||
    row.total_church > 0 ||
    row.dbs > 0
  );
}

/** Cumulative church count for growth/trend (falls back to quarterly total_church). */
function churchesForGrowth(row: RawRow): number {
  return row.churches_to_date > 0 ? row.churches_to_date : row.total_church;
}

function rowQualityScore(row: RawRow): number {
  return (
    row.churches_to_date * 1000 +
    row.total_church * 100 +
    row.new_disciples +
    row.new_baptisms
  );
}

function hasText(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== "";
}

/** Prefer gen_to_date when set; otherwise use point-in-time gen. */
export function resolveGeneration(gen: number, genToDate: number): number {
  return genToDate > 0 ? genToDate : gen;
}

export function scoreGrowthMomentum(
  current: RawRow,
  prior: RawRow | null
): { score: number; growth_rate: number | null; disciple_activity_rate: number | null } {
  const priorChurches = prior ? churchesForGrowth(prior) : 0;
  const curChurches = churchesForGrowth(current);
  let growth_rate: number | null = null;
  if (prior) {
    if (priorChurches > 0) {
      growth_rate = (curChurches - priorChurches) / priorChurches;
    } else if (curChurches > 0) {
      growth_rate = 0;
    } else {
      growth_rate = 0;
    }
  }

  let score = prior ? bandScore(growth_rate ?? 0, GROWTH_RATE_BANDS, "min") : 10;
  if (prior && priorChurches === 0 && curChurches > 0) {
    score = Math.min(score, 15);
  }

  const churchesBase = Math.max(current.churches_to_date, 1);
  const disciple_activity_rate =
    (current.new_disciples + current.new_baptisms) / churchesBase;
  if (disciple_activity_rate > DISCIPLE_ACTIVITY_BONUS_THRESHOLD) {
    score = Math.min(HEALTH_WEIGHTS.growthMomentum, score + DISCIPLE_ACTIVITY_BONUS_POINTS);
  }

  return {
    score: Math.min(HEALTH_WEIGHTS.growthMomentum, Math.max(0, score)),
    growth_rate,
    disciple_activity_rate,
  };
}

export function scoreMultiplicationHealth(current: RawRow): {
  score: number;
  effective_generation: number;
  dbs_to_church_ratio: number | null;
} {
  const gen = resolveGeneration(current.gen, current.gen_to_date);
  let score = 0;
  for (const band of GENERATION_SCORE_MAP) {
    if (gen >= band.minGen) {
      score = band.score;
      break;
    }
  }

  const dbs_to_church_ratio = safeDiv(current.dbs, Math.max(current.total_church, 1));
  if (
    dbs_to_church_ratio != null &&
    (dbs_to_church_ratio < DBS_CHURCH_RATIO_IDEAL.min ||
      dbs_to_church_ratio > DBS_CHURCH_RATIO_IDEAL.max)
  ) {
    score = Math.max(0, score - DBS_CHURCH_RATIO_PENALTY);
  }

  return {
    score: Math.min(HEALTH_WEIGHTS.multiplicationHealth, score),
    effective_generation: gen,
    dbs_to_church_ratio,
  };
}

export function scoreLeadershipDevelopment(current: RawRow): {
  score: number;
  leaders_per_church: number | null;
  trainers_per_church: number | null;
  trainings_held: number;
} {
  const churches = Math.max(current.total_church, 1);
  const leaders_per_church = current.leaders_in_training / churches;
  const trainers_per_church = current.active_trainers / churches;
  const trainings_held = current.trainings_held;

  const leaderPts = bandScore(leaders_per_church, LEADERS_PER_CHURCH_BANDS, "min");
  const trainerPts = bandScore(trainers_per_church, TRAINERS_PER_CHURCH_BANDS, "min");
  const trainingPts = bandScore(trainings_held, TRAININGS_HELD_BANDS, "min");

  const score = Math.min(
    HEALTH_WEIGHTS.leadershipDevelopment,
    leaderPts + trainerPts + trainingPts
  );

  return { score, leaders_per_church, trainers_per_church, trainings_held };
}

export function scoreSustainability(current: RawRow): {
  score: number;
  attrition_rate: number | null;
} {
  const base = Math.max(current.churches_to_date, 1);
  const attrition_rate = (current.lost_churches + current.merged_churches) / base;
  let score = bandScore(attrition_rate, ATTRITION_RATE_BANDS, "max");
  if (!isEngagementActive(current)) {
    score = Math.max(0, score - INACTIVE_SUSTAINABILITY_PENALTY);
  }
  return {
    score: Math.min(HEALTH_WEIGHTS.sustainability, score),
    attrition_rate,
  };
}

export function scoreEngagementActivity(current: RawRow): number {
  let score = 0;
  if (isEngagementActive(current)) score += ENGAGEMENT_ACTIVITY_POINTS.active;
  if (current.trainings_held > 0) score += ENGAGEMENT_ACTIVITY_POINTS.trainingsHeld;
  if (hasText(current.notes)) score += ENGAGEMENT_ACTIVITY_POINTS.notes;
  if (hasText(current.stage_tag)) score += ENGAGEMENT_ACTIVITY_POINTS.stageTag;
  if (hasText(current.level_tag)) score += ENGAGEMENT_ACTIVITY_POINTS.levelTag;
  return Math.min(HEALTH_WEIGHTS.engagementActivity, score);
}

export function healthBandFromScore(score: number): HealthBandLabel {
  for (const b of HEALTH_BANDS) {
    if (score >= b.min) return b.label;
  }
  return "Critical";
}

export function computeTrendMetrics(
  current: RawRow,
  prior: RawRow | null,
  yearAgo: RawRow | null
): Pick<
  EngagementHealthRow,
  | "multiplication_velocity"
  | "generation_velocity"
  | "leader_pipeline"
  | "baptism_effectiveness"
  | "church_reproduction_rate"
> {
  const churches12 = yearAgo ? churchesForGrowth(yearAgo) : 0;
  const curChurches = churchesForGrowth(current);
  const multiplication_velocity =
    churches12 > 0 ? curChurches / churches12 : null;

  const curGen = resolveGeneration(current.gen, current.gen_to_date);
  const gen12 = yearAgo
    ? resolveGeneration(yearAgo.gen, yearAgo.gen_to_date)
    : null;
  const generation_velocity =
    gen12 != null ? curGen - gen12 : null;

  const leader_pipeline = safeDiv(
    current.leaders_in_training,
    Math.max(current.active_trainers, 1)
  );

  const baptism_effectiveness = safeDiv(
    current.new_baptisms,
    Math.max(current.new_disciples, 1)
  );

  const priorChurches = prior ? churchesForGrowth(prior) : 0;
  const netNewChurches = Math.max(0, curChurches - priorChurches);
  const church_reproduction_rate = safeDiv(netNewChurches, Math.max(priorChurches, 1));

  return {
    multiplication_velocity,
    generation_velocity,
    leader_pipeline,
    baptism_effectiveness,
    church_reproduction_rate,
  };
}

function rowKey(engagement_id: number | null, ng_key: number): string {
  return engagement_id != null ? `id:${engagement_id}` : `ng:${ng_key}`;
}

function mapRaw(r: Record<string, unknown>): RawRow {
  return {
    ng_key: num(r.ng_key),
    engagement_id: r.engagement_id != null ? num(r.engagement_id) : null,
    engagement_name: String(r.engagement_name ?? ""),
    people_group: String(r.people_group ?? ""),
    country: String(r.country ?? ""),
    region: String(r.region ?? ""),
    date: String(r.date ?? ""),
    priority: r.priority != null ? String(r.priority) : null,
    stage_tag: r.stage_tag != null ? String(r.stage_tag) : null,
    level_tag: r.level_tag != null ? String(r.level_tag) : null,
    dbs: num(r.dbs),
    com_church: num(r.com_church),
    cat_church: num(r.cat_church),
    total_church: num(r.total_church),
    gen: num(r.gen),
    gen_to_date: num(r.gen_to_date),
    churches_to_date: num(r.churches_to_date),
    new_disciples: num(r.new_disciples),
    new_baptisms: num(r.new_baptisms),
    lost_churches: num(r.lost_churches),
    merged_churches: num(r.merged_churches),
    mb_churches: num(r.mb_churches),
    leaders_in_training: parseNum(r.leaders_in_training),
    active_trainers: parseNum(r.active_trainers),
    trainings_held: parseNum(r.trainings_held),
    notes: r.notes != null ? String(r.notes) : null,
    active: r.active == null ? null : num(r.active),
  };
}

export function scoreEngagementRow(
  current: RawRow,
  prior: RawRow | null,
  yearAgo: RawRow | null
): EngagementHealthRow {
  const growth = scoreGrowthMomentum(current, prior);
  const mult = scoreMultiplicationHealth(current);
  const leadership = scoreLeadershipDevelopment(current);
  const sustain = scoreSustainability(current);
  const activity = scoreEngagementActivity(current);
  const trends = computeTrendMetrics(current, prior, yearAgo);

  const health_score = Math.round(
    growth.score +
      mult.score +
      leadership.score +
      sustain.score +
      activity
  );

  return {
    ng_key: current.ng_key,
    engagement_id: current.engagement_id,
    engagement_name: current.engagement_name || current.people_group,
    people_group: current.people_group,
    country: current.country,
    region: current.region,
    date: current.date,
    priority: current.priority,
    stage_tag: current.stage_tag,
    level_tag: current.level_tag,
    health_score,
    health_band: healthBandFromScore(health_score),
    growth_momentum_score: growth.score,
    multiplication_health_score: mult.score,
    leadership_development_score: leadership.score,
    sustainability_score: sustain.score,
    engagement_activity_score: activity,
    growth_rate: growth.growth_rate,
    disciple_activity_rate: growth.disciple_activity_rate,
    effective_generation: mult.effective_generation,
    dbs_to_church_ratio: mult.dbs_to_church_ratio,
    leaders_per_church: leadership.leaders_per_church,
    trainers_per_church: leadership.trainers_per_church,
    trainings_held: leadership.trainings_held,
    attrition_rate: sustain.attrition_rate,
    ...trends,
  };
}

export type EngagementHealthFilters = {
  region?: string;
  country?: string;
  people_group?: string;
  priority?: string;
  stage_tag?: string;
  level_tag?: string;
};

export async function getEngagementHealthScoreboard(
  quarterEnd: string,
  filters: EngagementHealthFilters = {}
): Promise<{ quarter_end: string; rows: EngagementHealthRow[]; summary: EngagementHealthSummary }> {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return {
      quarter_end: quarterEnd,
      rows: [],
      summary: { total_scored: 0, avg_health_score: 0, by_band: emptyBandCounts() },
    };
  }

  const priorQ = priorQuarterEnd(qEnd);
  const quarters12AgoQ = quarterBack(qEnd, 12);

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
      priority,
      stage_tag,
      level_tag,
      COALESCE(dbs, 0) AS dbs,
      COALESCE(com_church, 0) AS com_church,
      COALESCE(cat_church, 0) AS cat_church,
      COALESCE(total_church, 0) AS total_church,
      COALESCE(gen, 0) AS gen,
      COALESCE(gen_to_date, 0) AS gen_to_date,
      COALESCE(churches_to_date, 0) AS churches_to_date,
      COALESCE(new_disciples, 0) AS new_disciples,
      COALESCE(new_baptisms, 0) AS new_baptisms,
      COALESCE(lost_churches, 0) AS lost_churches,
      COALESCE(merged_churches, 0) AS merged_churches,
      COALESCE(mb_churches, 0) AS mb_churches,
      leaders_in_training,
      active_trainers_choaches AS active_trainers,
      number_of_trainings_held_qtr,
      notes,
      active
    FROM Dash_all_data
    WHERE \`date\` IN (?, ?, ?)
    `,
    [qEnd, priorQ, quarters12AgoQ]
  );

  const byKeyDate = new Map<string, Map<string, RawRow>>();
  for (const r of rawRows) {
    const row = mapRaw(r);
    const key = rowKey(row.engagement_id, row.ng_key);
    if (!byKeyDate.has(key)) byKeyDate.set(key, new Map());
    const dateMap = byKeyDate.get(key)!;
    const existing = dateMap.get(row.date);
    if (!existing || rowQualityScore(row) > rowQualityScore(existing)) {
      dateMap.set(row.date, row);
    }
  }

  const rows: EngagementHealthRow[] = [];
  for (const [, dates] of byKeyDate) {
    const current = dates.get(qEnd);
    if (!current) continue;

    const scored = scoreEngagementRow(
      current,
      dates.get(priorQ) ?? null,
      dates.get(quarters12AgoQ) ?? null
    );

    if (filters.region && scored.region !== filters.region) continue;
    if (filters.country && scored.country !== filters.country) continue;
    if (filters.people_group && scored.people_group !== filters.people_group) continue;
    if (filters.priority && scored.priority !== filters.priority) continue;
    if (filters.stage_tag && scored.stage_tag !== filters.stage_tag) continue;
    if (filters.level_tag && scored.level_tag !== filters.level_tag) continue;

    rows.push({
      ...scored,
      engagement_name: formatPlaceName(scored.engagement_name),
      people_group: formatPlaceName(scored.people_group),
      country: formatPlaceName(scored.country),
      region: formatPlaceName(scored.region),
    });
  }

  rows.sort((a, b) => b.health_score - a.health_score);

  const by_band = emptyBandCounts();
  let sum = 0;
  for (const r of rows) {
    sum += r.health_score;
    by_band[r.health_band]++;
  }

  return {
    quarter_end: qEnd,
    rows,
    summary: {
      total_scored: rows.length,
      avg_health_score: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
      by_band,
    },
  };
}

function emptyBandCounts(): Record<HealthBandLabel, number> {
  return {
    "Movement Multiplying": 0,
    "Healthy Movement": 0,
    "Stable but Needs Attention": 0,
    "At Risk": 0,
    Critical: 0,
  };
}

export async function getEngagementHealthFilterOptions(quarterEnd: string) {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) {
    return { regions: [], countries: [], people_groups: [], priorities: [], stage_tags: [], level_tags: [] };
  }
  const [regions, countries, people_groups, priorities, stage_tags, level_tags] = await Promise.all([
    query<{ v: string }>(
      `SELECT DISTINCT region AS v FROM Dash_all_data WHERE \`date\` = ? AND region IS NOT NULL ORDER BY region`,
      [qEnd]
    ),
    query<{ v: string }>(
      `SELECT DISTINCT country AS v FROM Dash_all_data WHERE \`date\` = ? AND country IS NOT NULL ORDER BY country`,
      [qEnd]
    ),
    query<{ v: string }>(
      `SELECT DISTINCT people_group AS v FROM Dash_all_data WHERE \`date\` = ? AND people_group IS NOT NULL ORDER BY people_group`,
      [qEnd]
    ),
    query<{ v: string }>(
      `SELECT DISTINCT priority AS v FROM Dash_all_data WHERE \`date\` = ? AND priority IS NOT NULL AND TRIM(priority) <> '' ORDER BY priority`,
      [qEnd]
    ),
    query<{ v: string }>(
      `SELECT DISTINCT stage_tag AS v FROM Dash_all_data WHERE \`date\` = ? AND stage_tag IS NOT NULL AND TRIM(stage_tag) <> '' ORDER BY stage_tag`,
      [qEnd]
    ),
    query<{ v: string }>(
      `SELECT DISTINCT level_tag AS v FROM Dash_all_data WHERE \`date\` = ? AND level_tag IS NOT NULL AND TRIM(level_tag) <> '' ORDER BY level_tag`,
      [qEnd]
    ),
  ]);
  const pick = (rows: { v: string }[]) => rows.map((r) => r.v);
  return {
    regions: pick(regions),
    countries: pick(countries),
    people_groups: pick(people_groups),
    priorities: pick(priorities),
    stage_tags: pick(stage_tags),
    level_tags: pick(level_tags),
  };
}
