import { BadgeDelta, Card, Flex, Metric, Text, Title } from "@tremor/react";
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
            <Card className="!overflow-hidden !border-slate-200/80 !bg-white/95 !p-0 !shadow-dash transition duration-300 group-hover:-translate-y-1 group-hover:!shadow-dash-lg group-hover:!ring-1 group-hover:!ring-brand-200/80">
              <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
              <div className="p-4 sm:p-5">
                <Flex alignItems="start" justifyContent="between" className="gap-3">
                  <div className="min-w-0">
                    <Title className="!truncate !font-display !text-base !font-bold !text-ink-900">
                      {row.label}
                    </Title>
                    <Text className="!mt-0.5 !text-xs !text-slate-500">
                      {fmt(row.row_count)} engagements
                    </Text>
                  </div>
                  {chg != null && (
                    <BadgeDelta deltaType={deltaType(chg)} size="xs">
                      {chg > 0 ? "+" : ""}
                      {chg}%
                    </BadgeDelta>
                  )}
                </Flex>

                <Metric className="!mt-3 !font-display !text-3xl !font-extrabold !tracking-tight !text-ink-900">
                  {fmt(row.new_disciples)}
                </Metric>
                <Text className="!mt-0.5 !text-xs !font-medium !text-slate-500">
                  new disciples this quarter
                </Text>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <Text className="!text-[10px] !font-bold !uppercase !tracking-wide !text-slate-400">
                      Baptisms
                    </Text>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                      {fmt(row.new_baptisms)}
                    </p>
                  </div>
                  <div>
                    <Text className="!text-[10px] !font-bold !uppercase !tracking-wide !text-slate-400">
                      Churches
                    </Text>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                      {fmt(row.total_churches)}
                    </p>
                  </div>
                  <div>
                    <Text className="!text-[10px] !font-bold !uppercase !tracking-wide !text-slate-400">
                      DBS
                    </Text>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                      {fmt(row.dbs)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs font-semibold text-brand-700 opacity-80 transition group-hover:opacity-100">
                  Open detail →
                </p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
