import { useEffect, useState } from "react";
import { BarChart, Card, Title } from "@tremor/react";
import { api, type RegionHealth } from "../api";
import { ErrorBlock, LoadingBlock, PageHeader, QuarterSelect } from "../components/Layout";

export function RegionsPage() {
  const [quarter, setQuarter] = useState("");
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [regions, setRegions] = useState<RegionHealth[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.quarters().then((q) => {
      setQuarters(q.quarters);
      setQuarter(q.latest ?? q.quarters[0]?.date ?? "");
    });
  }, []);

  useEffect(() => {
    if (!quarter) return;
    setLoading(true);
    api
      .regions(quarter)
      .then(setRegions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quarter]);

  if (error) return <ErrorBlock message={error} />;
  if (loading) return <LoadingBlock />;

  const chartData = regions.map((r) => ({
    region: r.region.replace(" ", "\n"),
    health_score: r.health_score,
    issue_rows: r.issue_rows,
  }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader title="Regions" subtitle="Health score and issue volume by region for the selected quarter." />
        {quarters.length > 0 && <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />}
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm mb-6">
        <Title>Health score by region (% clean rows)</Title>
        <BarChart
          className="mt-4 h-72"
          data={chartData}
          index="region"
          categories={["health_score"]}
          colors={["emerald"]}
          valueFormatter={(v) => `${v}%`}
          yAxisWidth={140}
        />
      </Card>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3 text-right">Rows</th>
              <th className="px-4 py-3 text-right">Healthy</th>
              <th className="px-4 py-3 text-right">With issues</th>
              <th className="px-4 py-3 text-right">Health %</th>
              <th className="px-4 py-3 text-right">MBB disciples</th>
              <th className="px-4 py-3 text-right">MBB churches</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {regions.map((r) => (
              <tr key={r.region} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium">{r.region}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.total_rows.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brand-700">{r.healthy_rows.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-700">{r.issue_rows.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{r.health_score}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.mbb_disciples_calc.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.mbb_churches_calc.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
