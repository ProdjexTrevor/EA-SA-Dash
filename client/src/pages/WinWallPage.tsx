import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type WinWallResponse } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

export function WinWallPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [data, setData] = useState<WinWallResponse | null>(null);
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
      .analyticsWinWall(date, 10)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Win wall"
          subtitle="Biggest positive health-score moves this quarter — open meetings on a high note."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && (
        <>
          <p className="mb-4 text-xs text-slate-500">
            vs {formatQuarterLabel(data.prior_quarter || "")} · {data.meta.count} wins
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.wins.map((w, i) => (
              <article
                key={`${w.engagement_id}-${w.engagement_name}`}
                className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-dash"
              >
                <span className="absolute right-3 top-3 text-2xl font-bold tabular-nums text-emerald-200">
                  #{i + 1}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  +{w.delta_score} points
                </p>
                <h2 className="mt-1 pr-10 text-base font-bold text-slate-900">
                  {w.engagement_id != null ? (
                    <Link
                      to={`/engagement/${w.engagement_id}?date=${data.quarter_end}`}
                      className="hover:text-teal-800"
                    >
                      {w.engagement_name}
                    </Link>
                  ) : (
                    w.engagement_name
                  )}
                </h2>
                <p className="text-xs text-slate-600">
                  {w.country} · {w.region}
                </p>
                <p className="mt-3 text-sm font-medium text-slate-800">{w.headline}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {w.prior_score ?? "—"} → <span className="font-bold text-emerald-800">{w.health_score}</span>
                  {" · "}
                  {w.classification}
                </p>
                {w.story_snippet && (
                  <p className="mt-3 border-t border-emerald-100 pt-3 text-xs leading-snug text-slate-600">
                    {w.story_snippet}
                  </p>
                )}
              </article>
            ))}
            {data.wins.length === 0 && (
              <p className="text-sm text-slate-600">No positive movers this quarter.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
