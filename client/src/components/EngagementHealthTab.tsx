import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  type EngagementHealthRow,
  type EngagementHealthSummary,
  type HealthBandLabel,
} from "../api";
import { SortableTable } from "./SortableTable";
import { formatPlaceName } from "../lib/formatPlaceName";
import { normalizeQuarterDate } from "../lib/quarters";

const BAND_STYLES: Record<HealthBandLabel, string> = {
  "Movement Multiplying": "bg-emerald-50 text-emerald-900 border-emerald-200",
  "Healthy Movement": "bg-brand-50 text-brand-900 border-brand-200",
  "Stable but Needs Attention": "bg-amber-50 text-amber-900 border-amber-200",
  "At Risk": "bg-orange-50 text-orange-900 border-orange-200",
  Critical: "bg-red-50 text-red-900 border-red-200",
};

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function fmtRatio(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

const BAND_SHORT: Partial<Record<HealthBandLabel, string>> = {
  "Movement Multiplying": "Multiplying",
  "Healthy Movement": "Healthy",
  "Stable but Needs Attention": "Needs attention",
};

function BandBadge({ band }: { band: HealthBandLabel }) {
  const label = BAND_SHORT[band] ?? band;
  return (
    <span
      title={band}
      className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight ${BAND_STYLES[band]}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

type Props = {
  quarter: string;
  quarterLabel: string;
};

export function EngagementHealthTab({ quarter, quarterLabel }: Props) {
  const [rows, setRows] = useState<EngagementHealthRow[]>([]);
  const [summary, setSummary] = useState<EngagementHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [peopleGroup, setPeopleGroup] = useState("");
  const [priority, setPriority] = useState("");
  const [stageTag, setStageTag] = useState("");
  const [levelTag, setLevelTag] = useState("");
  const [filterOpts, setFilterOpts] = useState<{
    regions: string[];
    countries: string[];
    people_groups: string[];
    priorities: string[];
    stage_tags: string[];
    level_tags: string[];
  } | null>(null);
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [showTrendColumns, setShowTrendColumns] = useState(false);

  const date = normalizeQuarterDate(quarter);

  useEffect(() => {
    if (!date) return;
    api.analyticsEngagementHealthFilters(date).then(setFilterOpts).catch(() => setFilterOpts(null));
  }, [date]);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyticsEngagementHealth({
        date,
        region: region || undefined,
        country: country || undefined,
        people_group: peopleGroup || undefined,
        priority: priority || undefined,
        stage_tag: stageTag || undefined,
        level_tag: levelTag || undefined,
      });
      setRows(res.rows);
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load health scores");
    } finally {
      setLoading(false);
    }
  }, [date, region, country, peopleGroup, priority, stageTag, levelTag]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.engagement_name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.people_group.toLowerCase().includes(q) ||
        String(r.engagement_id ?? "").includes(q)
    );
  }, [rows, search]);

  const truncateCell = (text: string, className = "") => (
    <span className={`block truncate ${className}`} title={text}>
      {text || "—"}
    </span>
  );

  const scoreSub = (primary: ReactNode, sub: string) => (
    <div className="leading-tight text-right">
      <span className="font-semibold text-slate-900 tabular-nums">{primary}</span>
      <span className="block text-[10px] font-normal text-slate-500 tabular-nums">{sub}</span>
    </div>
  );

  const baseColumns = useMemo((): ColumnDef<EngagementHealthRow>[] => {
    const scoreMeta = { align: "right" as const, nowrap: true, minWidth: "3.75rem" };
    return [
      {
        accessorKey: "health_score",
        header: "Health",
        meta: { align: "left", nowrap: true, minWidth: "3.5rem" },
        cell: ({ getValue }) => (
          <span className="text-base font-bold text-slate-900 tabular-nums">
            {getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: "health_band",
        header: "Band",
        meta: { align: "left", minWidth: "7.5rem" },
        cell: ({ getValue }) => <BandBadge band={getValue() as HealthBandLabel} />,
      },
      {
        accessorKey: "region",
        header: "Region",
        meta: { align: "left", className: "max-w-[10rem]", minWidth: "8rem" },
        cell: ({ getValue }) => truncateCell(getValue() as string, "text-xs uppercase text-slate-600"),
      },
      {
        accessorKey: "country",
        header: "Country",
        meta: { align: "left", className: "max-w-[8rem]", minWidth: "6.5rem" },
        cell: ({ getValue }) => truncateCell(getValue() as string),
      },
      {
        accessorKey: "engagement_name",
        header: "Engagement",
        meta: { align: "left", className: "max-w-[14rem]", minWidth: "11rem" },
        cell: ({ row }) => (
          <span className="font-medium text-slate-900 block truncate" title={row.original.engagement_name}>
            {row.original.engagement_name}
          </span>
        ),
      },
      {
        accessorKey: "engagement_id",
        header: "ID",
        meta: { align: "right", nowrap: true, minWidth: "3.5rem" },
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return <span className="text-slate-500 tabular-nums">{v ?? "—"}</span>;
        },
      },
      {
        accessorKey: "growth_momentum_score",
        header: "Growth",
        meta: { ...scoreMeta, className: "bg-slate-50/60" },
        cell: ({ row }) =>
          scoreSub(row.original.growth_momentum_score, fmtPct(row.original.growth_rate)),
      },
      {
        accessorKey: "multiplication_health_score",
        header: "Mult.",
        meta: { ...scoreMeta, className: "bg-slate-50/60" },
        cell: ({ row }) =>
          scoreSub(
            row.original.multiplication_health_score,
            `Gen ${row.original.effective_generation ?? "—"}`
          ),
      },
      {
        accessorKey: "leadership_development_score",
        header: "Leaders",
        meta: { ...scoreMeta, className: "bg-slate-50/60" },
      },
      {
        accessorKey: "sustainability_score",
        header: "Sustain",
        meta: { ...scoreMeta, className: "bg-slate-50/60" },
      },
      {
        accessorKey: "engagement_activity_score",
        header: "Activity",
        meta: { ...scoreMeta, className: "bg-slate-50/60" },
      },
    ];
  }, []);

  const trendColumns = useMemo((): ColumnDef<EngagementHealthRow>[] => [
    {
      accessorKey: "multiplication_velocity",
      header: "Mult. velocity",
      meta: { align: "right", nowrap: true, minWidth: "5.5rem" },
      cell: ({ getValue }) => fmtRatio(getValue() as number | null),
    },
    {
      accessorKey: "generation_velocity",
      header: "Gen Δ",
      meta: { align: "right", nowrap: true, minWidth: "4rem" },
      cell: ({ getValue }) => fmt(getValue() as number | null, 1),
    },
    {
      accessorKey: "church_reproduction_rate",
      header: "Ch. repro",
      meta: { align: "right", nowrap: true, minWidth: "4.5rem" },
      cell: ({ getValue }) => fmtPct(getValue() as number | null),
    },
  ], []);

  const columns = useMemo(
    () => (showTrendColumns ? [...baseColumns, ...trendColumns] : baseColumns),
    [baseColumns, trendColumns, showTrendColumns]
  );

  const bandCards = useMemo(() => {
    if (!summary) return [];
    const total = summary.total_scored || 1;
    return [
      {
        band: "Movement Multiplying" as HealthBandLabel,
        range: "90–100",
        short: "Multiplying",
        desc: "Strong growth, multiplication, and leadership pipeline.",
        count: summary.by_band["Movement Multiplying"],
        pct: Math.round((summary.by_band["Movement Multiplying"] / total) * 1000) / 10,
      },
      {
        band: "Healthy Movement" as HealthBandLabel,
        range: "75–89",
        short: "Healthy",
        desc: "Solid momentum with room to deepen sustainability.",
        count: summary.by_band["Healthy Movement"],
        pct: Math.round((summary.by_band["Healthy Movement"] / total) * 1000) / 10,
      },
      {
        band: "Stable but Needs Attention" as HealthBandLabel,
        range: "60–74",
        short: "Needs attention",
        desc: "Reporting but plateauing or thin on leaders / activity.",
        count: summary.by_band["Stable but Needs Attention"],
        pct: Math.round((summary.by_band["Stable but Needs Attention"] / total) * 1000) / 10,
      },
      {
        band: "At Risk" as HealthBandLabel,
        range: "40–59",
        short: "At risk",
        desc: "Declining or weak multiplication; coaching recommended.",
        count: summary.by_band["At Risk"],
        pct: Math.round((summary.by_band["At Risk"] / total) * 1000) / 10,
      },
      {
        band: "Critical" as HealthBandLabel,
        range: "0–39",
        short: "Critical",
        desc: "Little growth, high attrition, or minimal field activity.",
        count: summary.by_band.Critical,
        pct: Math.round((summary.by_band.Critical / total) * 1000) / 10,
      },
    ];
  }, [summary]);

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Engagement Health Scoreboard</h3>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Each engagement with a report for <strong>{quarterLabel}</strong> receives a{" "}
              <strong>0–100 score</strong>. The model rewards <strong>growth and multiplication</strong>, not
              size alone — a small engagement with strong QoQ growth and Gen 3+ can score higher than a large
              stagnant one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScoringGuide((v) => !v)}
            className="text-sm font-medium text-brand-700 hover:text-brand-900 whitespace-nowrap print:hidden"
          >
            {showScoringGuide ? "Hide scoring guide" : "How scoring works"}
          </button>
        </div>

        {showScoringGuide && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 text-sm text-slate-700 print:hidden">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ScoreComponentCard
                title="Growth momentum"
                points={30}
                detail="QoQ growth in churches to date (cumulative), not the small quarterly stream count. Bonus if (new disciples + baptisms) per church exceeds 1.0."
                thresholds=">25% = 30 pts · 15–25% = 25 · 5–15% = 20 · 0–5% = 15 · negative = 5"
              />
              <ScoreComponentCard
                title="Multiplication health"
                points={25}
                detail="Uses gen_to_date when set, otherwise gen. DBS-to-church ratio ideally 1.5–5.0."
                thresholds="Gen 5+ = 25 · Gen 4 = 20 · Gen 3 = 15 · Gen 2 = 10 · Gen 1 = 5"
              />
              <ScoreComponentCard
                title="Leadership development"
                points={20}
                detail="Leaders in training and active trainers per church, plus trainings held this quarter."
                thresholds="Up to 10 leaders/church · 5 trainers/church · 5 trainings"
              />
              <ScoreComponentCard
                title="Sustainability"
                points={15}
                detail="Church attrition (lost + merged) vs churches to date. Penalty if engagement marked inactive."
                thresholds="<2% attrition = 15 · 2–5% = 12 · 5–10% = 8 · >10% = 3"
              />
              <ScoreComponentCard
                title="Engagement activity"
                points={10}
                detail="Field reporting discipline: active flag, trainings, notes, stage and level tags."
                thresholds="Active 4 · trainings 3 · notes 1 · stage 1 · level 1"
              />
              <ScoreComponentCard
                title="Trend metrics (table)"
                points={0}
                detail="Supporting indicators — not added to the 100-point total."
                thresholds="Mult. velocity (12q) · Gen Δ · leader pipeline · baptism % · church reproduction"
              />
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <p className="text-sm text-slate-500 py-8 text-center">Calculating health scores…</p>
      ) : (
        <>
          {summary && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Snapshot · {fmt(summary.total_scored)} engagements (one row per engagement ID)
              </h4>
              <div className="grid lg:grid-cols-[minmax(0,11rem)_1fr] gap-4 mb-2">
                <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
                    Average health
                  </p>
                  <p className="mt-2 text-4xl font-bold text-brand-900 tabular-nums">
                    {fmt(summary.avg_health_score, 1)}
                  </p>
                  <p className="mt-1 text-xs text-brand-800/80">out of 100 · {quarterLabel}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                  {bandCards.map((b) => (
                    <div
                      key={b.band}
                      className={`rounded-xl border p-3 ${BAND_STYLES[b.band]}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-bold tabular-nums">{fmt(b.count)}</span>
                        <span className="text-xs font-medium tabular-nums opacity-80">{b.pct}%</span>
                      </div>
                      <p className="text-xs font-semibold mt-1 leading-tight">{b.short}</p>
                      <p className="text-[10px] opacity-75 mt-0.5">{b.range} pts</p>
                      <p className="text-[11px] mt-2 leading-snug opacity-90 hidden sm:block">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Filter & explore
            </h4>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4 print:hidden">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <FilterSelect
                  label="Region"
                  value={region}
                  options={filterOpts?.regions ?? []}
                  onChange={setRegion}
                />
                <FilterSelect
                  label="Country"
                  value={country}
                  options={filterOpts?.countries ?? []}
                  onChange={setCountry}
                />
                <FilterSelect
                  label="People group"
                  value={peopleGroup}
                  options={filterOpts?.people_groups ?? []}
                  onChange={setPeopleGroup}
                />
                <FilterSelect
                  label="Priority"
                  value={priority}
                  options={filterOpts?.priorities ?? []}
                  onChange={setPriority}
                />
                <FilterSelect
                  label="Stage"
                  value={stageTag}
                  options={filterOpts?.stage_tags ?? []}
                  onChange={setStageTag}
                />
                <FilterSelect
                  label="Level"
                  value={levelTag}
                  options={filterOpts?.level_tags ?? []}
                  onChange={setLevelTag}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <input
                  type="search"
                  placeholder="Search engagement…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm w-full sm:w-auto sm:min-w-[14rem] sm:flex-1 sm:max-w-md"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                All engagements
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  {filtered.length} shown
                  {search.trim() ? ` (search of ${rows.length})` : ""}
                  · sort any column
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer print:hidden">
                  <input
                    type="checkbox"
                    checked={showTrendColumns}
                    onChange={(e) => setShowTrendColumns(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600"
                  />
                  Trend columns
                </label>
              </div>
            </div>
            <SortableTable
              data={filtered}
              columns={columns}
              defaultSort={[{ id: "health_score", desc: true }]}
              emptyMessage="No engagements match your filters."
              dense
              stickyFirstColumn
              tableLayout="fixed"
              pageSize={25}
              pageSizeOptions={[25, 50, 100]}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ScoreComponentCard({
  title,
  points,
  detail,
  thresholds,
}: {
  title: string;
  points: number;
  detail: string;
  thresholds: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">{title}</p>
        {points > 0 && (
          <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
            {points} pts
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{detail}</p>
      <p className="text-[11px] text-slate-500 mt-2 leading-snug">{thresholds}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {formatPlaceName(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
