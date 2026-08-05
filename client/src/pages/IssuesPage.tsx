import { useEffect, useState } from "react";
import { api, type HealthIssue } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  SeverityBadge,
} from "../components/Layout";

export function IssuesPage() {
  const [quarter, setQuarter] = useState("");
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [rows, setRows] = useState<HealthIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.quarters(), api.issueLabels()]).then(([q, lbl]) => {
      setQuarters(q.quarters);
      setQuarter(q.latest ?? q.quarters[0]?.date ?? "");
      setLabels(lbl);
    });
  }, []);

  useEffect(() => {
    if (!quarter) return;
    setLoading(true);
    api
      .issues({ date: quarter, severity, search: search || undefined, page })
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quarter, severity, search, page]);

  if (error) return <ErrorBlock message={error} />;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Issues"
          subtitle="Rows that failed one or more health checks. Use this list to route fixes to field teams."
        />
        {quarters.length > 0 && <QuarterSelect value={quarter} options={quarters} onChange={(d) => { setQuarter(d); setPage(1); }} />}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical only</option>
          <option value="warning">Warnings only</option>
        </select>
        <input
          type="search"
          placeholder="Search country, people group, engagement…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <span className="self-center text-sm text-slate-500">{total.toLocaleString()} issues</span>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Region / Country</th>
                <th className="px-4 py-3">People group</th>
                <th className="px-4 py-3">Issues</th>
                <th className="px-4 py-3 text-right">Disciples</th>
                <th className="px-4 py-3 text-right">Churches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.ng_key} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.country}</div>
                    <div className="text-xs text-slate-500">{r.region}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.people_group}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">{r.engagement_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {r.issue_codes.split(",").filter(Boolean).map((code) => (
                        <span
                          key={code}
                          title={labels[code] ?? code}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {code.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.new_disciples ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total_church ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="self-center text-sm text-slate-500">Page {page}</span>
          <button
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
