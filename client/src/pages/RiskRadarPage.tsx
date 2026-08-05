import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type RiskRadarResponse } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

export function RiskRadarPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [data, setData] = useState<RiskRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .analyticsQuarters()
      .then((q) => {
        const normalized = q.quarters
          .map((o) => ({ date: normalizeQuarterDate(o.date), row_count: o.row_count }))
          .filter((o) => o.date);
        setQuarters(normalized);
        setQuarter(normalizeQuarterDate(q.latest) || normalized[0]?.date || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    setLoading(true);
    api
      .analyticsRiskRadar(date, 30)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter]);

  const maxU = Math.max(1, ...(data?.rows.map((r) => r.urgency) ?? [1]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Risk radar"
          subtitle="Sites stacking score drop, baptism/leadership watch, class slip, or late reports."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            <StatCard label="Flagged" value={data.meta.total_flagged} />
            <StatCard label="Showing" value={data.rows.length} />
            <StatCard label="vs" value={formatQuarterLabel(data.prior_quarter || "") || "—"} />
          </div>
          <p className="mb-3 text-[11px] text-slate-500">{data.meta.note}</p>

          <div className="space-y-2">
            {data.rows.map((r) => (
              <div
                key={`${r.engagement_id}-${r.engagement_name}`}
                className="dash-panel-solid flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="text-lg font-bold tabular-nums text-red-700">{r.urgency}</p>
                  <p className="text-[10px] uppercase text-slate-500">urgency</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 h-1.5 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-gradient-to-r from-amber-500 to-red-600"
                      style={{ width: `${(100 * r.urgency) / maxU}%` }}
                    />
                  </div>
                  {r.engagement_id != null ? (
                    <Link
                      to={`/engagement/${r.engagement_id}?date=${data.quarter_end}`}
                      className="text-sm font-semibold text-slate-900 hover:text-teal-800"
                    >
                      {r.engagement_name}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">{r.engagement_name}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {r.country} · score {r.health_score}
                    {r.delta_score != null ? ` · Δ ${r.delta_score}` : ""} · {r.classification}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.flags.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-800"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                {r.engagement_id != null && (
                  <Link
                    to={`/war-room?id=${r.engagement_id}&date=${data.quarter_end}`}
                    className="shrink-0 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    War room →
                  </Link>
                )}
              </div>
            ))}
            {data.rows.length === 0 && (
              <p className="text-sm text-slate-600">No high-urgency sites this quarter.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
