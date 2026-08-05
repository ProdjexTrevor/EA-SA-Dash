import { query, num } from "./db.js";
import { formatPlaceName } from "./formatPlaceName.js";

export type QuarterOption = { date: string; row_count: number };

export type HealthSummary = {
  quarter_end: string;
  total_rows: number;
  healthy_rows: number;
  warning_rows: number;
  critical_rows: number;
  health_score: number;
  issue_counts: Record<string, number>;
  totals: {
    dbs: number;
    churches: number;
    new_disciples: number;
    new_baptisms: number;
    mbb_disciples_calc: number;
    mbb_churches_calc: number;
  };
};

export type HealthIssue = {
  ng_key: number;
  quarter_end: string;
  region: string;
  country: string;
  people_group: string;
  engagement_name: string;
  engagement_id: number | null;
  severity: "critical" | "warning";
  issue_codes: string;
  issue_count: number;
  dbs: number | null;
  total_church: number | null;
  gen: number | null;
  new_disciples: number | null;
  new_baptisms: number | null;
  mbb_decimal: number | null;
};

export type RegionHealth = {
  region: string;
  total_rows: number;
  healthy_rows: number;
  issue_rows: number;
  health_score: number;
  mbb_disciples_calc: number;
  mbb_churches_calc: number;
};

export type QuarterTrend = {
  quarter_end: string;
  year_quarter: string;
  row_count: number;
  health_score: number;
  issue_rows: number;
  mbb_disciples_calc: number;
  mbb_churches_calc: number;
  new_disciples: number;
  total_church: number;
};

export type RegionalScorecard = {
  region: string;
  quarter_end: string;
  total_rows: number;
  active_rows: number;
  healthy_rows: number;
  critical_rows: number;
  warning_rows: number;
  integrity_score: number;
  completeness_score: number;
  consistency_score: number;
  movement_score: number;
  overall_score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  status: "Healthy" | "Watch" | "At Risk";
  new_disciples: number;
  new_baptisms: number;
  total_churches: number;
  total_dbs: number;
  mbb_disciples_calc: number;
  mbb_churches_calc: number;
  top_issues: { code: string; count: number }[];
  manager_note: string;
};

export type ScorecardReport = {
  quarter_end: string;
  generated_at: string;
  methodology: {
    weights: Record<string, number>;
    grades: Record<string, string>;
  };
  global_overall_score: number;
  regions: RegionalScorecard[];
};

