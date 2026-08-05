import { query, num } from "./db.js";
import { formatPlaceName } from "./formatPlaceName.js";
import { normalizeQuarterEnd, priorYearQuarterEnd } from "./quarterDates.js";

export type MetricYoY = {
  key: string;
  label: string;
  current: number;
  prior_year: number;
  change_abs: number;
  change_pct: number | null;
};

export type YoYTrend = "positive" | "negative" | "mixed";

export type YoYTrendSummary = {
  trend: YoYTrend;
  metrics_up: number;
  metrics_down: number;
  metrics_flat: number;
};

export type RegionalDashboard = {
  region: string;
  quarter_end: string;
  prior_year_quarter: string;
  row_count: number;
  metrics: MetricYoY[];
  yoy_trend: YoYTrend;
  yoy_summary: YoYTrendSummary;
};

export type ScorecardReport = {
  quarter_end: string;
  prior_year_quarter: string;
  generated_at: string;
  global_metrics: MetricYoY[];
  global_yoy_trend: YoYTrend;
  global_yoy_summary: YoYTrendSummary;
  regions: RegionalDashboard[];
};

type RegionTotals = {
  region: string;
  row_count: number;
  new_disciples: number;
  new_baptisms: number;
  total_churches: number;
  dbs: number;
  mbb_disciples: number;
  mbb_churches: number;
  gen: number;
  leaders_in_training: number;
};

const METRIC_DEFS: { key: string; label: string; pick: (t: RegionTotals) => number }[] = [
  { key: "new_disciples", label: "New disciples", pick: (t) => t.new_disciples },
  { key: "new_baptisms", label: "Baptisms", pick: (t) => t.new_baptisms },
  { key: "total_churches", label: "Churches", pick: (t) => t.total_churches },
  { key: "dbs", label: "Discovery groups (DBS)", pick: (t) => t.dbs },
  { key: "mbb_disciples", label: "MBB disciples", pick: (t) => t.mbb_disciples },
  { key: "mbb_churches", label: "MBB churches", pick: (t) => t.mbb_churches },
  { key: "leaders_in_training", label: "Leaders in training", pick: (t) => t.leaders_in_training },
  { key: "gen", label: "GEN (avg generations)", pick: (t) => t.gen },
];

function roundGen(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseLeaders(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "nan") return 0;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function pctChange(cur: number, prior: number): number | null {
  if (prior === 0 && cur === 0) return 0;
  if (prior === 0) return null;
  return Math.round(((cur - prior) / prior) * 1000) / 10;
}

export function computeYoYTrend(metrics: MetricYoY[]): YoYTrendSummary {
  let metrics_up = 0;
  let metrics_down = 0;
  let metrics_flat = 0;
  for (const m of metrics) {
    if (m.change_pct != null) {
      if (m.change_pct > 0) metrics_up++;
      else if (m.change_pct < 0) metrics_down++;
      else metrics_flat++;
      continue;
    }
    if (m.change_abs > 0) metrics_up++;
    else if (m.change_abs < 0) metrics_down++;
    else metrics_flat++;
  }
  let trend: YoYTrend = "mixed";
  if (metrics_up > metrics_down) trend = "positive";
  else if (metrics_down > metrics_up) trend = "negative";
  return { trend, metrics_up, metrics_down, metrics_flat };
}

function buildMetrics(current: RegionTotals, prior: RegionTotals | undefined): MetricYoY[] {
  return METRIC_DEFS.map((def) => {
    const rawCur = def.pick(current);
    const rawPy = prior ? def.pick(prior) : 0;
    const isGen = def.key === "gen";
    const cur = isGen ? roundGen(rawCur) : rawCur;
    const py = isGen ? roundGen(rawPy) : rawPy;
    const changeAbs = isGen ? roundGen(cur - py) : cur - py;
    return {
      key: def.key,
      label: def.label,
      current: cur,
      prior_year: py,
      change_abs: changeAbs,
      change_pct: pctChange(cur, py),
    };
  });
}

async function loadRegionalTotals(quarterEnd: string): Promise<Map<string, RegionTotals>> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      region,
      COUNT(*) AS row_count,
      SUM(COALESCE(new_disciples, 0)) AS new_disciples,
      SUM(COALESCE(new_baptisms, 0)) AS new_baptisms,
      SUM(COALESCE(total_church, 0)) AS total_churches,
      SUM(COALESCE(dbs, 0)) AS dbs,
      SUM(COALESCE(mbb_disciples_calc, 0)) AS mbb_disciples,
      SUM(COALESCE(CAST(NULLIF(TRIM(mbb_churches_calc), '') AS SIGNED), 0)) AS mbb_churches,
      ROUND(AVG(COALESCE(gen, 0)), 1) AS gen
    FROM Dash_all_data
    WHERE \`date\` = ?
    GROUP BY region
  `,
    [quarterEnd]
  );

  const leaderRows = await query<{ region: string; leaders_in_training: unknown }>(
    `SELECT region, leaders_in_training FROM Dash_all_data WHERE \`date\` = ?`,
    [quarterEnd]
  );
  const leadersByRegion = new Map<string, number>();
  for (const r of leaderRows) {
    const reg = String(r.region ?? "");
    leadersByRegion.set(reg, (leadersByRegion.get(reg) ?? 0) + parseLeaders(r.leaders_in_training));
  }

  const map = new Map<string, RegionTotals>();
  for (const r of rows) {
    const region = String(r.region ?? "");
    map.set(region, {
      region,
      row_count: num(r.row_count),
      new_disciples: num(r.new_disciples),
      new_baptisms: num(r.new_baptisms),
      total_churches: num(r.total_churches),
      dbs: num(r.dbs),
      mbb_disciples: num(r.mbb_disciples),
      mbb_churches: num(r.mbb_churches),
      gen: num(r.gen),
      leaders_in_training: leadersByRegion.get(region) ?? 0,
    });
  }
  return map;
}

