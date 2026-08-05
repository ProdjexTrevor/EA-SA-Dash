import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type RegionalComparisonResponse } from "../api";
import { formatPlaceName } from "../lib/formatPlaceName";
import { TrendLineChart, seriesForRegions } from "./TrendLineChart";

const METRICS = [
  { id: "new_disciples", label: "New disciples" },
  { id: "new_baptisms", label: "Baptisms" },
  { id: "dbs", label: "DBS" },
  { id: "total_churches", label: "Total churches" },
  { id: "com_churches", label: "Comm churches" },
  { id: "cat_churches", label: "CAT churches" },
  { id: "mbb_disciples", label: "MBB disciples" },
  { id: "mbb_churches", label: "MBB churches" },
] as const;

type Props = {
  dateFrom: string;
  dateTo: string;
  allRegions: string[];
};

export function RegionalComparePanel({ dateFrom, dateTo, allRegions }: Props) {
  const [metric, setMetric] = useState("new_disciples");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [data, setData] = useState<RegionalComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (allRegions.length) setSelected(new Set(allRegions));
  }, [allRegions]);

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo || selected.size === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.trendsCompareRegions({
        dateFrom,
        dateTo,
        metric,
        regions: [...selected],
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comparison");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, metric, selected]);

  useEffect(() => {
    if (dateFrom && dateTo && selected.size > 0) load();
  }, [load]);

  const chartSeries = useMemo(
    () => (data ? seriesForRegions(data.regions) : []),
    [data]
  );

  const toggleRegion = (r: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allRegions));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block text-slate-600 font-medium mb-1">Metric to compare</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 bg-white min-w-[12rem]"
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Update chart
        </button>
        <button type="button" onClick={selectAll} className="text-sm text-brand-700 hover:underline">
          Select all regions
        </button>
        <button type="button" onClick={selectNone} className="text-sm text-slate-500 hover:underline">
          Clear
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {allRegions.map((r) => (
          <label
            key={r}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs cursor-pointer transition ${
              selected.has(r)
                ? "border-brand-300 bg-brand-50 text-brand-900"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(r)}
              onChange={() => toggleRegion(r)}
              className="rounded border-slate-300 text-brand-600"
            />
            {formatPlaceName(r)}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading comparison…</p>}

      {!loading && data && data.points.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            {data.metric_label} by region
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Each line is a region total per quarter. {data.regions.length} region
            {data.regions.length === 1 ? "" : "s"} · {data.points.length} quarter
            {data.points.length === 1 ? "" : "s"}
          </p>
          <TrendLineChart data={data.points} series={chartSeries} height={360} />
        </div>
      )}

      {!loading && selected.size === 0 && (
        <p className="text-sm text-slate-500">Select at least one region to compare.</p>
      )}
    </div>
  );
}
