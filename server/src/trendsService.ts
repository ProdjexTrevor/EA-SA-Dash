import { query, num } from "./db.js";
import { formatPlaceName } from "./formatPlaceName.js";
import { normalizeQuarterEnd } from "./quarterDates.js";

export type MovementTrendPoint = {
  quarter_end: string;
  year_quarter: string;
  row_count: number;
  dbs: number;
  com_churches: number;
  cat_churches: number;
  total_churches: number;
  new_disciples: number;
  new_baptisms: number;
  mbb_disciples: number;
  mbb_churches: number;
  avg_gen: number;
};

export type TrendFilters = {
  date_from: string;
  date_to: string;
  regions: string[];
  countries: string[];
  engagements: { engagement_id: number; name: string; region: string; country: string }[];
};

function formatYearQuarter(isoDate: string): string {
  const iso = normalizeQuarterEnd(isoDate) ?? isoDate;
  const mo = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  const q = mo <= 3 ? 1 : mo <= 6 ? 2 : mo <= 9 ? 3 : 4;
  return `${y}-Q${q}`;
}

function buildWhere(
  alias: string,
  filters: {
    dateFrom: string;
    dateTo: string;
    region?: string;
    country?: string;
    engagementId?: number;
  }
): { sql: string; params: unknown[] } {
  const a = alias;
  const parts = [`${a}.\`date\` IS NOT NULL`, `${a}.\`date\` >= ?`, `${a}.\`date\` <= ?`];
  const params: unknown[] = [filters.dateFrom, filters.dateTo];
  if (filters.region) {
    parts.push(`${a}.region = ?`);
    params.push(filters.region);
  }
  if (filters.country) {
    parts.push(`${a}.country = ?`);
    params.push(filters.country);
  }
  if (filters.engagementId != null) {
    parts.push(`${a}.engagement_id = ?`);
    params.push(filters.engagementId);
  }
  return { sql: parts.join(" AND "), params };
}

export async function getMovementTrends(filters: {
  dateFrom: string;
  dateTo: string;
  region?: string;
  country?: string;
  engagementId?: number;
}): Promise<MovementTrendPoint[]> {
  const { sql: where, params } = buildWhere("a", filters);

  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      DATE_FORMAT(a.\`date\`, '%Y-%m-%d') AS quarter_end,
      COUNT(*) AS row_count,
      SUM(COALESCE(a.dbs, 0)) AS dbs,
      SUM(COALESCE(a.com_church, 0)) AS com_churches,
      SUM(COALESCE(a.cat_church, 0)) AS cat_churches,
      SUM(COALESCE(a.total_church, 0)) AS total_churches,
      SUM(COALESCE(a.new_disciples, 0)) AS new_disciples,
      SUM(COALESCE(a.new_baptisms, 0)) AS new_baptisms,
      SUM(COALESCE(a.mbb_disciples_calc, 0)) AS mbb_disciples,
      SUM(COALESCE(CAST(NULLIF(TRIM(a.mbb_churches_calc), '') AS SIGNED), 0)) AS mbb_churches,
      ROUND(AVG(COALESCE(a.gen, 0)), 2) AS avg_gen
    FROM Dash_all_data a
    WHERE ${where}
    GROUP BY a.\`date\`
    ORDER BY a.\`date\`
    `,
    params
  );

  return rows.map((r) => {
    const qe = String(r.quarter_end);
    return {
      quarter_end: qe,
      year_quarter: formatYearQuarter(qe),
      row_count: num(r.row_count),
      dbs: num(r.dbs),
      com_churches: num(r.com_churches),
      cat_churches: num(r.cat_churches),
      total_churches: num(r.total_churches),
      new_disciples: num(r.new_disciples),
      new_baptisms: num(r.new_baptisms),
      mbb_disciples: num(r.mbb_disciples),
      mbb_churches: num(r.mbb_churches),
      avg_gen: num(r.avg_gen),
    };
  });
}

export async function getTrendFilterOptions(
  dateFrom: string,
  dateTo: string,
  region?: string,
  country?: string
): Promise<TrendFilters> {
  const baseWhere = "`date` >= ? AND `date` <= ?";
  const baseParams: unknown[] = [dateFrom, dateTo];

  const regions = await query<{ region: string }>(
    `SELECT DISTINCT region FROM Dash_all_data WHERE ${baseWhere} AND region IS NOT NULL ORDER BY region`,
    baseParams
  );

  let countrySql = baseWhere;
  const countryParams = [...baseParams];
  if (region) {
    countrySql += " AND region = ?";
    countryParams.push(region);
  }
  const countries = await query<{ country: string }>(
    `SELECT DISTINCT country FROM Dash_all_data WHERE ${countrySql} AND country IS NOT NULL ORDER BY country`,
    countryParams
  );

  let engSql = countrySql;
  const engParams = [...countryParams];
  if (country) {
    engSql += " AND country = ?";
    engParams.push(country);
  }
  const engagements = await query<{
    engagement_id: number;
    name: string;
    region: string;
    country: string;
  }>(
    `
    SELECT DISTINCT engagement_id, engagment_name AS name, region, country
    FROM Dash_all_data
    WHERE ${engSql} AND engagement_id IS NOT NULL
    ORDER BY engagment_name
    `,
    engParams
  );

  return {
    date_from: dateFrom,
    date_to: dateTo,
    regions: regions.map((r) => r.region),
    countries: countries.map((c) => c.country),
    engagements: engagements.map((e) => ({
      engagement_id: num(e.engagement_id),
      name: formatPlaceName(e.name) || e.name,
      region: formatPlaceName(e.region),
      country: formatPlaceName(e.country),
    })),
  };
}

