import { BadgeDelta, Card, Flex } from "@tremor/react";
import type { RollupRow } from "../api";

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function deltaType(n: number | null | undefined): "increase" | "decrease" | "unchanged" {
  if (n == null || n === 0) return "unchanged";
  return n > 0 ? "increase" : "decrease";
}

const REGION_ACCENTS: Record<string, string> = {
  "East Africa": "from-emerald-500 to-teal-600",
  "Southern Africa": "from-cyan-500 to-sky-700",
  "The Moon": "from-amber-400 to-orange-600",
};

export function AreaSummaryCards({
  rows,
  onSelect,
}: {
  rows: RollupRow[];
  onSelect: (row: RollupRow) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, i) => {
        const accent =
          REGION_ACCENTS[row.label] ??
          REGION_ACCENTS[row.region ?? ""] ??
          "from-brand-400 to-teal-700";
        const chg = row.pct_chg_disciples;
        const stagger = `stagger-${Math.min(i + 1, 6)}`;
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => onSelect(row)}
            className={`group text-left ${stagger}`}
          >
            <Card className="!overflow-hidden !border-slate-200 !bg-white !p-0 !shadow-dash transition duration-200 group-hover:-translate-y-0.5 group-hover:!shadow-dash-lg">
              <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
              <div className="p-4 sm:p-5">
                <Flex alignItems="start" justifyContent="between" className="gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{row.label}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {fmt(row.row_count)} engagements
                    </p>
                  </div>
                  {chg != null && (
                    <BadgeDelta deltaType={deltaType(chg)} size="xs">
                      {chg > 0 ? "+" : ""}
                      {chg}%
                    </BadgeDelta>
                  )}
                </Flex>

                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {fmt(row.new_disciples)}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">new disciples this quarter</p>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                  <div>
                    <p className="text-sm text-slate-600">Baptisms</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                      {fmt(row.new_baptisms)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Churches</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                      {fmt(row.total_churches)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">DBS</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                      {fmt(row.dbs)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-sm font-medium text-brand-700">Open detail →</p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
