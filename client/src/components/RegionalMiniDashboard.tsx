import type { MetricYoY, RegionalDashboard, YoYTrend, YoYTrendSummary } from "../api";
import { formatQuarterLabel } from "../lib/quarters";

const ALL_METRIC_KEYS = [
  "new_disciples",
  "new_baptisms",
  "total_churches",
  "dbs",
  "mbb_disciples",
  "mbb_churches",
  "leaders_in_training",
  "gen",
];

const GLOBAL_METRIC_KEYS = [
  "new_disciples",
  "new_baptisms",
  "total_churches",
  "dbs",
  "mbb_disciples",
  "leaders_in_training",
];

function fmt(n: number, metricKey?: string): string {
  if (metricKey === "gen") {
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function shortLabel(metric: MetricYoY): string {
  const map: Record<string, string> = {
    dbs: "DBS groups",
    leaders_in_training: "Leaders in training",
    gen: "GEN (average)",
    mbb_disciples: "MBB disciples",
    mbb_churches: "MBB churches",
    total_churches: "Churches",
    new_disciples: "New disciples",
    new_baptisms: "Baptisms",
  };
  return map[metric.key] ?? metric.label;
}

function changeTone(pct: number | null, abs: number): "up" | "down" | "flat" {
  if (pct == null) return abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  if (pct > 0) return "up";
  if (pct < 0) return "down";
  return "flat";
}

const TREND_STYLES: Record<
  YoYTrend,
  { border: string; badge: string; label: string; icon: string }
> = {
  positive: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    label: "Trending up",
    icon: "↑",
  },
  negative: {
    border: "border-l-red-500",
    badge: "bg-red-50 text-red-800 border-red-200",
    label: "Trending down",
    icon: "↓",
  },
  mixed: {
    border: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
    label: "Mixed",
    icon: "↔",
  },
};

export function YoYTrendBadge({ summary }: { summary: YoYTrendSummary }) {
  const style = TREND_STYLES[summary.trend];
  const total = summary.metrics_up + summary.metrics_down + summary.metrics_flat;
  const sub =
    summary.trend === "mixed"
      ? `${summary.metrics_up} up, ${summary.metrics_down} down`
      : `${summary.metrics_up} of ${total} metrics up`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}
      title={`Year over year across ${total} metrics: ${summary.metrics_up} up, ${summary.metrics_down} down, ${summary.metrics_flat} unchanged`}
    >
      <span aria-hidden>{style.icon}</span>
      {style.label}
      <span className="font-normal opacity-85">· {sub}</span>
    </span>
  );
}

function MetricBox({ metric, priorLabel }: { metric: MetricYoY; priorLabel: string }) {
  const tone = changeTone(metric.change_pct, metric.change_abs);
  const changeCls =
    tone === "up" ? "text-emerald-700" : tone === "down" ? "text-red-700" : "text-slate-600";

  return (
    <div className="flex min-h-[7.25rem] flex-col rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-3 shadow-dash-sm">
      <p className="text-sm font-medium leading-snug text-slate-700">{shortLabel(metric)}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {fmt(metric.current, metric.key)}
      </p>
      <div className="mt-auto space-y-1 pt-3 text-sm">
        <div className="flex justify-between gap-2 text-slate-600">
          <span>{priorLabel}</span>
          <span className="font-medium tabular-nums text-slate-800">
            {fmt(metric.prior_year, metric.key)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">YoY</span>
          <span className={`font-semibold tabular-nums ${changeCls}`}>{fmtPct(metric.change_pct)}</span>
        </div>
      </div>
    </div>
  );
}

function MetricsBoxGrid({
  metrics,
  priorLabel,
  columns = "grid-cols-2 sm:grid-cols-4",
}: {
  metrics: MetricYoY[];
  priorLabel: string;
  columns?: string;
}) {
  return (
    <div className={`grid ${columns} gap-3`}>
      {metrics.map((m) => (
        <MetricBox key={m.key} metric={m} priorLabel={priorLabel} />
      ))}
    </div>
  );
}

export function RegionalMiniDashboard({ card }: { card: RegionalDashboard }) {
  const byKey = new Map(card.metrics.map((m) => [m.key, m]));
  const metrics = ALL_METRIC_KEYS.map((k) => byKey.get(k)).filter((m): m is MetricYoY => !!m);
  const priorLabel = formatQuarterLabel(card.prior_year_quarter);
  const trendStyle = TREND_STYLES[card.yoy_trend];

  return (
    <article
      className={`dash-panel-solid overflow-hidden border-l-4 ${trendStyle.border} transition duration-300 hover:-translate-y-0.5 hover:shadow-dash-lg`}
    >
      <header className="border-b border-slate-100/90 bg-gradient-to-r from-slate-50/80 to-transparent px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{card.region}</h3>
          <YoYTrendBadge summary={card.yoy_summary} />
        </div>
        <p className="mt-1.5 text-sm text-slate-600">
          {formatQuarterLabel(card.quarter_end)} vs {priorLabel} · {card.row_count} engagements
        </p>
      </header>

      <div className="p-4">
        <MetricsBoxGrid metrics={metrics} priorLabel={priorLabel} />
      </div>
    </article>
  );
}

export function GlobalYoYSummary({
  metrics,
  priorYearQuarter,
  summary,
}: {
  metrics: MetricYoY[];
  priorYearQuarter: string;
  summary: YoYTrendSummary;
}) {
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const shown = GLOBAL_METRIC_KEYS.map((k) => byKey.get(k)).filter((m): m is MetricYoY => !!m);
  const priorLabel = formatQuarterLabel(priorYearQuarter);
  const trendStyle = TREND_STYLES[summary.trend];

  return (
    <div
      className={`dash-panel-solid overflow-hidden border-l-4 ${trendStyle.border}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100/90 bg-gradient-to-r from-slate-50/80 to-transparent px-4 py-2.5">
        <span className="text-sm font-medium text-slate-700">
          Overall year-over-year
        </span>
        <YoYTrendBadge summary={summary} />
      </div>
      <div className="p-4">
        <MetricsBoxGrid
          metrics={shown}
          priorLabel={priorLabel}
          columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        />
      </div>
    </div>
  );
}