export const COMPARISON_METRICS = {
  new_disciples: "New disciples",
  new_baptisms: "Baptisms",
  dbs: "DBS",
  total_churches: "Total churches",
  com_churches: "Comm churches",
  cat_churches: "CAT churches",
  mbb_disciples: "MBB disciples",
  mbb_churches: "MBB churches",
} as const;

export type ComparisonMetric = keyof typeof COMPARISON_METRICS;

export type RegionalComparisonTrend = {
  metric: ComparisonMetric;
  metric_label: string;
  regions: string[];
  points: Array<Record<string, string | number>>;
};

function quarterEndIso(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s.slice(0, 10);
}

export async function getRegionalComparisonTrends(
  dateFrom: string,
  dateTo: string,
  metric: ComparisonMetric,
  regionFilter?: string[]
): Promise<RegionalComparisonTrend> {
  const metricCols: Record<ComparisonMetric, string> = {
    new_disciples: "SUM(COALESCE(a.new_disciples, 0))",
    new_baptisms: "SUM(COALESCE(a.new_baptisms, 0))",
    dbs: "SUM(COALESCE(a.dbs, 0))",
    total_churches: "SUM(COALESCE(a.total_church, 0))",
    com_churches: "SUM(COALESCE(a.com_church, 0))",
    cat_churches: "SUM(COALESCE(a.cat_church, 0))",
    mbb_disciples: "SUM(COALESCE(a.mbb_disciples_calc, 0))",
    mbb_churches: "SUM(COALESCE(CAST(NULLIF(TRIM(a.mbb_churches_calc), '') AS SIGNED), 0))",
  };

  const params: unknown[] = [dateFrom, dateTo];
  let regionClause = "AND a.region IS NOT NULL AND TRIM(a.region) <> ''";
  if (regionFilter?.length) {
    regionClause += ` AND a.region IN (${regionFilter.map(() => "?").join(", ")})`;
    params.push(...regionFilter);
  }

  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      a.\`date\` AS quarter_date,
      a.region,
      ${metricCols[metric]} AS value
    FROM Dash_all_data a
    WHERE a.\`date\` IS NOT NULL AND a.\`date\` >= ? AND a.\`date\` <= ?
      ${regionClause}
    GROUP BY a.\`date\`, a.region
    ORDER BY a.\`date\`, a.region
    `,
    params
  );

  const regionSet = new Set<string>();
  const byQuarter = new Map<string, Record<string, string | number>>();

  for (const r of rows) {
    const reg = formatPlaceName(String(r.region));
    const qe = quarterEndIso(r.quarter_date);
    regionSet.add(reg);
    if (!byQuarter.has(qe)) {
      byQuarter.set(qe, { quarter_end: qe, year_quarter: formatYearQuarter(qe) });
    }
    const row = byQuarter.get(qe)!;
    row[reg] = num(r.value);
  }

  const regions = [...regionSet].sort();
  for (const row of byQuarter.values()) {
    for (const reg of regions) {
      if (row[reg] === undefined) row[reg] = 0;
    }
  }

  return {
    metric,
    metric_label: COMPARISON_METRICS[metric],
    regions,
    points: [...byQuarter.values()].sort((a, b) =>
      String(a.quarter_end).localeCompare(String(b.quarter_end))
    ),
  };
}

export async function defaultTrendRange(): Promise<{ dateFrom: string; dateTo: string }> {
  const rows = await query<{ date_to: string; date_from: string }>(
    `
    WITH recent AS (
      SELECT \`date\` FROM Dash_all_data WHERE \`date\` IS NOT NULL
      GROUP BY \`date\` ORDER BY \`date\` DESC LIMIT 15
    )
    SELECT
      DATE_FORMAT(MAX(\`date\`), '%Y-%m-%d') AS date_to,
      DATE_FORMAT(MIN(\`date\`), '%Y-%m-%d') AS date_from
    FROM recent
    `
  );
  const r = rows[0];
  return {
    dateFrom: r?.date_from ?? "2020-01-01",
    dateTo: r?.date_to ?? "2026-03-31",
  };
}
