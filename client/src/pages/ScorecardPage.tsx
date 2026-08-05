import { useEffect, useState } from "react";
import { api, type ScorecardReport } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
} from "../components/Layout";
import { GlobalYoYSummary, RegionalMiniDashboard } from "../components/RegionalMiniDashboard";
import { formatQuarterLabel } from "../lib/quarters";

export function ScorecardPage() {
  const [quarter, setQuarter] = useState("");
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [report, setReport] = useState<ScorecardReport | null>(null);
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
      .scorecard(quarter)
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quarter]);

  if (error) return <ErrorBlock message={error} />;
  if (loading || !report) return <LoadingBlock />;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Regional scorecard"
          subtitle="Year-over-year movement by region — same quarter last year vs this quarter."
        />
        <div className="flex flex-wrap items-center gap-3">
          {quarters.length > 0 && (
            <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
          )}
          <a
            href={`/api/data-health/scorecard.csv?date=${quarter}`}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Export CSV
          </a>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Worldwide</h2>
        <p className="text-xs text-slate-500 mb-3">
          {formatQuarterLabel(report.quarter_end)} compared to {formatQuarterLabel(report.prior_year_quarter)}
        </p>
        <GlobalYoYSummary
          metrics={report.global_metrics}
          priorYearQuarter={report.prior_year_quarter}
          summary={report.global_yoy_summary}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {report.regions.map((r) => (
          <RegionalMiniDashboard key={r.region} card={r} />
        ))}
      </div>
    </>
  );
}
