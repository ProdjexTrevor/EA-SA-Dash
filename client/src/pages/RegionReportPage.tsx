import { type ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { api, type RollupRow } from "../api";
import { SortableTable } from "../components/SortableTable";
import {
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  QuarterSelect,
  StatCard,
} from "../components/Layout";
import { formatQuarterLabel } from "../lib/quarters";

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function pctTone(n: number | null | undefined): "neutral" | "good" | "bad" {
  if (n == null) return "neutral";
  if (n > 0) return "good";
  if (n < 0) return "bad";
  return "neutral";
}

function RegionSummary({ row, quarterLabel }: { row: RollupRow; quarterLabel: string }) {
  return (
    <section className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Region total</p>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{row.label}</h3>
        </div>
        <p className="text-sm text-slate-600">{quarterLabel}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Engagements" value={fmt(row.row_count)} hint="reporting this quarter" />
        <StatCard
          label="New disciples"
          value={fmt(row.new_disciples)}
          hint={`QoQ ${fmtPct(row.pct_chg_disciples)}`}
          tone={pctTone(row.pct_chg_disciples)}
        />
        <StatCard
          label="Baptisms"
          value={fmt(row.new_baptisms)}
          hint={`QoQ ${fmtPct(row.pct_chg_baptisms)}`}
          tone={pctTone(row.pct_chg_baptisms)}
        />
        <StatCard
          label="Churches"
          value={fmt(row.total_churches)}
          hint={`QoQ ${fmtPct(row.pct_chg_churches)}`}
          tone={pctTone(row.pct_chg_churches)}
        />
        <StatCard label="Discovery groups" value={fmt(row.dbs)} />
        <StatCard label="MBB disciples" value={fmt(row.mbb_disciples)} />
        <StatCard label="Leaders in training" value={fmt(row.leaders_in_training)} />
        <StatCard label="Avg generation" value={fmt(row.avg_gen, 1)} hint={`Max ${fmt(row.max_gen)}`} />
      </div>
    </section>
  );
}

export function RegionReportPage() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [regions, setRegions] = useState<RollupRow[]>([]);
  const [regionKey, setRegionKey] = useState("");
  const [countries, setCountries] = useState<RollupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .analyticsQuarters()
      .then((q) => {
        setQuarters(q.quarters);
        setQuarter(q.latest ?? q.quarters[0]?.date ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!quarter) return;
    setLoading(true);
    setError("");
    api
      .analyticsRollup({ date: quarter, level: "region" })
      .then((res) => {
        const sorted = [...res.rows].sort((a, b) => a.label.localeCompare(b.label));
        setRegions(sorted);
        setRegionKey((prev) => {
          if (prev && sorted.some((r) => r.key === prev)) return prev;
          return sorted[0]?.key ?? "";
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quarter]);

  useEffect(() => {
    if (!quarter || !regionKey) {
      setCountries([]);
      return;
    }
    setCountriesLoading(true);
    api
      .analyticsRollup({ date: quarter, level: "country", region: regionKey })
      .then((res) => setCountries(res.rows))
      .catch((e) => setError(e.message))
      .finally(() => setCountriesLoading(false));
  }, [quarter, regionKey]);

  const regionRow = useMemo(
    () => regions.find((r) => r.key === regionKey) ?? null,
    [regions, regionKey]
  );

  const quarterLabel = formatQuarterLabel(quarter);

  const countryColumns = useMemo((): ColumnDef<RollupRow>[] => [
    {
      accessorKey: "label",
      header: "Country",
      meta: { align: "left" },
      cell: ({ getValue }) => (
        <span className="font-medium text-slate-900">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "row_count",
      header: "Engagements",
      meta: { align: "right", nowrap: true },
    },
    {
      accessorKey: "new_disciples",
      header: "Disciples",
      meta: { align: "right", nowrap: true },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          <span className="font-medium">{fmt(row.original.new_disciples)}</span>
          <span className="block text-[10px] text-slate-500">QoQ {fmtPct(row.original.pct_chg_disciples)}</span>
        </div>
      ),
    },
    {
      accessorKey: "new_baptisms",
      header: "Baptisms",
      meta: { align: "right", nowrap: true },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          <span>{fmt(row.original.new_baptisms)}</span>
          <span className="block text-[10px] text-slate-500">QoQ {fmtPct(row.original.pct_chg_baptisms)}</span>
        </div>
      ),
    },
    {
      accessorKey: "total_churches",
      header: "Churches",
      meta: { align: "right", nowrap: true },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          <span>{fmt(row.original.total_churches)}</span>
          <span className="block text-[10px] text-slate-500">QoQ {fmtPct(row.original.pct_chg_churches)}</span>
        </div>
      ),
    },
    {
      accessorKey: "dbs",
      header: "DBS",
      meta: { align: "right", nowrap: true },
    },
    {
      accessorKey: "mbb_disciples",
      header: "MBB",
      meta: { align: "right", nowrap: true },
    },
    {
      accessorKey: "avg_gen",
      header: "Avg gen",
      meta: { align: "right", nowrap: true },
      cell: ({ getValue }) => fmt(getValue() as number, 1),
    },
  ], []);

  if (error && !regionRow) return <ErrorBlock message={error} />;
  if (loading && !regions.length) return <LoadingBlock />;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 print:mb-4">
        <PageHeader
          title="Quarter report — by region"
          subtitle="Pick a region for a simple snapshot of movement this quarter, with countries listed below."
        />
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          {quarters.length > 0 && (
            <QuarterSelect value={quarter} options={quarters} onChange={setQuarter} />
          )}
          <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
            Region
            <select
              value={regionKey}
              onChange={(e) => setRegionKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 min-w-[12rem] shadow-sm"
            >
              {regions.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {regionRow && <RegionSummary row={regionRow} quarterLabel={quarterLabel} />}

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-slate-900">Countries in {regionRow?.label ?? "region"}</h3>
          <p className="text-xs text-slate-500">
            {countries.length} {countries.length === 1 ? "country" : "countries"}
            {countriesLoading ? " · loading…" : ""}
          </p>
        </div>
        {countriesLoading && !countries.length ? (
          <LoadingBlock />
        ) : (
          <SortableTable
            data={countries}
            columns={countryColumns}
            defaultSort={[{ id: "new_disciples", desc: true }]}
            dense
            emptyMessage="No country data for this region and quarter."
          />
        )}
      </section>
    </>
  );
}
