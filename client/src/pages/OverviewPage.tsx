import { useEffect, useState } from "react";
import { BarChart, Card, DonutChart, Title } from "@tremor/react";
import { api, type HealthSummary } from "../api";
import {
  ErrorBlock,
  HealthScoreRing,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";

const ISSUE_ORDER = [
  "MISSING_MBB_DECIMAL",
  "STALE_MBB_DISCIPLES_CALC",
  "STALE_MBB_CHURCHES_CALC",
  "CHURCHES_NO_GEN",
  "MISSING_ENGAGEMENT_ID",
  "DUPLICATE_ENGAGEMENT_DATE",
  "BAPTISMS_EXCEED_DISCIPLES",
  "CHURCHES_WITHOUT_DBS",
  "GEN_VERY_HIGH",
  "NEGATIVE_COUNTS",
];

export function OverviewPage() {
  const [quarter, setQuarter] = useState("");
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.quarters(), api.issueLabels()])
      .then(([q, lbl]) => {
        setQuarters(q.quarters);
        setQuarter(q.latest ?? q.quarters[0]?.date ?? "");
        setLabels(lbl);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!quarter) return;
    setLoading(true);
    api
      .summary(quarter)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quarter]);

  if (error) return <ErrorBlock message={error} />;
  if (!summary && loading) return <LoadingBlock />;

  const donut = [
    { name: "Healthy", value: summary!.healthy_rows },
    { name: "Warning", value: summary!.warning_rows },
    { name: "Critical", value: summary!.critical_rows },
  ];

  const issueBars = ISSUE_ORDER.filter((k) => (summary!.issue_counts[k] ?? 0) > 0).map((k) => ({
    issue: labels[k]?.replace(" ", "\n") ?? k,
    count: summary!.issue_counts[k],
  }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Data quality"
          subtitle="For coordinators: which submitted rows need fixes before leadership reports are trusted."
        />
        {quarters.length > 0 && <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
          <p className="text-sm font-medium text-slate-500">Health score</p>
          <div className="mt-3 flex items-end gap-4">
            <HealthScoreRing score={summary!.health_score} />
            <div className="text-sm text-slate-600 pb-1">
              <p>
                <strong>{summary!.healthy_rows.toLocaleString()}</strong> of{" "}
                {summary!.total_rows.toLocaleString()} rows pass all checks
              </p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Healthy" value={summary!.healthy_rows.toLocaleString()} tone="good" />
          <StatCard label="Warnings" value={summary!.warning_rows.toLocaleString()} tone="warn" />
          <StatCard label="Critical" value={summary!.critical_rows.toLocaleString()} tone="bad" />
          <StatCard label="Engagements" value={summary!.total_rows.toLocaleString()} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <Title>Row status mix</Title>
          <DonutChart
            className="mt-4 h-56"
            data={donut}
            category="value"
            index="name"
            colors={["emerald", "amber", "rose"]}
            valueFormatter={(v) => v.toLocaleString()}
          />
        </Card>
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <Title>Issue types (rows affected)</Title>
          <BarChart
            className="mt-4 h-56"
            data={issueBars}
            index="issue"
            categories={["count"]}
            colors={["rose"]}
            valueFormatter={(v) => v.toLocaleString()}
            layout="vertical"
            yAxisWidth={120}
          />
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="DBS" value={summary!.totals.dbs.toLocaleString()} />
        <StatCard label="Churches" value={summary!.totals.churches.toLocaleString()} />
        <StatCard label="New disciples" value={summary!.totals.new_disciples.toLocaleString()} />
        <StatCard label="New baptisms" value={summary!.totals.new_baptisms.toLocaleString()} />
        <StatCard label="MBB disciples (calc)" value={summary!.totals.mbb_disciples_calc.toLocaleString()} />
        <StatCard label="MBB churches (calc)" value={summary!.totals.mbb_churches_calc.toLocaleString()} />
      </div>
    </>
  );
}
