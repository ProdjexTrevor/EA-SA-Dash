import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type MovementTrendPoint } from "../api";
import { formatPlaceName } from "../lib/formatPlaceName";
import { TrendLineChart } from "../components/TrendLineChart";
import { RegionalComparePanel } from "../components/RegionalComparePanel";
import { ErrorBlock, LoadingBlock, PageHeader } from "../components/Layout";

type ViewMode = "single" | "compare";

function toChartRows(points: MovementTrendPoint[]) {
  return points.map((p) => ({
    ...p,
    dbs: Number(p.dbs),
    com_churches: Number(p.com_churches),
    cat_churches: Number(p.cat_churches),
    total_churches: Number(p.total_churches),
    new_disciples: Number(p.new_disciples),
    new_baptisms: Number(p.new_baptisms),
    mbb_disciples: Number(p.mbb_disciples),
    mbb_churches: Number(p.mbb_churches),
    avg_gen: Number(p.avg_gen),
    row_count: Number(p.row_count),
  }));
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-visible">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function TrendsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [engagements, setEngagements] = useState<
    { engagement_id: number; name: string; region: string; country: string }[]
  >([]);
  const [points, setPoints] = useState<MovementTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("compare");

  const loadFilters = useCallback(async (from: string, to: string, reg?: string, ctry?: string) => {
    const f = await api.trendsFilters({
      dateFrom: from,
      dateTo: to,
      region: reg || undefined,
      country: ctry || undefined,
    });
    setRegions(f.regions);
    setCountries(f.countries);
    setEngagements(f.engagements);
  }, []);

  const loadTrends = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.trendsMovement({
        dateFrom,
        dateTo,
        region: region || undefined,
        country: country || undefined,
        engagementId: engagementId ? Number(engagementId) : undefined,
      });
      setPoints(res.points);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trends");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, region, country, engagementId]);

  useEffect(() => {
    api
      .trendsDefaultRange()
      .then(async (r) => {
        setDateFrom(r.dateFrom);
        setDateTo(r.dateTo);
        await loadFilters(r.dateFrom, r.dateTo);
        const res = await api.trendsMovement({ dateFrom: r.dateFrom, dateTo: r.dateTo });
        setPoints(res.points);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadFilters]);

  const chartData = useMemo(() => toChartRows(points), [points]);

  const scopeLabel = useMemo(() => {
    if (engagementId) {
      const e = engagements.find((x) => String(x.engagement_id) === engagementId);
      return e ? `Engagement: ${e.name}` : "Engagement";
    }
    if (country) return `Country: ${formatPlaceName(country)}`;
    if (region) return `Region: ${formatPlaceName(region)}`;
    return "Worldwide (all regions)";
  }, [region, country, engagementId, engagements]);

  const onRegionChange = async (val: string) => {
    setRegion(val);
    setCountry("");
    setEngagementId("");
    if (dateFrom && dateTo) await loadFilters(dateFrom, dateTo, val || undefined);
  };

  const onCountryChange = async (val: string) => {
    setCountry(val);
    setEngagementId("");
    if (dateFrom && dateTo) await loadFilters(dateFrom, dateTo, region || undefined, val || undefined);
  };

  const onApply = async () => {
    await loadFilters(dateFrom, dateTo, region || undefined, country || undefined);
    await loadTrends();
  };

  if (error && !points.length) return <ErrorBlock message={error} />;

  return (
    <>
      <PageHeader
        title="Trends over time"
        subtitle="Track one area over time, or compare regions on the same chart."
      />

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setView("compare")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            view === "compare"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Compare regions
        </button>
        <button
          type="button"
          onClick={() => setView("single")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            view === "single"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Single area detail
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-sm">
            <span className="block text-slate-600 font-medium mb-1">From (quarter-end)</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 font-medium mb-1">To (quarter-end)</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          {view === "single" && (
            <>
              <label className="text-sm">
                <span className="block text-slate-600 font-medium mb-1">Region</span>
                <select
                  value={region}
                  onChange={(e) => onRegionChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
                >
                  <option value="">All regions</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {formatPlaceName(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-slate-600 font-medium mb-1">Country</span>
                <select
                  value={country}
                  onChange={(e) => onCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
                >
                  <option value="">All countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {formatPlaceName(c)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        {view === "single" && (
          <>
            <label className="text-sm block">
              <span className="block text-slate-600 font-medium mb-1">Engagement</span>
              <select
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
              >
                <option value="">All engagements in scope</option>
                {engagements.map((e) => (
                  <option key={e.engagement_id} value={e.engagement_id}>
                    {formatPlaceName(e.name)} ({formatPlaceName(e.country)})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onApply}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Apply filters
              </button>
              <p className="text-sm text-slate-600">
                Showing: <strong>{scopeLabel}</strong>
                {chartData.length > 0 && (
                  <span className="text-slate-400">
                    {" "}
                    · {chartData.length} quarter{chartData.length === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </div>
          </>
        )}
        {view === "compare" && dateFrom && dateTo && (
          <p className="text-sm text-slate-600">
            Date range above applies to the regional comparison chart.
          </p>
        )}
      </div>

      {view === "compare" && dateFrom && dateTo && (
        <RegionalComparePanel dateFrom={dateFrom} dateTo={dateTo} allRegions={regions} />
      )}

      {view === "single" && loading && <LoadingBlock />}
      {view === "single" && error && points.length > 0 && (
        <p className="text-amber-700 text-sm mb-4">Partial load: {error}</p>
      )}

      {view === "single" && !loading && chartData.length === 0 && (
        <p className="text-slate-500 text-sm">No data for this range and filter. Try widening the dates.</p>
      )}

      {view === "single" && !loading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartPanel title="New disciples & baptisms">
            <TrendLineChart
              data={chartData}
              series={[
                { key: "new_disciples", name: "New disciples", color: "#16a34a" },
                { key: "new_baptisms", name: "Baptisms", color: "#2563eb" },
              ]}
            />
          </ChartPanel>
          <ChartPanel title="DBS & total churches">
            <TrendLineChart
              data={chartData}
              series={[
                { key: "dbs", name: "DBS", color: "#d97706" },
                { key: "total_churches", name: "Total churches", color: "#7c3aed" },
              ]}
            />
          </ChartPanel>
          <ChartPanel title="Comm & CAT churches">
            <TrendLineChart
              data={chartData}
              series={[
                { key: "com_churches", name: "Comm churches", color: "#0891b2" },
                { key: "cat_churches", name: "CAT churches", color: "#4f46e5" },
              ]}
            />
          </ChartPanel>
          <ChartPanel title="MBB disciples & MBB churches">
            <TrendLineChart
              data={chartData}
              series={[
                { key: "mbb_disciples", name: "MBB disciples", color: "#e11d48" },
                { key: "mbb_churches", name: "MBB churches", color: "#c026d3" },
              ]}
            />
          </ChartPanel>
          <ChartPanel title="Average GEN">
            <TrendLineChart
              data={chartData}
              series={[{ key: "avg_gen", name: "Avg GEN", color: "#475569" }]}
            />
          </ChartPanel>
          <ChartPanel title="Reporting lines (row count)">
            <TrendLineChart
              data={chartData}
              series={[{ key: "row_count", name: "Lines reported", color: "#64748b" }]}
            />
          </ChartPanel>
        </div>
      )}
    </>
  );
}
