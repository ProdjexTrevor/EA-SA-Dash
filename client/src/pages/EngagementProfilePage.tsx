import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { api, type EngagementProfileResponse, type GenNode } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

export function EngagementProfilePage() {
  const { engagementId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const nameParam = searchParams.get("name") || undefined;
  const dateParam = searchParams.get("date") || "";

  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState(dateParam);
  const [data, setData] = useState<EngagementProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eid =
    engagementId && engagementId !== "name" && !Number.isNaN(Number(engagementId))
      ? Number(engagementId)
      : undefined;

  useEffect(() => {
    api
      .analyticsQuarters()
      .then((q) => {
        const normalized = q.quarters
          .map((o) => ({ date: normalizeQuarterDate(o.date), row_count: o.row_count }))
          .filter((o) => o.date);
        setQuarters(normalized);
        if (!quarter) {
          setQuarter(normalizeQuarterDate(dateParam) || normalizeQuarterDate(q.latest) || normalized[0]?.date || "");
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("date", date);
        if (nameParam) n.set("name", nameParam);
        return n;
      },
      { replace: true }
    );
    setLoading(true);
    setError(null);
    api
      .analyticsEngagementProfile({
        date,
        engagement_id: eid,
        name: eid == null ? nameParam : undefined,
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter, eid, nameParam, setSearchParams]);

  const a = data?.assessment;
  const chartData = useMemo(
    () =>
      (data?.history ?? []).map((h) => ({
        label: formatQuarterLabel(h.quarter_end).replace("Q", "Q"),
        disciples: h.new_disciples ?? 0,
        baptisms: h.new_baptisms ?? 0,
        churches: h.total_church ?? 0,
      })),
    [data]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="mb-1 text-xs">
            <Link to="/profiles" className="text-teal-700 hover:underline">
              ← Profiles
            </Link>
          </p>
          <PageHeader
            title={a?.engagement_name || nameParam || "Engagement"}
            subtitle={
              a
                ? `${a.country || "—"} · ${a.region || "—"} · ${a.classification}`
                : "Site profile for client walkthroughs"
            }
          />
        </div>
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && !a && !loading && (
        <p className="text-sm text-slate-600">No assessment found for this engagement / quarter.</p>
      )}

      {a && data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Health" value={a.health_score} tone="good" />
            <StatCard label="Classification" value={a.classification} />
            <StatCard label="Baptism band" value={a.baptism_simple_band.replace(/_/g, " ")} />
            <StatCard
              label="Leadership band"
              value={a.leadership_simple_band.replace(/_/g, " ")}
            />
          </div>

          <p className="mb-4 text-sm leading-relaxed text-slate-700">{a.summary}</p>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section className="dash-panel-solid p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Path to next level</h2>
              {data.path_to_next ? (
                <>
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{data.path_to_next.current}</span>
                    {" → "}
                    <span className="font-semibold text-teal-800">
                      {data.path_to_next.next ?? "At top band"}
                    </span>
                  </p>
                  {data.path_to_next.blockers.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Blockers
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                        {data.path_to_next.blockers.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {data.path_to_next.actions.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recommended
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                        {data.path_to_next.actions.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">No path data</p>
              )}
            </section>

            <section className="dash-panel-solid p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Story</h2>
              {data.narrative ? (
                <div className="space-y-2 text-xs leading-snug text-slate-700">
                  <p>
                    <span className="font-semibold text-emerald-800">Highlight. </span>
                    {data.narrative.highlight}
                  </p>
                  <p>
                    <span className="font-semibold text-amber-800">Challenge. </span>
                    {data.narrative.challenge}
                  </p>
                  <p>
                    <span className="font-semibold text-sky-800">Prayer. </span>
                    {data.narrative.prayer}
                  </p>
                  {data.narrative.is_demo_seed && (
                    <p className="text-[10px] text-slate-400">Demo narrative overlay</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No seeded story for this site.{" "}
                  <Link to="/stories" className="text-teal-700 hover:underline">
                    Browse demo stories
                  </Link>
                </p>
              )}
              {data.geo && (
                <p className="mt-3 text-[11px] text-slate-500">
                  Map: {data.geo.latitude.toFixed(2)}, {data.geo.longitude.toFixed(2)}
                  {data.geo.locality ? ` · ${data.geo.locality}` : ""}
                  {data.geo.pop_density_per_km2 != null
                    ? ` · ${Math.round(data.geo.pop_density_per_km2)}/km²`
                    : ""}
                  {" · "}
                  <Link to="/health-map" className="text-teal-700 hover:underline">
                    Health Map
                  </Link>
                </p>
              )}
            </section>
          </div>

          <section className="dash-panel-solid mb-4 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">History</h2>
            {chartData.length > 1 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="disciples" stroke="#0f766e" strokeWidth={2} dot={false} name="New disciples" />
                    <Line type="monotone" dataKey="baptisms" stroke="#0369a1" strokeWidth={2} dot={false} name="Baptisms" />
                    <Line type="monotone" dataKey="churches" stroke="#b45309" strokeWidth={2} dot={false} name="Churches" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Not enough history points</p>
            )}
          </section>

          <section className="dash-panel-solid p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Generation tree
              {data.demo_lineage.enabled && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                  Demo lineage
                </span>
              )}
            </h2>
            <p className="mb-3 text-[11px] text-slate-500">{data.demo_lineage.note}</p>
            {data.demo_lineage.tree ? (
              <GenTree node={data.demo_lineage.tree} />
            ) : (
              <p className="text-xs text-slate-500">No demo tree attached for this profile.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function GenTree({ node, depth = 0 }: { node: GenNode; depth?: number }) {
  return (
    <div className={depth === 0 ? "" : "ml-4 border-l border-slate-200 pl-3"}>
      <div className="mb-1 flex flex-wrap items-baseline gap-2 py-0.5">
        <span className="text-xs font-semibold text-slate-900">{node.name}</span>
        <span className="text-[11px] text-slate-500">{node.role}</span>
        <span className="rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-600">
          G{node.generation}
        </span>
      </div>
      {node.children?.map((c) => (
        <GenTree key={`${c.name}-${c.generation}`} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
