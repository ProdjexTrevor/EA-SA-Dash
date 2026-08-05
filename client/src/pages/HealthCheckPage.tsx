import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type DmmAssessment,
  type DmmClassification,
  type DmmRateIndicator,
  type MetricStatus,
} from "../api";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel, normalizeQuarterDate } from "../lib/quarters";

const CLASSIFICATIONS: DmmClassification[] = [
  "Sustained Movement",
  "Movement",
  "Multiplying",
  "Fruitful",
  "Active",
  "Unhealthy",
  "Insufficient Data",
];

const METRIC_KEYS: {
  key: keyof DmmAssessment["metrics"];
  label: string;
}[] = [
  { key: "group_to_church_rate", label: "Group → church" },
  { key: "baptism_rate", label: "Baptism rate" },
  { key: "leadership_pipeline_rate", label: "Leadership pipeline" },
  { key: "trainer_rate", label: "Trainer rate" },
  { key: "church_loss_rate", label: "Church loss" },
  { key: "church_growth_rate", label: "Church growth" },
  { key: "disciple_growth_rate", label: "Disciple growth" },
  { key: "generation_depth", label: "Generation" },
];

function fmtPct(value: number | null, isCount = false): string {
  if (value == null) return "—";
  if (isCount) return String(Math.round(value * 10) / 10);
  return `${Math.round(value * 1000) / 10}%`;
}

function StatusPill({ status }: { status: MetricStatus }) {
  const map: Record<MetricStatus, { cls: string; label: string; icon: string }> = {
    green: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300", label: "Green", icon: "●" },
    yellow: { cls: "bg-amber-100 text-amber-900 border-amber-300", label: "Yellow", icon: "●" },
    red: { cls: "bg-red-100 text-red-900 border-red-300", label: "Red", icon: "●" },
    not_available: {
      cls: "bg-slate-100 text-slate-700 border-slate-300",
      label: "N/A",
      icon: "–",
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${m.cls}`}
    >
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}

function ClassificationBadge({ c }: { c: DmmClassification }) {
  const cls: Record<DmmClassification, string> = {
    "Sustained Movement": "bg-emerald-800 text-white",
    Movement: "bg-emerald-700 text-white",
    Multiplying: "bg-teal-700 text-white",
    Fruitful: "bg-sky-700 text-white",
    Active: "bg-slate-700 text-white",
    Unhealthy: "bg-red-700 text-white",
    "Insufficient Data": "bg-slate-400 text-white",
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${cls[c]}`}>{c}</span>
  );
}