const ISSUE_ROW_CTE = `
WITH base AS (
  SELECT
    a.ng_key,
    a.date AS quarter_end,
    a.region,
    a.country,
    a.people_group,
    a.engagment_name AS engagement_name,
    a.engagement_id,
    COALESCE(a.dbs, 0) AS dbs,
    COALESCE(a.total_church, 0) AS total_church,
    COALESCE(a.gen, 0) AS gen,
    COALESCE(a.new_disciples, 0) AS new_disciples,
    COALESCE(a.new_baptisms, 0) AS new_baptisms,
    a.mbb_decimal,
    COALESCE(a.mbb_disciples_calc, 0) AS mbb_disciples_calc,
    COALESCE(CAST(NULLIF(TRIM(a.mbb_churches_calc), '') AS SIGNED), 0) AS mbb_churches_calc,
    /* True duplicate = same engagement + quarter + people group (not multi-PG reporting). */
    COUNT(*) OVER (
      PARTITION BY a.engagement_id, a.date, COALESCE(NULLIF(TRIM(a.people_group), ''), '__none__')
    ) AS dup_engagement_date_pg
  FROM Dash_all_data a
  WHERE a.date = ?
),
flags AS (
  SELECT
    b.*,
    CASE WHEN b.engagement_id IS NULL THEN 1 ELSE 0 END AS f_missing_engagement_id,
    CASE WHEN b.total_church > 0 AND b.gen = 0 THEN 1 ELSE 0 END AS f_churches_no_gen,
    CASE
      WHEN b.engagement_id IS NOT NULL AND b.dup_engagement_date_pg > 1 THEN 1
      ELSE 0
    END AS f_dup_engagement_date,
    CASE
      WHEN (b.new_disciples > 0 OR b.total_church > 0)
       AND b.mbb_decimal IS NULL THEN 1 ELSE 0
    END AS f_missing_mbb_decimal,
    CASE
      WHEN b.mbb_decimal IS NOT NULL AND b.new_disciples > 0 AND b.mbb_disciples_calc = 0 THEN 1 ELSE 0
    END AS f_stale_mbb_disciples_calc,
    CASE
      WHEN b.mbb_decimal IS NOT NULL AND b.total_church > 0 AND b.mbb_churches_calc = 0 THEN 1 ELSE 0
    END AS f_stale_mbb_churches_calc,
    CASE WHEN b.new_baptisms > b.new_disciples AND b.new_disciples > 0 THEN 1 ELSE 0 END AS f_baptisms_exceed_disciples,
    CASE WHEN b.total_church > 0 AND b.dbs = 0 THEN 1 ELSE 0 END AS f_churches_without_dbs,
    CASE WHEN b.gen > 12 THEN 1 ELSE 0 END AS f_gen_very_high,
    CASE WHEN b.dbs < 0 OR b.total_church < 0 OR b.new_disciples < 0 OR b.new_baptisms < 0 THEN 1 ELSE 0 END AS f_negative_counts
  FROM base b
),
scored AS (
  SELECT
    f.*,
    (f.f_missing_engagement_id + f.f_dup_engagement_date + f.f_negative_counts) AS critical_count,
    (f.f_churches_no_gen + f.f_missing_mbb_decimal + f.f_stale_mbb_disciples_calc
      + f.f_stale_mbb_churches_calc + f.f_baptisms_exceed_disciples + f.f_churches_without_dbs
      + f.f_gen_very_high) AS warning_count,
    TRIM(BOTH ',' FROM CONCAT(
      IF(f.f_missing_engagement_id, 'MISSING_ENGAGEMENT_ID,', ''),
      IF(f.f_dup_engagement_date, 'DUPLICATE_ENGAGEMENT_DATE,', ''),
      IF(f.f_negative_counts, 'NEGATIVE_COUNTS,', ''),
      IF(f.f_churches_no_gen, 'CHURCHES_NO_GEN,', ''),
      IF(f.f_missing_mbb_decimal, 'MISSING_MBB_DECIMAL,', ''),
      IF(f.f_stale_mbb_disciples_calc, 'STALE_MBB_DISCIPLES_CALC,', ''),
      IF(f.f_stale_mbb_churches_calc, 'STALE_MBB_CHURCHES_CALC,', ''),
      IF(f.f_baptisms_exceed_disciples, 'BAPTISMS_EXCEED_DISCIPLES,', ''),
      IF(f.f_churches_without_dbs, 'CHURCHES_WITHOUT_DBS,', ''),
      IF(f.f_gen_very_high, 'GEN_VERY_HIGH,', '')
    )) AS issue_codes
  FROM flags f
)
`;

export async function listQuarters(limit = 20): Promise<QuarterOption[]> {
  return query<QuarterOption>(
    `
    SELECT DATE_FORMAT(\`date\`, '%Y-%m-%d') AS date, COUNT(*) AS row_count
    FROM Dash_all_data
    WHERE \`date\` IS NOT NULL
    GROUP BY \`date\`
    ORDER BY \`date\` DESC
    LIMIT ?
    `,
    [limit]
  );
}

export async function getLatestQuarter(): Promise<string | null> {
  const rows = await query<{ d: string }>(
    `SELECT DATE_FORMAT(MAX(\`date\`), '%Y-%m-%d') AS d FROM Dash_all_data WHERE \`date\` IS NOT NULL`
  );
  return rows[0]?.d ?? null;
}

