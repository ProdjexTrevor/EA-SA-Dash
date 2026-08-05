import { Button, TabItem, Tabs } from "flowbite-react";
import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type MissingDataReport,
  type EngagementReportingSummary,
  type NotReportingEngagement,
  type RollupRow,
  type TopPerformerRow,
} from "../api";
import { EngagementHealthTab } from "../components/EngagementHealthTab";
import { formatPlaceName } from "../lib/formatPlaceName";
import { AreaSummaryCards } from "../components/AreaSummaryCards";
import { SortableTable } from "../components/SortableTable";
import { ReportHelp } from "../components/ReportHelp";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

type DrillLevel = "global" | "region" | "country" | "engagement";
type AreaView = "cards" | "table";

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function fmtPctCell(n: number | null | undefined) {
  if (n == null) return <span className="text-slate-400">—</span>;
  const cls = n > 0 ? "text-emerald-700 font-medium" : n < 0 ? "text-red-700 font-medium" : "text-slate-600";
  return <span className={cls}>{fmtPct(n)}</span>;
}

function fmtRatio(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(2);
}

const HIGHLIGHT_METRICS = [
  { id: "new_disciples", label: "New disciples" },
  { id: "new_baptisms", label: "Baptisms" },
  { id: "total_churches", label: "Churches" },
  { id: "dbs", label: "Discovery groups (DBS)" },
  { id: "mbb_disciples", label: "MBB disciples" },
  { id: "leaders_in_training", label: "Leaders in training" },
];

const levelLabel: Record<DrillLevel, string> = {
  global: "Worldwide",
  region: "Regions",
  country: "Countries",
  engagement: "Engagements",
};

