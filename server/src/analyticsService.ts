import { query, num } from "./db.js";
import { formatPlaceName } from "./formatPlaceName.js";
import { normalizeQuarterEnd, priorQuarterEnd } from "./quarterDates.js";

export type RollupLevel = "global" | "region" | "country" | "engagement";

export type EngagementRow = {
  ng_key: number;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  engagement_id: number | null;
  com_churches: number;
  cat_churches: number;
  total_churches: number;
  dbs: number;
  avg_church_size: number | null;
  leaders_in_training: number;
  new_disciples: number;
  new_baptisms: number;
  population: number | null;
  mbb_pct: number | null;
  mbb_disciples: number;
  mbb_churches: number;
  mb_churches: number;
  gen: number;
  lost_churches: number;
  merged_churches: number;
  prior_new_disciples: number;
  prior_baptisms: number;
  prior_churches: number;
  prior_leaders: number;
  notes: string | null;
  crisis_flag: boolean;
  crisis_keywords: string;
  // derived
  disciples_per_church: number | null;
  disciples_per_baptism: number | null;
  baptisms_per_church: number | null;
  dbs_per_church: number | null;
  dbs_per_baptism: number | null;
  gen_per_quarter: number;
  mbb_vs_pop_pct: number | null;
  market_share_pct: number | null;
  r_number: number | null;
  pct_chg_disciples: number | null;
  pct_chg_baptisms: number | null;
  pct_chg_churches: number | null;
  pct_chg_leaders: number | null;
};

export type RollupRow = {
  level: RollupLevel;
  key: string;
  label: string;
  region?: string;
  country?: string;
  row_count: number;
  com_churches: number;
  cat_churches: number;
  total_churches: number;
  dbs: number;
  avg_church_size: number | null;
  leaders_in_training: number;
  new_disciples: number;
  new_baptisms: number;
  population: number | null;
  mbb_disciples: number;
  mbb_churches: number;
  mb_churches: number;
  max_gen: number;
  avg_gen: number;
  lost_churches: number;
  merged_churches: number;
  disciples_per_church: number | null;
  disciples_per_baptism: number | null;
  baptisms_per_church: number | null;
  dbs_per_church: number | null;
  mbb_vs_pop_pct: number | null;
  market_share_pct: number | null;
  r_number_avg: number | null;
  pct_chg_disciples: number | null;
  pct_chg_baptisms: number | null;
  pct_chg_churches: number | null;
  pct_chg_leaders: number | null;
  crisis_engagements: number;
  health_score: number;
};

function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "nan") return 0;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function parseLeaders(v: unknown): number {
  return parseNum(v);
}

function pctChange(cur: number, prior: number): number | null {
  if (prior === 0 && cur === 0) return 0;
  if (prior === 0) return null;
  return Math.round(((cur - prior) / prior) * 1000) / 10;
}

function safeDiv(a: number, b: number): number | null {
  if (!b) return null;
  return Math.round((a / b) * 1000) / 1000;
}

function crisisFromText(...parts: (string | null | undefined)[]): { flag: boolean; keywords: string } {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  const keys: string[] = [];
  for (const k of ["war", "famine", "conflict", "crisis", "violence", "displacement", "refugee"]) {
    if (text.includes(k)) keys.push(k);
  }
  return { flag: keys.length > 0, keywords: [...new Set(keys)].join(", ") };
}

