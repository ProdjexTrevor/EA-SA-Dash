import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type ShareBundleResponse } from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

export function SharePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState(searchParams.get("date") || "");
  const [region, setRegion] = useState(searchParams.get("region") || "");
  const [data, setData] = useState<ShareBundleResponse | null>(null);
  const [copied, setCopied] = useState(false);
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
        if (!quarter) {
          setQuarter(
            normalizeQuarterDate(searchParams.get("date")) ||
              normalizeQuarterDate(q.latest) ||
              normalized[0]?.date ||
              ""
          );
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const date = normalizeQuarterDate(quarter);
    if (!date) return;
    const params = new URLSearchParams();
    params.set("date", date);
    if (region) params.set("region", region);
    setSearchParams(params, { replace: true });
    setLoading(true);
    api
      .analyticsShareBundle(date, region || undefined)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [quarter, region, setSearchParams]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${data?.share_path || `/share?date=${quarter}`}`
      : data?.share_path || "";

  async function copyText() {
    if (!data?.text) return;
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the text box manually.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link.");
    }
  }

  const p = data?.portfolio;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <PageHeader
          title="Share"
          subtitle="Printable executive brief and copy-ready text for board decks."
        />
        <div className="flex flex-wrap items-center gap-2">
          {quarters.length > 0 && (
            <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
          )}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
          >
            <option value="">All regions</option>
            <option value="East Africa">East Africa</option>
            <option value="Southern Africa">Southern Africa</option>
            <option value="The Moon">The Moon</option>
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Print / PDF
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={copyText}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            {copied ? "Copied" : "Copy text"}
          </button>
        </div>
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {p && (
        <div className="print:block">
          <div className="mb-2 hidden print:block">
            <h1 className="text-xl font-bold">EA-SA Dash — Executive brief</h1>
            <p className="text-sm text-slate-600">
              Quarter ending {formatQuarterLabel(p.quarter_end)}
              {data?.region ? ` · ${data.region}` : ""}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Engagements" value={p.headline.engagements} />
            <StatCard label="Avg health" value={p.headline.avg_health_score} tone="good" />
            <StatCard label="Baptism watch" value={p.headline.baptism_needs_attention} />
            <StatCard label="Not reporting" value={p.freshness.not_reporting} />
          </div>

          <div className="mb-4 grid gap-4 print:grid-cols-1 md:grid-cols-2">
            <section className="dash-panel-solid p-4">
              <h2 className="mb-2 text-sm font-semibold">Pipeline</h2>
              <ul className="space-y-1 text-xs">
                {p.funnel.map((f) => (
                  <li key={f.classification} className="flex justify-between">
                    <span>{f.classification}</span>
                    <span className="tabular-nums font-semibold">{f.count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dash-panel-solid p-4">
              <h2 className="mb-2 text-sm font-semibold">Regions</h2>
              <ul className="space-y-1 text-xs">
                {p.regions.map((r) => (
                  <li key={r.region} className="flex justify-between gap-2">
                    <span>{r.region}</span>
                    <span className="tabular-nums text-slate-700">
                      avg {r.avg_health_score} · n {r.engagements}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <section className="dash-panel-solid p-4">
              <h2 className="mb-2 text-sm font-semibold">Top gains</h2>
              <ul className="space-y-1 text-xs">
                {p.top_gains.slice(0, 6).map((m) => (
                  <li key={`g-${m.engagement_name}`} className="flex justify-between">
                    <span className="truncate pr-2">{m.engagement_name}</span>
                    <span className="tabular-nums font-semibold text-emerald-700">
                      +{m.delta_score}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dash-panel-solid p-4">
              <h2 className="mb-2 text-sm font-semibold">Top risks</h2>
              <ul className="space-y-1 text-xs">
                {p.top_risks.slice(0, 6).map((m) => (
                  <li key={`r-${m.engagement_name}`} className="flex justify-between">
                    <span className="truncate pr-2">{m.engagement_name}</span>
                    <span className="tabular-nums font-semibold text-red-700">{m.delta_score}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="dash-panel-solid p-4 print:hidden">
            <h2 className="mb-2 text-sm font-semibold">Plain text brief</h2>
            <textarea
              readOnly
              value={data?.text ?? ""}
              rows={14}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Generated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : ""} ·{" "}
              {shareUrl}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