export async function getHealthSummary(quarterEnd: string): Promise<HealthSummary> {
  const rows = await query<{
    total_rows: number;
    healthy_rows: number;
    warning_rows: number;
    critical_rows: number;
    sum_dbs: number;
    sum_churches: number;
    sum_disciples: number;
    sum_baptisms: number;
    sum_mbb_disc: number;
    sum_mbb_ch: number;
    missing_engagement_id: number;
    churches_no_gen: number;
    dup_engagement_date: number;
    missing_mbb_decimal: number;
    stale_mbb_disciples_calc: number;
    stale_mbb_churches_calc: number;
    baptisms_exceed_disciples: number;
    churches_without_dbs: number;
    gen_very_high: number;
    negative_counts: number;
  }>(
    `
    ${ISSUE_ROW_CTE}
    SELECT
      COUNT(*) AS total_rows,
      SUM(CASE WHEN critical_count = 0 AND warning_count = 0 THEN 1 ELSE 0 END) AS healthy_rows,
      SUM(CASE WHEN critical_count = 0 AND warning_count > 0 THEN 1 ELSE 0 END) AS warning_rows,
      SUM(CASE WHEN critical_count > 0 THEN 1 ELSE 0 END) AS critical_rows,
      SUM(dbs) AS sum_dbs,
      SUM(total_church) AS sum_churches,
      SUM(new_disciples) AS sum_disciples,
      SUM(new_baptisms) AS sum_baptisms,
      SUM(mbb_disciples_calc) AS sum_mbb_disc,
      SUM(mbb_churches_calc) AS sum_mbb_ch,
      SUM(f_missing_engagement_id) AS missing_engagement_id,
      SUM(f_churches_no_gen) AS churches_no_gen,
      SUM(f_dup_engagement_date) AS dup_engagement_date,
      SUM(f_missing_mbb_decimal) AS missing_mbb_decimal,
      SUM(f_stale_mbb_disciples_calc) AS stale_mbb_disciples_calc,
      SUM(f_stale_mbb_churches_calc) AS stale_mbb_churches_calc,
      SUM(f_baptisms_exceed_disciples) AS baptisms_exceed_disciples,
      SUM(f_churches_without_dbs) AS churches_without_dbs,
      SUM(f_gen_very_high) AS gen_very_high,
      SUM(f_negative_counts) AS negative_counts
    FROM scored
    `,
    [quarterEnd]
  );

  const r = rows[0];
  const total = num(r?.total_rows);
  const healthy = num(r?.healthy_rows);
  const healthScore = total > 0 ? Math.round((healthy / total) * 1000) / 10 : 100;

  return {
    quarter_end: quarterEnd,
    total_rows: total,
    healthy_rows: healthy,
    warning_rows: num(r?.warning_rows),
    critical_rows: num(r?.critical_rows),
    health_score: healthScore,
    issue_counts: {
      MISSING_ENGAGEMENT_ID: num(r?.missing_engagement_id),
      CHURCHES_NO_GEN: num(r?.churches_no_gen),
      DUPLICATE_ENGAGEMENT_DATE: num(r?.dup_engagement_date),
      MISSING_MBB_DECIMAL: num(r?.missing_mbb_decimal),
      STALE_MBB_DISCIPLES_CALC: num(r?.stale_mbb_disciples_calc),
      STALE_MBB_CHURCHES_CALC: num(r?.stale_mbb_churches_calc),
      BAPTISMS_EXCEED_DISCIPLES: num(r?.baptisms_exceed_disciples),
      CHURCHES_WITHOUT_DBS: num(r?.churches_without_dbs),
      GEN_VERY_HIGH: num(r?.gen_very_high),
      NEGATIVE_COUNTS: num(r?.negative_counts),
    },
    totals: {
      dbs: num(r?.sum_dbs),
      churches: num(r?.sum_churches),
      new_disciples: num(r?.sum_disciples),
      new_baptisms: num(r?.sum_baptisms),
      mbb_disciples_calc: num(r?.sum_mbb_disc),
      mbb_churches_calc: num(r?.sum_mbb_ch),
    },
  };
}