export function ManagementPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [level, setLevel] = useState<DrillLevel>("region");
  const [region, setRegion] = useState<string | undefined>();
  const [country, setCountry] = useState<string | undefined>();
  const [rollup, setRollup] = useState<RollupRow[]>([]);
  const [missing, setMissing] = useState<MissingDataReport[]>([]);
  const [top, setTop] = useState<TopPerformerRow[]>([]);
  const [topMetric, setTopMetric] = useState("new_disciples");
  const [notReporting, setNotReporting] = useState<NotReportingEngagement[]>([]);
  const [reportingSummary, setReportingSummary] = useState<EngagementReportingSummary | null>(null);
  const [notReportingSearch, setNotReportingSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalKpi, setGlobalKpi] = useState<RollupRow | null>(null);
  const [showMoreColumns, setShowMoreColumns] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [areaView, setAreaView] = useState<AreaView>("cards");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.analyticsQuarters().then((q) => {
      const normalized = q.quarters
        .map((o) => ({ date: normalizeQuarterDate(o.date), row_count: o.row_count }))
        .filter((o) => o.date);
      setQuarters(normalized);
      const latest = normalizeQuarterDate(q.latest) || normalized[0]?.date || "";
      setQuarter(latest);
    }).catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    const date = normalizeQuarterDate(quarter);
    if (!date) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const missingGroup =
        level === "engagement" ? "country" : level === "global" ? "global" : level;
      const [r, g, m, notReportingRes] = await Promise.all([
        api.analyticsRollup({ date, level, region, country }),
        api.analyticsRollup({ date, level: "global" }),
        api.analyticsMissing({ date, groupBy: missingGroup }),
        api.analyticsNotReporting(date),
      ]);
      setRollup(r.rows);
      setGlobalKpi(g.rows[0] ?? null);
      setMissing(m.reports);
      setNotReporting(notReportingRes.rows);
      setReportingSummary(notReportingRes.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [quarter, level, region, country]);

  const loadTop = useCallback(async () => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    setTopLoading(true);
    try {
      const t = await api.analyticsTop({ date, metric: topMetric });
      setTop(t.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load highlights");
    } finally {
      setTopLoading(false);
    }
  }, [quarter, topMetric]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTop();
  }, [loadTop]);

  useEffect(() => {
    setSearch("");
    if (level === "engagement") setAreaView("table");
  }, [level, region, country]);

  const drillTo = useCallback((next: DrillLevel, r?: string, c?: string) => {
    setLevel(next);
    setRegion(r);
    setCountry(c);
  }, []);

  const goBack = useCallback(() => {
    if (level === "engagement" && region) drillTo("country", region);
    else if (level === "country") drillTo("region");
  }, [level, region, drillTo]);

  const onRowClick = useCallback(
    (row: RollupRow) => {
      if (level === "region") drillTo("country", row.key);
      else if (level === "country" && region) drillTo("engagement", region, row.key);
    },
    [level, region, drillTo]
  );

  const kpi = globalKpi;
  const quarterLabel = quarter ? formatQuarterLabel(quarter) : "";

  const filteredRollup = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rollup;
    return rollup.filter((r) => r.label.toLowerCase().includes(q));
  }, [rollup, search]);

  const canDrill = level !== "engagement";
  const showCards = areaView === "cards" && (level === "region" || level === "country");

  const nameHeader =
    level === "engagement" ? "Engagement" : level === "country" ? "Country" : "Region";

  const essentialColumns = useMemo((): ColumnDef<RollupRow>[] => {
    return [
      {
        id: "label",
        accessorKey: "label",
        header: nameHeader,
        cell: ({ row }) => (
          <span className={canDrill ? "text-brand-800" : ""}>{row.original.label}</span>
        ),
      },
      {
        accessorKey: "new_disciples",
        header: "New disciples",
        cell: ({ getValue }) => fmt(getValue() as number),
      },
      {
        accessorKey: "new_baptisms",
        header: "Baptisms",
        cell: ({ getValue }) => fmt(getValue() as number),
      },
      {
        accessorKey: "total_churches",
        header: "Churches",
        cell: ({ getValue }) => fmt(getValue() as number),
      },
      {
        accessorKey: "dbs",
        header: "DBS",
        cell: ({ getValue }) => fmt(getValue() as number),
      },
      {
        accessorKey: "mbb_disciples",
        header: "MBB disciples",
        cell: ({ getValue }) => fmt(getValue() as number),
      },
      {
        accessorKey: "pct_chg_disciples",
        header: "Vs last quarter",
        cell: ({ getValue }) => fmtPctCell(getValue() as number | null),
      },
    ];
  }, [nameHeader, canDrill]);

  const moreColumns = useMemo((): ColumnDef<RollupRow>[] => [
    {
      accessorKey: "leaders_in_training",
      header: "Leaders",
      cell: ({ getValue }) => fmt(getValue() as number),
    },
    { accessorKey: "com_churches", header: "Comm churches", cell: ({ getValue }) => fmt(getValue() as number) },
    { accessorKey: "cat_churches", header: "CAT churches", cell: ({ getValue }) => fmt(getValue() as number) },
    {
      accessorKey: "avg_church_size",
      header: "Avg church size",
      cell: ({ getValue }) => fmt(getValue() as number, 1),
    },
    {
      accessorKey: "population",
      header: "Population",
      cell: ({ getValue }) => fmt(getValue() as number | null),
    },
    { accessorKey: "mbb_churches", header: "MBB churches", cell: ({ getValue }) => fmt(getValue() as number) },
    { accessorKey: "max_gen", header: "GEN (max)", cell: ({ getValue }) => fmt(getValue() as number) },
    {
      accessorKey: "pct_chg_baptisms",
      header: "Baptisms Δ",
      cell: ({ getValue }) => fmtPctCell(getValue() as number | null),
    },
    {
      accessorKey: "pct_chg_churches",
      header: "Churches Δ",
      cell: ({ getValue }) => fmtPctCell(getValue() as number | null),
    },
  ], []);

  const advancedColumns = useMemo((): ColumnDef<RollupRow>[] => [
    {
      accessorKey: "disciples_per_church",
      header: "Disciples / church",
      cell: ({ getValue }) => fmtRatio(getValue() as number),
    },
    {
      accessorKey: "disciples_per_baptism",
      header: "Disciples / baptism",
      cell: ({ getValue }) => fmtRatio(getValue() as number),
    },
    {
      accessorKey: "baptisms_per_church",
      header: "Baptisms / church",
      cell: ({ getValue }) => fmtRatio(getValue() as number),
    },
    {
      accessorKey: "dbs_per_church",
      header: "DBS / church",
      cell: ({ getValue }) => fmtRatio(getValue() as number),
    },
    {
      accessorKey: "mbb_vs_pop_pct",
      header: "MBB reach %",
      cell: ({ getValue }) => fmtPct(getValue() as number),
    },
    {
      accessorKey: "market_share_pct",
      header: "New believers % pop.",
      cell: ({ getValue }) => fmtPct(getValue() as number),
    },
    {
      accessorKey: "r_number_avg",
      header: "Growth rate (R)",
      cell: ({ getValue }) => fmtRatio(getValue() as number),
    },
    { accessorKey: "crisis_engagements", header: "Hard-place flags", cell: ({ getValue }) => fmt(getValue() as number) },
  ], []);

  const rollupColumns = useMemo(
    () => [
      ...essentialColumns,
      ...(showMoreColumns ? moreColumns : []),
      ...(showAdvanced ? advancedColumns : []),
    ],
    [essentialColumns, moreColumns, advancedColumns, showMoreColumns, showAdvanced]
  );

  const topColumns = useMemo((): ColumnDef<TopPerformerRow>[] => {
    const metricHighlight =
      "bg-brand-50 font-semibold text-brand-900 tabular-nums";
    const numCell = (key: keyof TopPerformerRow, header: string): ColumnDef<TopPerformerRow> => ({
      accessorKey: key,
      header,
      meta: {
        align: "right" as const,
        nowrap: true,
        className: key === topMetric ? metricHighlight : "tabular-nums",
        headerClassName: key === topMetric ? "text-brand-800" : "",
      },
      cell: ({ getValue }) => fmt(getValue() as number),
    });

    return [
      {
        accessorKey: "region",
        header: "Region",
        meta: { minWidth: "9rem", className: "text-slate-600" },
      },
      {
        accessorKey: "country",
        header: "Country",
        meta: { minWidth: "8rem", className: "text-slate-600" },
      },
      {
        accessorKey: "people_group",
        header: "People group",
        meta: { minWidth: "9rem", className: "text-slate-600 max-w-[10rem] truncate" },
        cell: ({ getValue }) => (
          <span className="block max-w-[10rem] truncate" title={String(getValue() ?? "")}>
            {String(getValue() ?? "")}
          </span>
        ),
      },
      {
        accessorKey: "engagement_name",
        header: "Engagement",
        meta: { minWidth: "11rem", className: "font-medium text-slate-900" },
        cell: ({ row }) => (
          <span
            className="block max-w-[14rem] truncate"
            title={row.original.engagement_name ?? row.original.people_group}
          >
            {row.original.engagement_name ?? row.original.people_group}
          </span>
        ),
      },
      numCell("new_disciples", "New disciples"),
      numCell("new_baptisms", "Baptisms"),
      numCell("dbs", "DBS"),
      numCell("total_churches", "Churches"),
      numCell("mbb_disciples", "MBB disciples"),
      numCell("leaders_in_training", "Leaders"),
    ];
  }, [topMetric]);

  const filteredNotReporting = useMemo(() => {
    const q = notReportingSearch.trim().toLowerCase();
    if (!q) return notReporting;
    return notReporting.filter(
      (r) =>
        r.engagement_name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        String(r.engagement_id).includes(q)
    );
  }, [notReporting, notReportingSearch]);

  const notReportingColumns = useMemo((): ColumnDef<NotReportingEngagement>[] => [
    {
      accessorKey: "engagement_id",
      header: "ID",
      meta: { align: "right" },
      cell: ({ getValue }) => (
        <span className="text-slate-500 tabular-nums">{getValue() as number}</span>
      ),
    },
    { accessorKey: "region", header: "Region", meta: { align: "left" } },
    { accessorKey: "country", header: "Country", meta: { align: "left" } },
    {
      accessorKey: "engagement_name",
      header: "Engagement",
      meta: { align: "left" },
      cell: ({ row }) => (
        <span className="font-medium text-slate-900 block max-w-[16rem] truncate">
          {row.original.engagement_name}
        </span>
      ),
    },
    {
      accessorKey: "last_reported_quarter",
      header: "Last reported",
      meta: { align: "left" },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? formatQuarterLabel(v) : "—";
      },
    },
    {
      accessorKey: "quarters_not_reported",
      header: "Quarters missed",
      meta: { align: "right" },
      cell: ({ getValue }) => (
        <span className="font-semibold text-amber-800">{getValue() as number}</span>
      ),
    },
    {
      id: "missed",
      header: "Recent missed",
      meta: { align: "left" },
      cell: ({ row }) => {
        const { missed_quarter_labels: labels, quarters_not_reported: total } = row.original;
        if (total === 0) return "—";
        const recent = labels.slice(0, 3).map((q) => formatQuarterLabel(q)).join(", ");
        const extra = total - Math.min(labels.length, 3);
        const full =
          labels.map((q) => formatQuarterLabel(q)).join(", ") +
          (total > labels.length ? ` (+${total - labels.length} earlier)` : "");
        return (
          <span
            className="block max-w-[12rem] truncate text-xs text-slate-600"
            title={full || recent}
          >
            {recent || "—"}
            {extra > 0 ? ` (+${extra} more)` : ""}
          </span>
        );
      },
    },
  ], []);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4 print:block">
        <PageHeader
          title={`${quarterLabel} movement report`}
          subtitle="Worldwide and regional totals from quarterly field reports."
        />
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {quarters.length > 0 && (
            <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
          )}
          <Button color="light" size="sm" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="print:hidden">
        <ReportHelp />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Engagements reporting"
          value={fmt(reportingSummary?.reporting_this_quarter)}
          hint={
            reportingSummary
              ? `${fmt(reportingSummary.total_engagements)} in system · ${fmt(reportingSummary.not_reporting)} not reporting`
              : "Substantive report this quarter"
          }
        />
        <StatCard label="New disciples" value={fmt(kpi?.new_disciples)} hint="Worldwide this quarter" />
        <StatCard label="Baptisms" value={fmt(kpi?.new_baptisms)} />
        <StatCard label="Churches" value={fmt(kpi?.total_churches)} />
        <StatCard label="DBS groups" value={fmt(kpi?.dbs)} />
        <StatCard label="MBB disciples" value={fmt(kpi?.mbb_disciples)} hint="From MBB %" />
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !rollup.length && <LoadingBlock />}

      {quarter && !error && (
        <Tabs aria-label="Report sections" variant="underline">
          <TabItem active title="By area">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Report location">
                <button
                  type="button"
                  className={`font-medium ${level === "region" ? "text-slate-900" : "text-brand-700 hover:underline"}`}
                  onClick={() => drillTo("region")}
                >
                  All regions
                </button>
                {region && (
                  <>
                    <span className="text-slate-300">›</span>
                    <button
                      type="button"
                      className={`font-medium ${level === "country" ? "text-slate-900" : "text-brand-700 hover:underline"}`}
                      onClick={() => drillTo("country", region)}
                    >
                      {formatPlaceName(region)}
                    </button>
                  </>
                )}
                {country && (
                  <>
                    <span className="text-slate-300">›</span>
                    <span className="text-slate-900 font-medium">{formatPlaceName(country)}</span>
                  </>
                )}
              </nav>
              {level !== "region" && (
                <Button color="light" size="xs" onClick={goBack}>
                  ← Back
                </Button>
              )}
            </div>

            <p className="text-sm text-slate-600 mb-3">
              <strong>{levelLabel[level]}</strong> · {filteredRollup.length} shown
              {canDrill && " · Tap a row or card to drill down"}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
              {(level === "region" || level === "country") && (
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-sm">
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-md ${areaView === "cards" ? "bg-white shadow-sm font-medium" : "text-slate-600"}`}
                    onClick={() => setAreaView("cards")}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-md ${areaView === "table" ? "bg-white shadow-sm font-medium" : "text-slate-600"}`}
                    onClick={() => setAreaView("table")}
                  >
                    Table
                  </button>
                </div>
              )}
              {rollup.length > 6 && (
                <input
                  type="search"
                  placeholder={`Search ${nameHeader.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm min-w-[12rem] flex-1 max-w-xs"
                />
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showMoreColumns}
                  onChange={(e) => setShowMoreColumns(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600"
                />
                More columns
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showAdvanced}
                  onChange={(e) => setShowAdvanced(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600"
                />
                Ratios
              </label>
            </div>

            {showCards && (
              <AreaSummaryCards rows={filteredRollup} onSelect={onRowClick} />
            )}

            {(level === "engagement" || areaView === "table") && (
              <SortableTable
                data={filteredRollup}
                columns={rollupColumns}
                defaultSort={[{ id: "new_disciples", desc: true }]}
                dense
                stickyFirstColumn
                onRowClick={canDrill ? onRowClick : undefined}
                emptyMessage={search ? "No matches for your search." : "No rows for this view."}
              />
            )}

          </TabItem>

          <TabItem title={`Gaps${missing.length ? ` (${missing.length})` : ""}`}>
            <p className="text-sm text-slate-600 mb-4">
              Empty or missing fields for this quarter — check before you close reporting.
            </p>
            <div className="space-y-4">
              {missing.slice(0, 12).map((rep) => (
                <div key={rep.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-3">{rep.key}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {rep.fields.slice(0, 8).map((f) => (
                      <div key={f.field} className="text-sm">
                        <p className="text-slate-500">{f.label}</p>
                        <p
                          className={`font-semibold tabular-nums ${
                            f.missing_pct > 50 ? "text-amber-700" : "text-slate-800"
                          }`}
                        >
                          {f.missing_pct}% missing
                          <span className="block font-normal text-xs text-slate-400">
                            {f.missing_count} of {f.total_count} lines
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!missing.length && (
                <p className="text-sm text-slate-500">No gap summary for this view.</p>
              )}
            </div>
          </TabItem>

          <TabItem title="Highlights">
            <p className="text-sm text-slate-600 mb-4">Top engagements this quarter.</p>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 mb-4">
              Rank by
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 bg-white"
                value={topMetric}
                onChange={(e) => setTopMetric(e.target.value)}
              >
                {HIGHLIGHT_METRICS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {topLoading && <span className="text-slate-400 text-xs">Updating…</span>}
            </label>
            <SortableTable
              key={topMetric}
              data={top}
              columns={topColumns}
              defaultSort={[{ id: topMetric, desc: true }]}
              dense
              stickyFirstColumn
              stickyColumnIndex={3}
              tableLayout="fixed"
            />
          </TabItem>

          <TabItem title="Engagement health">
            <EngagementHealthTab quarter={quarter} quarterLabel={quarterLabel} />
          </TabItem>

          <TabItem
            title={
              notReporting.length
                ? `Needs attention (${notReporting.length})`
                : "Needs attention"
            }
          >
            <p className="text-sm text-slate-600 mb-4">
              Engagements with <strong>no substantive report for {quarterLabel}</strong> (no
              disciples, baptisms, churches, or DBS on that quarter-end). “Quarters missed” counts
              every standard quarter after their last real report through {quarterLabel} — including
              gaps where only empty rows exist.
            </p>
            {notReporting.length > 0 && (
              <input
                type="search"
                placeholder="Search by name, region, country, or ID…"
                value={notReportingSearch}
                onChange={(e) => setNotReportingSearch(e.target.value)}
                className="mb-4 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            )}
            {notReporting.length > 0 ? (
              <>
                {notReportingSearch.trim() && (
                  <p className="text-xs text-slate-500 mb-2">
                    {filteredNotReporting.length} match
                    {filteredNotReporting.length === 1 ? "" : "es"} (of {notReporting.length})
                  </p>
                )}
                <SortableTable
                  data={filteredNotReporting}
                  columns={notReportingColumns}
                  defaultSort={[{ id: "quarters_not_reported", desc: true }]}
                  dense
                  stickyFirstColumn
                  pageSize={25}
                  pageSizeOptions={[25, 50, 100]}
                  emptyMessage="No matches for your search."
                />
              </>
            ) : (
              <p className="text-slate-500 text-sm">
                Every engagement in the system has a row for {quarterLabel}.
              </p>
            )}
          </TabItem>
        </Tabs>
      )}
    </div>
  );
}
