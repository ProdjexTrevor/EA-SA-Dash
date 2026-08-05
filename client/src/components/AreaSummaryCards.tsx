import type { RollupRow } from "../api";

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}% vs last quarter`;
}

export function AreaSummaryCards({
  rows,
  onSelect,
}: {
  rows: RollupRow[];
  onSelect: (row: RollupRow) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
      {rows.map((row) => {
        const chg = row.pct_chg_disciples;
        const chgCls =
          chg != null && chg > 0
            ? "text-emerald-700"
            : chg != null && chg < 0
              ? "text-red-700"
              : "text-slate-500";
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => onSelect(row)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300 hover:shadow-md transition"
          >
            <h3 className="font-bold text-slate-900 text-base leading-tight">{row.label}</h3>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {fmt(row.new_disciples)}
              <span className="text-sm font-medium text-slate-500 ml-1">disciples</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
              <span>{fmt(row.new_baptisms)} baptisms</span>
              <span>{fmt(row.total_churches)} churches</span>
              <span>{fmt(row.dbs)} DBS</span>
            </div>
            {chg != null && (
              <p className={`mt-2 text-xs font-semibold ${chgCls}`}>{fmtPct(chg)}</p>
            )}
            <p className="mt-2 text-xs text-brand-700 font-medium">Tap for detail →</p>
          </button>
        );
      })}
    </div>
  );
}