export async function getHealthIssues(
  quarterEnd: string,
  opts: { severity?: string; search?: string; limit: number; offset: number }
): Promise<{ rows: HealthIssue[]; total: number }> {
  const params: unknown[] = [quarterEnd];
  let where = "WHERE (critical_count > 0 OR warning_count > 0)";
  if (opts.severity === "critical") where += " AND critical_count > 0";
  if (opts.severity === "warning") where += " AND critical_count = 0 AND warning_count > 0";
  if (opts.search) {
    where += " AND (country LIKE ? OR people_group LIKE ? OR engagement_name LIKE ? OR region LIKE ?)";
    const q = `%${opts.search}%`;
    params.push(q, q, q, q);
  }

  const countRows = await query<{ total: number }>(
    `${ISSUE_ROW_CTE} SELECT COUNT(*) AS total FROM scored ${where}`,
    params
  );

  const rows = await query<HealthIssue>(
    `
    ${ISSUE_ROW_CTE}
    SELECT
      ng_key,
      DATE_FORMAT(quarter_end, '%Y-%m-%d') AS quarter_end,
      region,
      country,
      people_group,
      engagement_name,
      engagement_id,
      CASE WHEN critical_count > 0 THEN 'critical' ELSE 'warning' END AS severity,
      issue_codes,
      (critical_count + warning_count) AS issue_count,
      dbs,
      total_church,
      gen,
      new_disciples,
      new_baptisms,
      mbb_decimal
    FROM scored
    ${where}
    ORDER BY critical_count DESC, warning_count DESC, region, country
    LIMIT ? OFFSET ?
    `,
    [...params, opts.limit, opts.offset]
  );

  return {
    rows: rows.map((r) => ({
      ...r,
      region: formatPlaceName(r.region),
      country: formatPlaceName(r.country),
      people_group: formatPlaceName(r.people_group),
      engagement_name: formatPlaceName(r.engagement_name),
    })),
    total: num(countRows[0]?.total),
  };
}

export async function getRegionHealth(quarterEnd: string): Promise<RegionHealth[]> {
  const rows = await query<RegionHealth>(
    `
    ${ISSUE_ROW_CTE}
    SELECT
      region,
      COUNT(*) AS total_rows,
      SUM(CASE WHEN critical_count = 0 AND warning_count = 0 THEN 1 ELSE 0 END) AS healthy_rows,
      SUM(CASE WHEN critical_count > 0 OR warning_count > 0 THEN 1 ELSE 0 END) AS issue_rows,
      ROUND(100 * SUM(CASE WHEN critical_count = 0 AND warning_count = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS health_score,
      SUM(mbb_disciples_calc) AS mbb_disciples_calc,
      SUM(mbb_churches_calc) AS mbb_churches_calc
    FROM scored
    GROUP BY region
    ORDER BY issue_rows DESC, region
    `,
    [quarterEnd]
  );
  return rows.map((r) => ({ ...r, region: formatPlaceName(r.region) }));
}

export async function getQuarterTrends(limit = 15): Promise<QuarterTrend[]> {
  const quarters = await listQuarters(limit);
  const trends: QuarterTrend[] = [];
  for (const q of quarters.reverse()) {
    const summary = await getHealthSummary(q.date);
    trends.push({
      quarter_end: q.date,
      year_quarter: formatYearQuarter(q.date),
      row_count: summary.total_rows,
      health_score: summary.health_score,
      issue_rows: summary.total_rows - summary.healthy_rows,
      mbb_disciples_calc: summary.totals.mbb_disciples_calc,
      mbb_churches_calc: summary.totals.mbb_churches_calc,
      new_disciples: summary.totals.new_disciples,
      total_church: summary.totals.churches,
    });
  }
  return trends;
}

