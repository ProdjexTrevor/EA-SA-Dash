import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type MoverRow, type MoversResponse } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

export function MoversPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [data, setData] = useState<MoversResponse | null>(null);
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
      .analyticsMovers(date, 20)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Movers"
          subtitle="Largest quarter-over-quarter health score gains and drops."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Compared" value={data.compared} />
            <StatCard label="Flat" value={data.flat_count} />
            <StatCard label="New this Q" value={data.new_count} />
            <StatCard
              label="vs"
              value={formatQuarterLabel(data.prior_quarter || "") || "—"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Board title="Biggest gains" rows={data.gains} quarter={data.quarter_end} tone="up" />
            <Board title="Biggest risks" rows={data.risks} quarter={data.quarter_end} tone="down" />
          </div>
        </>
      )}
    </div>
  );
}

function Board({
  title,
  rows,
  quarter,
  tone,
}: {
  title: string;
  rows: MoverRow[];
  quarter: string;
  tone: "up" | "down";
}) {
  return (
    <section className="dash-panel-solid overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Engagement</th>
              <th className="px-3 py-2 font-medium">Prior</th>
              <th className="px-3 py-2 font-medium">Δ</th>
              <th className="px-3 py-2 font-medium">Now</th>
              <th className="px-3 py-2 font-medium">Class</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={`${m.engagement_id}-${m.engagement_name}`} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {m.engagement_id != null ? (
                    <Link
                      to={`/engagement/${m.engagement_id}?date=${quarter}`}
                      className="font-medium text-slate-900 hover:text-teal-800"
                    >
                      {m.engagement_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{m.engagement_name}</span>
                  )}
                  <p className="text-slate-500">
                    {m.country} · {m.region}
                  </p>
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-600">
                  {m.prior_score ?? "—"}
                </td>
                <td
                  className={`px-3 py-2 tabular-nums font-semibold ${
                    tone === "up" ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {m.delta_score != null && m.delta_score > 0 ? "+" : ""}
                  {m.delta_score ?? "—"}
                </td>
                <td className="px-3 py-2 tabular-nums font-semibold">{m.health_score}</td>
                <td className="px-3 py-2">
                  <span className="text-slate-800">{m.classification}</span>
                  {m.classification_changed && m.prior_classification && (
                    <p className="text-[10px] text-amber-700">was {m.prior_classification}</p>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No movers this quarter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