async function loadEngagements(quarterEnd: string): Promise<EngagementRow[]> {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) throw new Error(`Invalid quarter date: ${quarterEnd}`);
  const prior = priorQuarterEnd(qEnd);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      a.ng_key,
      a.region,
      a.country,
      a.people_group,
      a.engagment_name AS engagement_name,
      a.engagement_id,
      COALESCE(a.com_church, 0) AS com_churches,
      COALESCE(a.cat_church, 0) AS cat_churches,
      COALESCE(a.total_church, 0) AS total_churches,
      COALESCE(a.dbs, 0) AS dbs,
      a.avg_church_size,
      a.leaders_in_training,
      a.active_trainers_choaches,
      COALESCE(a.new_disciples, 0) AS new_disciples,
      COALESCE(a.new_baptisms, 0) AS new_baptisms,
      COALESCE(a.mbb_disciples_calc, 0) AS mbb_disciples,
      COALESCE(CAST(NULLIF(TRIM(a.mbb_churches_calc), '') AS SIGNED), 0) AS mbb_churches,
      COALESCE(a.mb_churches, 0) AS mb_churches,
      COALESCE(a.gen, 0) AS gen,
      COALESCE(a.lost_churches, 0) AS lost_churches,
      COALESCE(a.merged_churches, 0) AS merged_churches,
      a.mbb_decimal,
      a.notes,
      p.population_size AS population,
      p.cultural_challenges,
      COALESCE(pr.new_disciples, 0) AS prior_new_disciples,
      COALESCE(pr.new_baptisms, 0) AS prior_baptisms,
      COALESCE(pr.total_church, 0) AS prior_churches,
      pr.leaders_in_training AS prior_leaders_raw
    FROM Dash_all_data a
    LEFT JOIN (
      SELECT engagement_id, new_disciples, new_baptisms, total_church, leaders_in_training
      FROM Dash_all_data WHERE \`date\` = ?
    ) pr ON pr.engagement_id = a.engagement_id
    LEFT JOIN Dash_PeopleGroups p ON p.engagement_id = a.engagement_id
    WHERE a.\`date\` = ?
    `,
    [prior, qEnd]
  );

  return rows.map((r) => {
    const nd = num(r.new_disciples);
    const nb = num(r.new_baptisms);
    const ch = num(r.total_churches);
    const dbs = num(r.dbs);
    const pop = r.population != null ? num(r.population) : null;
    const mbbPct =
      r.mbb_decimal != null
        ? num(r.mbb_decimal) > 1
          ? num(r.mbb_decimal) / 100
          : num(r.mbb_decimal)
        : null;
    const priorNd = num(r.prior_new_disciples);
    const priorBap = num(r.prior_baptisms);
    const priorCh = num(r.prior_churches);
    const priorLeaders = parseLeaders(r.prior_leaders_raw);
    const leaders = parseLeaders(r.leaders_in_training);
    const crisis = crisisFromText(
      r.notes as string,
      r.cultural_challenges as string
    );

    return {
      ng_key: num(r.ng_key),
      region: String(r.region ?? ""),
      country: String(r.country ?? ""),
      people_group: String(r.people_group ?? ""),
      engagement_name: String(r.engagement_name ?? ""),
      engagement_id: r.engagement_id != null ? num(r.engagement_id) : null,
      com_churches: num(r.com_churches),
      cat_churches: num(r.cat_churches),
      total_churches: ch,
      dbs,
      avg_church_size: r.avg_church_size != null ? num(r.avg_church_size) : null,
      leaders_in_training: leaders,
      new_disciples: nd,
      new_baptisms: nb,
      population: pop,
      mbb_pct: mbbPct,
      mbb_disciples: num(r.mbb_disciples),
      mbb_churches: num(r.mbb_churches),
      mb_churches: num(r.mb_churches),
      gen: num(r.gen),
      lost_churches: num(r.lost_churches),
      merged_churches: num(r.merged_churches),
      prior_new_disciples: priorNd,
      prior_baptisms: priorBap,
      prior_churches: priorCh,
      prior_leaders: priorLeaders,
      notes: r.notes != null ? String(r.notes) : null,
      crisis_flag: crisis.flag,
      crisis_keywords: crisis.keywords,
      disciples_per_church: safeDiv(nd, ch),
      disciples_per_baptism: safeDiv(nd, nb),
      baptisms_per_church: safeDiv(nb, ch),
      dbs_per_church: safeDiv(dbs, ch),
      dbs_per_baptism: safeDiv(dbs, nb),
      gen_per_quarter: num(r.gen),
      mbb_vs_pop_pct: pop && mbbPct != null ? Math.round((num(r.mbb_disciples) / pop) * 100000) / 1000 : null,
      market_share_pct: pop ? Math.round((nd / pop) * 100000) / 1000 : null,
      r_number: priorNd > 0 ? Math.round((nd / priorNd) * 100) / 100 : nd > 0 ? null : 0,
      pct_chg_disciples: pctChange(nd, priorNd),
      pct_chg_baptisms: pctChange(nb, priorBap),
      pct_chg_churches: pctChange(ch, priorCh),
      pct_chg_leaders: pctChange(leaders, priorLeaders),
    };
  });
}

