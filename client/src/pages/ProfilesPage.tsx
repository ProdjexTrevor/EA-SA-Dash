import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ProfilesListResponse } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
} from "../components/Layout";
import { normalizeQuarterDate } from "../lib/quarters";

export function ProfilesPage() {
  const navigate = useNavigate();
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<ProfilesListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

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
      .analyticsProfiles({ date, search: debounced || undefined })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter, debounced]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Profiles"
          subtitle="Open a site for history, path-to-next, story, and demo lineage."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search engagement, country, people group…"
          className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && (
        <section className="dash-panel-solid overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            {data.total} engagement{data.total === 1 ? "" : "s"} ·{" "}
            {normalizeQuarterDate(data.quarter_end)}
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Engagement</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const path =
                    r.engagement_id != null
                      ? `/engagement/${r.engagement_id}?date=${quarter}`
                      : `/engagement/name?date=${quarter}&name=${encodeURIComponent(r.engagement_name)}`;
                  return (
                    <tr
                      key={`${r.engagement_id}-${r.engagement_name}`}
                      className="cursor-pointer border-t border-slate-100 hover:bg-teal-50/40"
                      onClick={() => navigate(path)}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{r.engagement_name}</span>
                        <p className="text-slate-500">{r.country}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.region}</td>
                      <td className="px-3 py-2 tabular-nums font-semibold">{r.health_score}</td>
                      <td className="px-3 py-2 text-slate-700">{r.classification}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={path}
                          className="font-medium text-teal-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