function SimpleBand({
  band,
  label,
  mode = "baptism",
}: {
  band: DmmAssessment["baptism_simple_band"];
  label: string;
  mode?: "baptism" | "leadership";
}) {
  const map = {
    healthy: "text-emerald-800 bg-emerald-50 border-emerald-200",
    trending: "text-amber-900 bg-amber-50 border-amber-200",
    needs_attention: "text-red-800 bg-red-50 border-red-200",
    not_available: "text-slate-600 bg-slate-50 border-slate-200",
  };
  const baptismText = {
    healthy: "Healthy (75–100%)",
    trending: "Trending (50–75%)",
    needs_attention: "Needs attention (<50%)",
    not_available: "N/A",
  };
  const leadershipText = {
    healthy: "OK (≥50%)",
    trending: "—",
    needs_attention: "Needs attention (<50%)",
    not_available: "N/A",
  };
  const text = mode === "leadership" ? leadershipText : baptismText;
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${map[band]}`}>
      {label}: {text[band]}
    </span>
  );
}

function MetricCell({ m, isGen }: { m: DmmRateIndicator; isGen?: boolean }) {
  return (
    <div className="min-w-[6.5rem]" title={`${m.formula}\n${m.thresholds}`}>
      <div className="flex items-center gap-1">
        <StatusPill status={m.status} />
      </div>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
        {isGen ? (m.value == null ? "—" : `G${m.value}`) : fmtPct(m.value)}
      </p>
      {(m.numerator != null || m.denominator != null) && (
        <p className="text-xs font-medium text-slate-700 tabular-nums">
          {m.numerator ?? "—"} / {m.denominator ?? "—"}
        </p>
      )}
    </div>
  );
}

export function HealthCheckPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [rows, setRows] = useState<DmmAssessment[]>([]);
  const [summary, setSummary] = useState<DmmHealthResponse["summary"] | null>(null);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<DmmAssessment | null>(null);

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

  const load = useCallback(async () => {
    const date = normalizeQuarterDate(quarter);
    if (!date) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyticsDmmHealth({
        date,
        search: search.trim() || undefined,
        classification: classification || undefined,
        region: region || undefined,
      });
      setRows(res.rows);
      setSummary(res.summary);
      setLimitations(res.data_limitations);
      if (selected) {
        const match = res.rows.find(
          (r) =>
            r.engagement_id === selected.engagement_id &&
            r.engagement_name === selected.engagement_name
        );
        setSelected(match ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [quarter, search, classification, region]);

  useEffect(() => {
    void load();
  }, [load]);

  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.region) s.add(r.region);
    return Array.from(s).sort();
  }, [rows]);

  // Re-fetch with region from full set: use client filter when region list depends on quarter
  const displayRows = useMemo(() => {
    if (!region) return rows;
    return rows.filter((r) => r.region === region);
  }, [rows, region]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Health Check"
          subtitle="DMM engagement assessment — classification, health score, and indicator status. High counts alone never equal a verified Movement."
        />
        {quarters.length > 0 && (
          <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Engagements scored" value={summary?.total ?? "—"} />
        <StatCard label="Avg health score" value={summary?.avg_health_score ?? "—"} tone="good" />
        <StatCard
          label="Baptism needs attention"
          value={summary?.baptism_needs_attention ?? "—"}
          hint="< 50% baptisms / disciples"
          tone="warn"
        />
        <StatCard
          label="Leadership needs attention"
          value={summary?.leadership_needs_attention ?? "—"}
          hint="Leaders / disciples < 50%"
          tone="warn"
        />
        <StatCard
          label="Verified movements"
          value={summary?.movement_verified_count ?? 0}
          hint="Requires multi-stream G4 data"
        />
        <StatCard
          label="Unhealthy"
          value={summary?.by_classification?.Unhealthy ?? 0}
          tone="bad"
        />
      </div>

      <div className="dash-panel-solid mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Search engagement, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="dash-input min-w-[14rem] flex-1"
          />
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            className="dash-input"
          >
            <option value="">All classifications</option>
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="dash-input">
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          <strong>Disciples → baptisms:</strong> Healthy 75–100% · Trending 50–75% · Needs attention
          &lt;50%. <strong>Groups∶churches target:</strong> about 4∶1 (church/dbs ≥ 25%).{" "}
          <strong>Leaders in training:</strong> below 50% of new disciples needs attention.
        </p>
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && !rows.length && <LoadingBlock />}

      {!loading && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="dash-table-shell xl:col-span-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                      Engagement
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                      Class
                    </th>
                    <th className="px-3 py-2.5 text-right text-sm font-semibold text-slate-800">
                      Score
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                      Movement
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                      Baptism
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold text-slate-800">
                      Pipeline
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.map((r) => (
                    <tr
                      key={`${r.engagement_id ?? r.engagement_name}-${r.reporting_period}`}
                      className={`cursor-pointer hover:bg-brand-50/60 ${
                        selected?.engagement_name === r.engagement_name &&
                        selected?.engagement_id === r.engagement_id
                          ? "bg-brand-50"
                          : ""
                      }`}
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{r.engagement_name}</p>
                        <p className="text-xs font-medium text-slate-700">
                          {r.country} · {r.region}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <ClassificationBadge c={r.classification} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums text-slate-900">
                        {r.health_score}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">
                        {r.movement_verified ? "Verified" : "Not verified"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={r.metrics.baptism_rate.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={r.metrics.leadership_pipeline_rate.status} />
                      </td>
                    </tr>
                  ))}
                  {!displayRows.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-slate-600">
                        No engagements for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dash-panel-solid p-4 xl:col-span-2">
            {!selected ? (
              <p className="text-sm text-slate-700">
                Select an engagement to see metric detail, strengths, warnings, and recommended
                actions.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selected.engagement_name}</h3>
                  <p className="text-sm text-slate-700">
                    {selected.country} · {formatQuarterLabel(selected.reporting_period)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ClassificationBadge c={selected.classification} />
                    <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900">
                      Health score {selected.health_score}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                        selected.movement_verified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-slate-300 bg-slate-50 text-slate-800"
                      }`}
                    >
                      {selected.movement_verified
                        ? "Verified movement"
                        : "Healthy engagement ≠ verified DMM"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-800">{selected.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SimpleBand band={selected.baptism_simple_band} label="Baptisms" />
                    <SimpleBand
                      band={selected.leadership_simple_band}
                      label="Leaders"
                      mode="leadership"
                    />
                    {selected.groups_to_church_target_met != null && (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          selected.groups_to_church_target_met
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                      >
                        4∶1 groups target:{" "}
                        {selected.groups_to_church_target_met ? "Met" : "Not met"}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-bold text-slate-900">Indicators</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {METRIC_KEYS.map(({ key, label }) => (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <p className="text-xs font-semibold text-slate-700">{label}</p>
                        <MetricCell
                          m={selected.metrics[key] as DmmRateIndicator}
                          isGen={key === "generation_depth"}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs font-semibold text-slate-700">
                      MBB church formation
                      {selected.metrics.mbb_church_formation_rate.trend !== "not_available" && (
                        <span className="ml-1 font-medium">
                          · {selected.metrics.mbb_church_formation_rate.trend}
                        </span>
                      )}
                    </p>
                    <MetricCell m={selected.metrics.mbb_church_formation_rate} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Strengths</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-800">
                    {selected.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                    {!selected.strengths.length && <li>None listed</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Warnings</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-800">
                    {selected.warnings.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Recommended actions</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-800">
                    {selected.recommended_actions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!!limitations.length && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-bold text-slate-900">Data limitations</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Local type alias for summary (mirrors API)
type DmmHealthResponse = {
  summary: {
    total: number;
    avg_health_score: number;
    by_classification: Record<string, number>;
    baptism_needs_attention: number;
    leadership_needs_attention: number;
    movement_verified_count: number;
  };
};