function healthScoreForRows(rows: EngagementRow[]): number {
  if (!rows.length) return 100;
  let ok = 0;
  for (const r of rows) {
    const bad =
      !r.engagement_id ||
      (r.total_churches > 0 && r.gen === 0) ||
      ((r.new_disciples > 0 || r.total_churches > 0) && r.mbb_pct == null);
    if (!bad) ok++;
  }
  return Math.round((ok / rows.length) * 1000) / 10;
}

function aggregate(rows: EngagementRow[], level: RollupLevel, key: string, label: string): RollupRow {
  const sum = (f: (r: EngagementRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const nd = sum((r) => r.new_disciples);
  const nb = sum((r) => r.new_baptisms);
  const ch = sum((r) => r.total_churches);
  const dbs = sum((r) => r.dbs);
  const pop = rows.reduce((s, r) => s + (r.population ?? 0), 0) || null;
  const priorNd = sum((r) => r.prior_new_disciples);
  const priorBap = sum((r) => r.prior_baptisms);
  const priorCh = sum((r) => r.prior_churches);
  const priorLeaders = sum((r) => r.prior_leaders);
  const leaders = sum((r) => r.leaders_in_training);
  const mbbD = sum((r) => r.mbb_disciples);
  const gens = rows.map((r) => r.gen);
  const rNums = rows.map((r) => r.r_number).filter((x): x is number => x != null);

    return {
    level,
    key,
    label: formatPlaceName(label),
    region:
      level === "region" || level === "country"
        ? formatPlaceName(rows[0]?.region ?? "")
        : undefined,
    country: level === "country" ? formatPlaceName(rows[0]?.country ?? "") : undefined,
    row_count: rows.length,
    com_churches: sum((r) => r.com_churches),
    cat_churches: sum((r) => r.cat_churches),
    total_churches: ch,
    dbs,
    avg_church_size: ch ? Math.round((nd / ch) * 10) / 10 : null,
    leaders_in_training: leaders,
    new_disciples: nd,
    new_baptisms: nb,
    population: pop,
    mbb_disciples: mbbD,
    mbb_churches: sum((r) => r.mbb_churches),
    mb_churches: sum((r) => r.mb_churches),
    max_gen: gens.length ? Math.max(...gens) : 0,
    avg_gen: gens.length ? Math.round((gens.reduce((a, b) => a + b, 0) / gens.length) * 10) / 10 : 0,
    lost_churches: sum((r) => r.lost_churches),
    merged_churches: sum((r) => r.merged_churches),
    disciples_per_church: safeDiv(nd, ch),
    disciples_per_baptism: safeDiv(nd, nb),
    baptisms_per_church: safeDiv(nb, ch),
    dbs_per_church: safeDiv(dbs, ch),
    mbb_vs_pop_pct: pop ? Math.round((mbbD / pop) * 100000) / 1000 : null,
    market_share_pct: pop ? Math.round((nd / pop) * 100000) / 1000 : null,
    r_number_avg: rNums.length
      ? Math.round((rNums.reduce((a, b) => a + b, 0) / rNums.length) * 100) / 100
      : null,
    pct_chg_disciples: pctChange(nd, priorNd),
    pct_chg_baptisms: pctChange(nb, priorBap),
    pct_chg_churches: pctChange(ch, priorCh),
    pct_chg_leaders: pctChange(leaders, priorLeaders),
    crisis_engagements: rows.filter((r) => r.crisis_flag).length,
    health_score: healthScoreForRows(rows),
  };
}

export async function getRollup(
  quarterEnd: string,
  level: RollupLevel,
  filters: { region?: string; country?: string }
): Promise<RollupRow[]> {
  const all = await loadEngagements(quarterEnd);
  let rows = all;

  if (filters.region) rows = rows.filter((r) => r.region === filters.region);
  if (filters.country) rows = rows.filter((r) => r.country === filters.country);

  if (level === "global") {
    return [aggregate(all, "global", "GLOBAL", "Global")];
  }
  if (level === "region") {
    const byRegion = new Map<string, EngagementRow[]>();
    for (const r of all) {
      if (!byRegion.has(r.region)) byRegion.set(r.region, []);
      byRegion.get(r.region)!.push(r);
    }
    return [...byRegion.entries()]
      .map(([reg, rs]) => aggregate(rs, "region", reg, reg))
      .sort((a, b) => b.new_disciples - a.new_disciples);
  }
  if (level === "country") {
    const byCountry = new Map<string, EngagementRow[]>();
    for (const r of rows) {
      const k = `${r.country}`;
      if (!byCountry.has(k)) byCountry.set(k, []);
      byCountry.get(k)!.push(r);
    }
    return [...byCountry.entries()]
      .map(([c, rs]) => aggregate(rs, "country", c, c))
      .sort((a, b) => b.new_disciples - a.new_disciples);
  }
  return rows
    .map((r) => {
      const row = aggregate(
        [r],
        "engagement",
        String(r.ng_key),
        r.engagement_name || r.people_group
      );
      return {
        ...row,
        region: formatPlaceName(r.region),
        country: formatPlaceName(r.country),
      };
    })
    .sort((a, b) => b.new_disciples - a.new_disciples);
}

export type MissingFieldStat = {
  field: string;
  label: string;
  missing_count: number;
  total_count: number;
  missing_pct: number;
};

export type MissingDataReport = {
  quarter_end: string;
  level: string;
  key: string;
  fields: MissingFieldStat[];
};

const MISSING_CHECKS: { field: string; label: string; isMissing: (r: EngagementRow) => boolean }[] = [
  { field: "engagement_id", label: "Engagement ID", isMissing: (r) => !r.engagement_id },
  { field: "dbs", label: "DBS", isMissing: (r) => r.dbs === 0 && r.total_churches === 0 },
  { field: "total_churches", label: "Churches", isMissing: (r) => r.total_churches === 0 },
  { field: "new_disciples", label: "New disciples", isMissing: (r) => r.new_disciples === 0 },
  { field: "new_baptisms", label: "Baptisms", isMissing: (r) => r.new_baptisms === 0 },
  { field: "mbb_pct", label: "MBB %", isMissing: (r) => r.mbb_pct == null && (r.new_disciples > 0 || r.total_churches > 0) },
  { field: "gen", label: "GEN", isMissing: (r) => r.gen === 0 && r.total_churches > 0 },
  { field: "leaders_in_training", label: "Leaders trained", isMissing: (r) => r.leaders_in_training === 0 },
  { field: "population", label: "Population (POP)", isMissing: (r) => !r.population },
  { field: "avg_church_size", label: "Avg church size", isMissing: (r) => r.avg_church_size == null },
];

function missingForRows(rows: EngagementRow[]): MissingFieldStat[] {
  const n = rows.length;
  return MISSING_CHECKS.map(({ field, label, isMissing }) => {
    const missing = rows.filter(isMissing).length;
    return {
      field,
      label,
      missing_count: missing,
      total_count: n,
      missing_pct: n ? Math.round((missing / n) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.missing_pct - a.missing_pct);
}

export async function getMissingData(
  quarterEnd: string,
  groupBy: "global" | "region" | "country"
): Promise<MissingDataReport[]> {
  const all = await loadEngagements(quarterEnd);
  if (groupBy === "global") {
    return [{ quarter_end: quarterEnd, level: "global", key: "GLOBAL", fields: missingForRows(all) }];
  }
  const map = new Map<string, EngagementRow[]>();
  for (const r of all) {
    const k = groupBy === "region" ? r.region : r.country;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return [...map.entries()]
    .map(([key, rows]) => ({
      quarter_end: quarterEnd,
      level: groupBy,
      key,
      fields: missingForRows(rows),
    }))
    .sort((a, b) => {
      const ap = a.fields.find((f) => f.field === "mbb_pct")?.missing_pct ?? 0;
      const bp = b.fields.find((f) => f.field === "mbb_pct")?.missing_pct ?? 0;
      return bp - ap;
    });
}

export async function getTopPerformers(
  quarterEnd: string,
  metric: keyof RollupRow,
  limit = 15
): Promise<EngagementRow[]> {
  const all = await loadEngagements(quarterEnd);
  const metricMap: Record<string, (r: EngagementRow) => number> = {
    new_disciples: (r) => r.new_disciples,
    new_baptisms: (r) => r.new_baptisms,
    total_churches: (r) => r.total_churches,
    dbs: (r) => r.dbs,
    mbb_disciples: (r) => r.mbb_disciples,
    leaders_in_training: (r) => r.leaders_in_training,
    market_share_pct: (r) => r.market_share_pct ?? 0,
    disciples_per_church: (r) => r.disciples_per_church ?? 0,
    r_number: (r) => r.r_number ?? 0,
  };
  const fn = metricMap[String(metric)] ?? ((r: EngagementRow) => r.new_disciples);
  return [...all]
    .sort((a, b) => fn(b) - fn(a))
    .slice(0, limit)
    .map((r) => ({
      ...r,
      region: formatPlaceName(r.region),
      country: formatPlaceName(r.country),
      people_group: formatPlaceName(r.people_group),
      engagement_name: formatPlaceName(r.engagement_name),
    }));
}

export type ConcernEngagement = {
  engagement_id: number | null;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  reasons: string[];
  new_disciples: number;
  new_baptisms: number;
  total_churches: number;
  prior_new_disciples: number;
  prior_churches: number;
  pct_chg_disciples: number | null;
  pct_chg_churches: number | null;
};

export type NotReportingEngagement = {
  engagement_id: number;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  last_reported_quarter: string | null;
  quarters_not_reported: number;
  missed_quarter_labels: string[];
};

export type EngagementReportingSummary = {
  total_engagements: number;
  reporting_this_quarter: number;
  not_reporting: number;
};

function isStandardQuarterEnd(iso: string): boolean {
  const mo = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  return (
    (mo === "03" && day === "31") ||
    (mo === "06" && day === "30") ||
    (mo === "09" && day === "30") ||
    (mo === "12" && day === "31")
  );
}

const STANDARD_QUARTER_SQL = `
  (
    (MONTH(\`date\`) = 3 AND DAY(\`date\`) = 31) OR
    (MONTH(\`date\`) = 6 AND DAY(\`date\`) = 30) OR
    (MONTH(\`date\`) = 9 AND DAY(\`date\`) = 30) OR
    (MONTH(\`date\`) = 12 AND DAY(\`date\`) = 31)
  )
`;

/** Row counts as a real report (not an empty / placeholder row). */
const SUBSTANTIVE_REPORT_SQL = `
  (
    COALESCE(new_disciples, 0) > 0 OR COALESCE(new_baptisms, 0) > 0
    OR COALESCE(total_church, 0) > 0 OR COALESCE(dbs, 0) > 0
    OR COALESCE(com_church, 0) > 0 OR COALESCE(cat_church, 0) > 0
  )
`;

const MISSED_LABEL_DISPLAY_LIMIT = 8;

/** Every distinct standard quarter-end in Dash_all_data, newest first (no row-count cap). */
async function listAllStandardQuarterEnds(): Promise<string[]> {
  const rows = await query<{ d: string }>(
    `
    SELECT DISTINCT DATE_FORMAT(\`date\`, '%Y-%m-%d') AS d
    FROM Dash_all_data
    WHERE \`date\` IS NOT NULL AND ${STANDARD_QUARTER_SQL}
    ORDER BY d DESC
    `
  );
  return rows.map((r) => r.d).filter((d) => isStandardQuarterEnd(d));
}

export function detectEngagementConcerns(row: EngagementRow): string[] {
  const reasons: string[] = [];
  const d = row.pct_chg_disciples;
  const c = row.pct_chg_churches;
  const b = row.pct_chg_baptisms;

  if (d != null && d <= -25) reasons.push(`Disciples down ${Math.abs(d)}% vs last quarter`);
  if (c != null && c <= -25) reasons.push(`Churches down ${Math.abs(c)}% vs last quarter`);
  if (b != null && b <= -25) reasons.push(`Baptisms down ${Math.abs(b)}% vs last quarter`);
  if (row.prior_new_disciples >= 25 && row.new_disciples === 0) {
    reasons.push("No new disciples this quarter (reported last quarter)");
  }
  if (row.prior_churches >= 3 && row.total_churches === 0) {
    reasons.push("No churches this quarter (had churches last quarter)");
  }
  if (row.total_churches > 0 && row.gen === 0) reasons.push("Churches reported but GEN is 0");
  if (row.new_baptisms > row.new_disciples && row.new_disciples > 0) {
    reasons.push("Baptisms exceed new disciples");
  }
  if ((row.new_disciples > 0 || row.total_churches > 0) && row.mbb_pct == null) {
    reasons.push("Activity reported but MBB % is missing");
  }
  if (row.crisis_flag && row.crisis_keywords) {
    reasons.push(`Hard-place note: ${row.crisis_keywords}`);
  }
  return reasons;
}

function concernSortKey(row: ConcernEngagement): number {
  const d = row.pct_chg_disciples;
  if (d != null && d < 0) return d;
  return 0;
}

export async function getConcernEngagements(quarterEnd: string): Promise<ConcernEngagement[]> {
  const all = await loadEngagements(quarterEnd);
  return all
    .map((r) => {
      const reasons = detectEngagementConcerns(r);
      if (!reasons.length) return null;
      return {
        engagement_id: r.engagement_id,
        region: formatPlaceName(r.region),
        country: formatPlaceName(r.country),
        people_group: formatPlaceName(r.people_group),
        engagement_name: formatPlaceName(r.engagement_name || r.people_group),
        reasons,
        new_disciples: r.new_disciples,
        new_baptisms: r.new_baptisms,
        total_churches: r.total_churches,
        prior_new_disciples: r.prior_new_disciples,
        prior_churches: r.prior_churches,
        pct_chg_disciples: r.pct_chg_disciples,
        pct_chg_churches: r.pct_chg_churches,
      };
    })
    .filter((r): r is ConcernEngagement => r != null)
    .sort((a, b) => concernSortKey(a) - concernSortKey(b));
}

export async function getNotReportingEngagements(quarterEnd: string): Promise<{
  rows: NotReportingEngagement[];
  summary: EngagementReportingSummary;
}> {
  const emptySummary: EngagementReportingSummary = {
    total_engagements: 0,
    reporting_this_quarter: 0,
    not_reporting: 0,
  };
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd || !isStandardQuarterEnd(qEnd)) return { rows: [], summary: emptySummary };

  let standardQuarters = await listAllStandardQuarterEnds();
  if (!standardQuarters.includes(qEnd)) {
    standardQuarters = [qEnd, ...standardQuarters];
  }

  const curIdx = standardQuarters.indexOf(qEnd);
  if (curIdx < 0) return { rows: [], summary: emptySummary };

  const current = qEnd;

  const roster = await query<{
    engagement_id: number;
    region: string;
    country: string;
    people_group: string;
    engagement_name: string;
    last_sub_q: string | null;
  }>(
    `
    SELECT
      engagement_id,
      SUBSTRING_INDEX(GROUP_CONCAT(region ORDER BY \`date\` DESC), ',', 1) AS region,
      SUBSTRING_INDEX(GROUP_CONCAT(country ORDER BY \`date\` DESC), ',', 1) AS country,
      SUBSTRING_INDEX(GROUP_CONCAT(people_group ORDER BY \`date\` DESC), ',', 1) AS people_group,
      SUBSTRING_INDEX(GROUP_CONCAT(engagment_name ORDER BY \`date\` DESC), ',', 1) AS engagement_name,
      DATE_FORMAT(
        MAX(CASE WHEN ${STANDARD_QUARTER_SQL} AND ${SUBSTANTIVE_REPORT_SQL} THEN \`date\` END),
        '%Y-%m-%d'
      ) AS last_sub_q
    FROM Dash_all_data
    WHERE engagement_id IS NOT NULL
    GROUP BY engagement_id
    `
  );

  const reportedOnCurrent = await query<{ engagement_id: number }>(
    `
    SELECT DISTINCT engagement_id
    FROM Dash_all_data
    WHERE engagement_id IS NOT NULL AND \`date\` = ? AND ${SUBSTANTIVE_REPORT_SQL}
    `,
    [current]
  );

  const currentIds = new Set(reportedOnCurrent.map((r) => num(r.engagement_id)));

  const out: NotReportingEngagement[] = [];
  for (const row of roster) {
    const id = num(row.engagement_id);
    if (currentIds.has(id)) continue;

    const lastSub = row.last_sub_q ? normalizeQuarterEnd(row.last_sub_q) : null;
    const missedLabels: string[] = [];
    let quartersMissed = 0;
    for (let i = curIdx; i < standardQuarters.length; i++) {
      const q = standardQuarters[i]!;
      if (lastSub && q <= lastSub) break;
      quartersMissed++;
      if (missedLabels.length < MISSED_LABEL_DISPLAY_LIMIT) missedLabels.push(q);
    }
    if (quartersMissed === 0) quartersMissed = 1;

    out.push({
      engagement_id: id,
      region: formatPlaceName(String(row.region ?? "")),
      country: formatPlaceName(String(row.country ?? "")),
      people_group: formatPlaceName(String(row.people_group ?? "")),
      engagement_name:
        formatPlaceName(String(row.engagement_name ?? "") || String(row.people_group ?? "")),
      last_reported_quarter: lastSub,
      quarters_not_reported: quartersMissed,
      missed_quarter_labels: missedLabels,
    });
  }

  const rows = out.sort((a, b) => b.quarters_not_reported - a.quarters_not_reported);
  return {
    rows,
    summary: {
      total_engagements: roster.length,
      reporting_this_quarter: currentIds.size,
      not_reporting: rows.length,
    },
  };
}

/** @deprecated Use getConcernEngagements — kept for older clients */
export async function getCrisisByRegion(quarterEnd: string) {
  const concerns = await getConcernEngagements(quarterEnd);
  const byRegion = new Map<string, ConcernEngagement[]>();
  for (const c of concerns) {
    if (!byRegion.has(c.region)) byRegion.set(c.region, []);
    byRegion.get(c.region)!.push(c);
  }
  return [...byRegion.entries()].map(([region, rows]) => ({
    region: formatPlaceName(region),
    total_engagements: rows.length,
    crisis_engagements: rows.length,
    crisis_pct: 0,
    sample_notes: rows.slice(0, 3).map((r) => ({
      country: formatPlaceName(r.country),
      people_group: formatPlaceName(r.people_group),
      note: r.reasons.join("; "),
      keywords: "",
    })),
  }));
}