function sumTotals(maps: Iterable<RegionTotals>): RegionTotals {
  const empty: RegionTotals = {
    region: "GLOBAL",
    row_count: 0,
    new_disciples: 0,
    new_baptisms: 0,
    total_churches: 0,
    dbs: 0,
    mbb_disciples: 0,
    mbb_churches: 0,
    gen: 0,
    leaders_in_training: 0,
  };
  for (const t of maps) {
    empty.row_count += t.row_count;
    empty.new_disciples += t.new_disciples;
    empty.new_baptisms += t.new_baptisms;
    empty.total_churches += t.total_churches;
    empty.dbs += t.dbs;
    empty.mbb_disciples += t.mbb_disciples;
    empty.mbb_churches += t.mbb_churches;
    empty.leaders_in_training += t.leaders_in_training;
  }
  return empty;
}

async function loadGlobalGenAvg(quarterEnd: string): Promise<number> {
  const rows = await query<{ gen: number }>(
    `SELECT ROUND(AVG(COALESCE(gen, 0)), 1) AS gen FROM Dash_all_data WHERE \`date\` = ?`,
    [quarterEnd]
  );
  return rows[0] ? roundGen(num(rows[0].gen)) : 0;
}

export async function getRegionalMovementDashboard(quarterEnd: string): Promise<ScorecardReport> {
  const qEnd = normalizeQuarterEnd(quarterEnd);
  if (!qEnd) throw new Error(`Invalid quarter date: ${quarterEnd}`);
  const priorY = priorYearQuarterEnd(qEnd);

  const [currentMap, priorMap, globalGenCur, globalGenPrior] = await Promise.all([
    loadRegionalTotals(qEnd),
    loadRegionalTotals(priorY),
    loadGlobalGenAvg(qEnd),
    loadGlobalGenAvg(priorY),
  ]);

  const trendRank: Record<YoYTrend, number> = { positive: 0, mixed: 1, negative: 2 };

  const regions: RegionalDashboard[] = [...currentMap.keys()]
    .map((region) => {
      const current = currentMap.get(region)!;
      const prior = priorMap.get(region);
      const metrics = buildMetrics(current, prior);
      const yoy_summary = computeYoYTrend(metrics);
      return {
        region: formatPlaceName(region),
        quarter_end: qEnd,
        prior_year_quarter: priorY,
        row_count: current.row_count,
        metrics,
        yoy_trend: yoy_summary.trend,
        yoy_summary,
      };
    })
    .sort(
      (a, b) =>
        trendRank[a.yoy_trend] - trendRank[b.yoy_trend] || a.region.localeCompare(b.region)
    );

  const globalCurrent = sumTotals(currentMap.values());
  globalCurrent.gen = globalGenCur;
  const globalPrior = sumTotals(priorMap.values());
  globalPrior.gen = globalGenPrior;
  const global_metrics = buildMetrics(globalCurrent, globalPrior);
  const global_yoy_summary = computeYoYTrend(global_metrics);

  return {
    quarter_end: qEnd,
    prior_year_quarter: priorY,
    generated_at: new Date().toISOString(),
    global_metrics,
    global_yoy_trend: global_yoy_summary.trend,
    global_yoy_summary,
    regions,
  };
}

export function scorecardToCsv(report: ScorecardReport): string {
  const metricKeys = METRIC_DEFS.map((m) => m.key);
  const header = [
    "region",
    "quarter_end",
    "prior_year_quarter",
    "row_count",
    ...metricKeys.flatMap((k) => [`${k}_current`, `${k}_prior_year`, `${k}_change_pct`]),
    "yoy_trend",
    "metrics_up",
    "metrics_down",
  ];
  const lines = [header.join(",")];

  const rowFor = (
    region: string,
    rowCount: number,
    metrics: MetricYoY[],
    summary?: YoYTrendSummary
  ) => {
    const cells: (string | number)[] = [region, report.quarter_end, report.prior_year_quarter, rowCount];
    for (const key of metricKeys) {
      const m = metrics.find((x) => x.key === key)!;
      cells.push(m.current, m.prior_year, m.change_pct ?? "");
    }
    cells.push(summary?.trend ?? "", summary?.metrics_up ?? "", summary?.metrics_down ?? "");
    return cells.join(",");
  };

  lines.push(
    rowFor(
      "GLOBAL",
      report.regions.reduce((s, r) => s + r.row_count, 0),
      report.global_metrics,
      report.global_yoy_summary
    )
  );
  for (const r of report.regions) {
    lines.push(rowFor(r.region, r.row_count, r.metrics, r.yoy_summary));
  }
  return lines.join("\n");
}