function formatYearQuarter(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

const SCORE_WEIGHTS = {
  integrity: 0.3,
  completeness: 0.25,
  consistency: 0.25,
  movement: 0.2,
} as const;

export function scoreToGrade(score: number): RegionalScorecard["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scoreToStatus(score: number): RegionalScorecard["status"] {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Watch";
  return "At Risk";
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 100;
  return Math.round((part / whole) * 1000) / 10;
}

function managerNote(card: Omit<RegionalScorecard, "manager_note">): string {
  const issues: string[] = [];
  if (card.integrity_score < 95) issues.push("fix duplicate IDs and missing engagement keys");
  if (card.completeness_score < 80) issues.push("fill MBB % and refresh MBB calc fields");
  if (card.consistency_score < 80) issues.push("align GEN with churches and validate baptisms vs disciples");
  if (card.movement_score < 80) issues.push("report GEN where churches exist");
  if (issues.length === 0) return "Data quality is strong — maintain current reporting discipline.";
  return `Priority: ${issues.slice(0, 2).join("; ")}.`;
}

export async function getRegionalScorecard(quarterEnd: string): Promise<ScorecardReport> {
  const rows = await query<{
    region: string;
    total_rows: number;
    healthy_rows: number;
    critical_rows: number;
    warning_rows: number;
    active_rows: number;
    complete_active_rows: number;
    consistency_issue_rows: number;
    church_rows: number;
    church_with_gen: number;
    critical_issue_rows: number;
    sum_disciples: number;
    sum_baptisms: number;
    sum_churches: number;
    sum_dbs: number;
    sum_mbb_disc: number;
    sum_mbb_ch: number;
    iss_missing_mbb: number;
    iss_churches_no_gen: number;
    iss_dup: number;
    iss_baptisms: number;
    iss_stale_disc: number;
    iss_missing_id: number;
  }>(
    `
    ${ISSUE_ROW_CTE}
    SELECT
      region,
      COUNT(*) AS total_rows,
      SUM(CASE WHEN critical_count = 0 AND warning_count = 0 THEN 1 ELSE 0 END) AS healthy_rows,
      SUM(CASE WHEN critical_count > 0 THEN 1 ELSE 0 END) AS critical_rows,
      SUM(CASE WHEN critical_count = 0 AND warning_count > 0 THEN 1 ELSE 0 END) AS warning_rows,
      SUM(CASE WHEN new_disciples > 0 OR total_church > 0 OR dbs > 0 THEN 1 ELSE 0 END) AS active_rows,
      SUM(CASE
        WHEN (new_disciples > 0 OR total_church > 0 OR dbs > 0)
         AND f_missing_mbb_decimal = 0
         AND f_stale_mbb_disciples_calc = 0
         AND f_stale_mbb_churches_calc = 0
        THEN 1 ELSE 0
      END) AS complete_active_rows,
      SUM(CASE WHEN f_churches_no_gen + f_baptisms_exceed_disciples + f_churches_without_dbs + f_gen_very_high > 0 THEN 1 ELSE 0 END) AS consistency_issue_rows,
      SUM(CASE WHEN total_church > 0 THEN 1 ELSE 0 END) AS church_rows,
      SUM(CASE WHEN total_church > 0 AND gen > 0 THEN 1 ELSE 0 END) AS church_with_gen,
      SUM(CASE WHEN critical_count > 0 THEN 1 ELSE 0 END) AS critical_issue_rows,
      SUM(new_disciples) AS sum_disciples,
      SUM(new_baptisms) AS sum_baptisms,
      SUM(total_church) AS sum_churches,
      SUM(dbs) AS sum_dbs,
      SUM(mbb_disciples_calc) AS sum_mbb_disc,
      SUM(mbb_churches_calc) AS sum_mbb_ch,
      SUM(f_missing_mbb_decimal) AS iss_missing_mbb,
      SUM(f_churches_no_gen) AS iss_churches_no_gen,
      SUM(f_dup_engagement_date) AS iss_dup,
      SUM(f_baptisms_exceed_disciples) AS iss_baptisms,
      SUM(f_stale_mbb_disciples_calc) AS iss_stale_disc,
      SUM(f_missing_engagement_id) AS iss_missing_id
    FROM scored
    GROUP BY region
    ORDER BY region
    `,
    [quarterEnd]
  );

  const regions: RegionalScorecard[] = rows.map((r) => {
    const total = num(r.total_rows);
    const integrity = pct(total - num(r.critical_issue_rows), total);
    const completeness = pct(num(r.complete_active_rows), num(r.active_rows));
    const consistency = pct(total - num(r.consistency_issue_rows), total);
    const movement = pct(num(r.church_with_gen), num(r.church_rows));
    const overall =
      Math.round(
        (integrity * SCORE_WEIGHTS.integrity +
          completeness * SCORE_WEIGHTS.completeness +
          consistency * SCORE_WEIGHTS.consistency +
          movement * SCORE_WEIGHTS.movement) *
          10
      ) / 10;

    const topIssues = [
      { code: "MISSING_MBB_DECIMAL", count: num(r.iss_missing_mbb) },
      { code: "CHURCHES_NO_GEN", count: num(r.iss_churches_no_gen) },
      { code: "DUPLICATE_ENGAGEMENT_DATE", count: num(r.iss_dup) },
      { code: "BAPTISMS_EXCEED_DISCIPLES", count: num(r.iss_baptisms) },
      { code: "STALE_MBB_DISCIPLES_CALC", count: num(r.iss_stale_disc) },
      { code: "MISSING_ENGAGEMENT_ID", count: num(r.iss_missing_id) },
    ]
      .filter((i) => i.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const base = {
      region: formatPlaceName(r.region),
      quarter_end: quarterEnd,
      total_rows: total,
      active_rows: num(r.active_rows),
      healthy_rows: num(r.healthy_rows),
      critical_rows: num(r.critical_rows),
      warning_rows: num(r.warning_rows),
      integrity_score: integrity,
      completeness_score: completeness,
      consistency_score: consistency,
      movement_score: movement,
      overall_score: overall,
      grade: scoreToGrade(overall),
      status: scoreToStatus(overall),
      new_disciples: num(r.sum_disciples),
      new_baptisms: num(r.sum_baptisms),
      total_churches: num(r.sum_churches),
      total_dbs: num(r.sum_dbs),
      mbb_disciples_calc: num(r.sum_mbb_disc),
      mbb_churches_calc: num(r.sum_mbb_ch),
      top_issues: topIssues,
    };

    return { ...base, manager_note: managerNote(base) };
  });

  regions.sort((a, b) => b.overall_score - a.overall_score);

  const globalOverall =
    regions.length > 0
      ? Math.round((regions.reduce((s, r) => s + r.overall_score, 0) / regions.length) * 10) / 10
      : 0;

  return {
    quarter_end: quarterEnd,
    generated_at: new Date().toISOString(),
    methodology: {
      weights: { ...SCORE_WEIGHTS },
      grades: {
        A: "90–100 Excellent",
        B: "80–89 Good",
        C: "70–79 Fair",
        D: "60–69 Needs improvement",
        F: "Below 60 At risk",
      },
    },
    global_overall_score: globalOverall,
    regions,
  };
}

export function scorecardToCsv(report: ScorecardReport): string {
  const header = [
    "region",
    "quarter_end",
    "overall_score",
    "grade",
    "status",
    "integrity_score",
    "completeness_score",
    "consistency_score",
    "movement_score",
    "total_rows",
    "healthy_rows",
    "critical_rows",
    "warning_rows",
    "new_disciples",
    "new_baptisms",
    "total_churches",
    "total_dbs",
    "mbb_disciples_calc",
    "mbb_churches_calc",
    "top_issues",
    "manager_note",
  ];
  const lines = [header.join(",")];
  for (const r of report.regions) {
    const top = r.top_issues.map((i) => `${i.code}:${i.count}`).join("; ");
    const row = [
      r.region,
      r.quarter_end,
      r.overall_score,
      r.grade,
      r.status,
      r.integrity_score,
      r.completeness_score,
      r.consistency_score,
      r.movement_score,
      r.total_rows,
      r.healthy_rows,
      r.critical_rows,
      r.warning_rows,
      r.new_disciples,
      r.new_baptisms,
      r.total_churches,
      r.total_dbs,
      r.mbb_disciples_calc,
      r.mbb_churches_calc,
      `"${top}"`,
      `"${r.manager_note.replace(/"/g, '""')}"`,
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export const ISSUE_LABELS: Record<string, string> = {
  MISSING_ENGAGEMENT_ID: "Missing engagement ID",
  CHURCHES_NO_GEN: "Churches reported but GEN is 0",
  DUPLICATE_ENGAGEMENT_DATE:
    "Duplicate row: same engagement, quarter, and people group (re-submit or merge)",
  MISSING_MBB_DECIMAL: "Activity reported but no MBB %",
  STALE_MBB_DISCIPLES_CALC: "MBB % set but disciples calc is 0",
  STALE_MBB_CHURCHES_CALC: "MBB % set but churches calc is 0",
  BAPTISMS_EXCEED_DISCIPLES: "Baptisms exceed new disciples",
  CHURCHES_WITHOUT_DBS: "Churches without DBS",
  GEN_VERY_HIGH: "GEN above 12",
  NEGATIVE_COUNTS: "Negative count values",
};
