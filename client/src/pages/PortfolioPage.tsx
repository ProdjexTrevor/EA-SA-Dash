import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PortfolioResponse } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

export function PortfolioPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [data, setData] = useState<PortfolioResponse | null>(null);
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
    setError(null);
    api
      .analyticsPortfolio(date)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter]);

  const maxFunnel = Math.max(1, ...(data?.funnel.map((f) => f.count) ?? [1]));
  const reportRate =
    data?.freshness.reporting_rate != null
      ? `${data.freshness.reporting_rate}%`
      : data?.freshness.expected
        ? `${data.freshness.reporting}/${data.freshness.expected}`
        : "—";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Portfolio"
          subtitle="Executive snapshot of health, movement stages, movers, and reporting."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatCard label="Engagements" value={data.headline.engagements} />
            <StatCard
              label="Avg health"
              value={data.headline.avg_health_score}
              tone="good"
            />
            <StatCard label="Baptism watch" value={data.headline.baptism_needs_attention} />
            <StatCard label="Leadership watch" value={data.headline.leadership_needs_attention} />
            <StatCard label="Reporting" value={reportRate} />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section className="dash-panel-solid p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Pipeline</h2>
              <ul className="space-y-2">
                {data.funnel.map((f) => (
                  <li key={f.classification}>
                    <div className="mb-0.5 flex justify-between text-xs text-slate-700">
                      <span>{f.classification}</span>
                      <span className="tabular-nums font-semibold">{f.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-full rounded bg-teal-600/80"
                        style={{ width: `${(100 * f.count) / maxFunnel}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="dash-panel-solid p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Regions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Region</th>
                      <th className="py-1 pr-2 font-medium">n</th>
                      <th className="py-1 pr-2 font-medium">Avg</th>
                      <th className="py-1 pr-2 font-medium">Unhealthy</th>
                      <th className="py-1 font-medium">Fruitful+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.regions.map((r) => (
                      <tr key={r.region} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 font-medium text-slate-800">{r.region}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{r.engagements}</td>
                        <td className="py-1.5 pr-2 tabular-nums font-semibold text-teal-800">
                          {r.avg_health_score}
                        </td>
                        <td className="py-1.5 pr-2 tabular-nums text-red-700">{r.unhealthy}</td>
                        <td className="py-1.5 tabular-nums text-emerald-800">{r.fruitful_plus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <MoverPreview
              title="Top gains"
              tone="up"
              rows={data.top_gains}
              quarter={data.quarter_end}
            />
            <MoverPreview
              title="Top risks"
              tone="down"
              rows={data.top_risks}
              quarter={data.quarter_end}
            />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section className="dash-panel-solid p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Data freshness</h2>
                <Link to="/share" className="text-xs font-medium text-teal-700 hover:underline">
                  Share brief →
                </Link>
              </div>
              <p className="text-sm text-slate-700">
                {data.freshness.reporting} reporting
                {data.freshness.expected ? ` of ${data.freshness.expected}` : ""} ·{" "}
                <span className="font-semibold text-amber-800">
                  {data.freshness.not_reporting} late / missing
                </span>
              </p>
              {data.freshness.late_examples.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                  {data.freshness.late_examples.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-slate-500">
                Prior quarter for movers: {formatQuarterLabel(data.prior_quarter || "")}
              </p>
            </section>

            <section className="dash-panel-solid p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Story flashes</h2>
                <Link to="/stories" className="text-xs font-medium text-teal-700 hover:underline">
                  All stories →
                </Link>
              </div>
              <ul className="space-y-3">
                {data.stories_preview.map((s) => (
                  <li key={s.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <p className="text-xs font-semibold text-slate-900">
                      {s.label}{" "}
                      <span className="font-normal text-slate-500">
                        · {s.region}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-600">{s.highlight}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="text-[11px] text-slate-500">
            Links:{" "}
            <Link className="text-teal-700 hover:underline" to="/movers">
              Movers
            </Link>
            {" · "}
            <Link className="text-teal-700 hover:underline" to="/profiles">
              Profiles
            </Link>
            {" · "}
            <Link className="text-teal-700 hover:underline" to="/health-map">
              Health Map
            </Link>
            {" · "}
            <Link className="text-teal-700 hover:underline" to="/health-check">
              Health Check
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function MoverPreview({
  title,
  rows,
  tone,
  quarter,
}: {
  title: string;
  rows: PortfolioResponse["top_gains"];
  tone: "up" | "down";
  quarter: string;
}) {
  return (
    <section className="dash-panel-solid p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <Link to="/movers" className="text-xs font-medium text-teal-700 hover:underline">
          Full board →
        </Link>
      </div>
      <ul className="space-y-2">
        {rows.length === 0 && <li className="text-xs text-slate-500">No comparable sites</li>}
        {rows.map((m) => (
          <li key={`${m.engagement_id}-${m.engagement_name}`} className="flex justify-between gap-2 text-xs">
            <div className="min-w-0">
              {m.engagement_id != null ? (
                <Link
                  to={`/engagement/${m.engagement_id}?date=${quarter}`}
                  className="font-medium text-slate-900 hover:text-teal-800"
                >
                  {m.engagement_name}
                </Link>
              ) : (
                <span className="font-medium text-slate-900">{m.engagement_name}</span>
              )}
              <p className="truncate text-slate-500">
                {m.country} · {m.classification}
              </p>
            </div>
            <span
              className={`shrink-0 tabular-nums font-semibold ${
                tone === "up" ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {m.delta_score != null && m.delta_score > 0 ? "+" : ""}
              {m.delta_score} → {m.health_score}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
