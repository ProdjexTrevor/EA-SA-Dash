import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { api, type RollupRow } from "../api";
import { ErrorBlock, LoadingBlock, PageHeader } from "./Layout";
import { formatQuarterLabel } from "../lib/quarters";

type AreaType = "region" | "country";

export type CompareSlot = {
  id: string;
  quarter: string;
  areaType: AreaType;
  areaKey: string;
};

type CompareCol = {
  slotId: string;
  quarter: string;
  areaType: AreaType;
  areaKey: string;
  data: RollupRow | null;
};

type QuarterRollups = {
  regions: RollupRow[];
  countries: RollupRow[];
};

const METRICS: { key: keyof RollupRow; label: string; digits?: number }[] = [
  { key: "row_count", label: "Engagements" },
  { key: "new_disciples", label: "New disciples" },
  { key: "new_baptisms", label: "Baptisms" },
  { key: "total_churches", label: "Churches" },
  { key: "dbs", label: "Discovery groups" },
  { key: "mbb_disciples", label: "MBB disciples" },
  { key: "leaders_in_training", label: "Leaders in training" },
  { key: "avg_gen", label: "Avg generation", digits: 1 },
];

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

let slotCounter = 0;
function newSlotId(): string {
  slotCounter += 1;
  return `slot-${slotCounter}`;
}

function defaultSlot(
  quarter: string,
  rollups: QuarterRollups | undefined,
  areaType: AreaType
): CompareSlot {
  const list = areaType === "region" ? rollups?.regions : rollups?.countries;
  return {
    id: newSlotId(),
    quarter,
    areaType,
    areaKey: list?.[0]?.key ?? "",
  };
}

type Props = {
  quarters: { date: string; row_count: number }[];
  initialQuarter: string;
  initialRollups?: QuarterRollups;
};

export function QuarterComparePage({ quarters, initialQuarter, initialRollups }: Props) {
  const [rollupsByQuarter, setRollupsByQuarter] = useState<Record<string, QuarterRollups>>(() =>
    initialRollups && initialQuarter ? { [initialQuarter]: initialRollups } : {}
  );
  const rollupsRef = useRef(rollupsByQuarter);
  rollupsRef.current = rollupsByQuarter;

  const [slots, setSlots] = useState<CompareSlot[]>(() => [
    defaultSlot(initialQuarter, initialRollups, "region"),
    defaultSlot(initialQuarter, initialRollups, "country"),
  ]);
  const [cols, setCols] = useState<CompareCol[]>([]);
  const [loadingRollups, setLoadingRollups] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const ensureRollups = useCallback(async (q: string) => {
    if (!q || rollupsRef.current[q]) return rollupsRef.current[q];
    setLoadingRollups(true);
    try {
      const [regRes, ctyRes] = await Promise.all([
        api.analyticsRollup({ date: q, level: "region" }),
        api.analyticsRollup({ date: q, level: "country" }),
      ]);
      const bundle: QuarterRollups = {
        regions: [...regRes.rows].sort((a, b) => a.label.localeCompare(b.label)),
        countries: [...ctyRes.rows].sort((a, b) => a.label.localeCompare(b.label)),
      };
      setRollupsByQuarter((prev) => ({ ...prev, [q]: bundle }));
      return bundle;
    } finally {
      setLoadingRollups(false);
    }
  }, []);

  useEffect(() => {
    for (const s of slots) {
      if (s.quarter) void ensureRollups(s.quarter);
    }
  }, [slots, ensureRollups]);

  useEffect(() => {
    const valid = slots.filter((s) => s.quarter && s.areaKey);
    if (!valid.length) {
      setCols([]);
      return;
    }
    let cancelled = false;
    setLoadingCompare(true);
    (async () => {
      const uniqueQuarters = [...new Set(valid.map((s) => s.quarter))];
      const maps = new Map<string, QuarterRollups>();
      await Promise.all(
        uniqueQuarters.map(async (q) => {
          const bundle = rollupsRef.current[q] ?? (await ensureRollups(q));
          if (bundle) maps.set(q, bundle);
        })
      );
      if (cancelled) return;
      setCols(
        valid.map((s) => {
          const bundle = maps.get(s.quarter);
          const list = s.areaType === "region" ? bundle?.regions : bundle?.countries;
          const data = list?.find((r) => r.key === s.areaKey) ?? null;
          return {
            slotId: s.id,
            quarter: s.quarter,
            areaType: s.areaType,
            areaKey: s.areaKey,
            data,
          };
        })
      );
      setLoadingCompare(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slots, ensureRollups, rollupsByQuarter]);

  const updateSlot = (id: string, patch: Partial<Pick<CompareSlot, "quarter" | "areaType" | "areaKey">>) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        const quarter = patch.quarter ?? s.quarter;
        const areaType = patch.areaType ?? s.areaType;
        const bundle = rollupsByQuarter[quarter];
        const list = areaType === "region" ? bundle?.regions : bundle?.countries;
        if (patch.quarter || patch.areaType) {
          if (!list?.some((r) => r.key === next.areaKey)) {
            next.areaKey = list?.[0]?.key ?? "";
          }
        }
        return next;
      })
    );
  };

  const addSlot = () => {
    if (slots.length >= 5) return;
    const q = slots[0]?.quarter || initialQuarter;
    setSlots((prev) => [...prev, defaultSlot(q, rollupsByQuarter[q], "region")]);
  };

  const removeSlot = (id: string) => {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  };

  const metricHighlights = useMemo(() => {
    const map = new Map<string, { max: number; min: number }>();
    for (const { key } of METRICS) {
      const vals = cols
        .map((c) => c.data?.[key])
        .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      if (!vals.length) continue;
      map.set(key, { max: Math.max(...vals), min: Math.min(...vals) });
    }
    return map;
  }, [cols]);

  const selectCls =
    "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 w-full";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Compare regions & countries"
          subtitle="Build up to 5 columns — any quarter, any region or country — and see movement metrics side by side."
        />
        <button
          type="button"
          onClick={addSlot}
          disabled={slots.length >= 5}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 print:hidden"
        >
          <PlusIcon className="h-4 w-4" />
          Add column ({slots.length}/5)
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4 mb-6 print:hidden">
        <div className="space-y-3">
          {slots.map((slot, i) => {
            const bundle = rollupsByQuarter[slot.quarter];
            const areaOptions =
              slot.areaType === "region" ? bundle?.regions ?? [] : bundle?.countries ?? [];
            return (
              <div
                key={slot.id}
                className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1fr_1.5fr_auto] gap-2 sm:gap-3 items-end"
              >
                <span className="text-xs font-bold text-slate-400 pb-2.5 w-6 tabular-nums">{i + 1}</span>
                <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
                  Quarter
                  <select
                    value={slot.quarter}
                    onChange={(e) => updateSlot(slot.id, { quarter: e.target.value })}
                    className={selectCls}
                  >
                    {quarters.map((q) => (
                      <option key={q.date} value={q.date}>
                        {formatQuarterLabel(q.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
                  Type
                  <select
                    value={slot.areaType}
                    onChange={(e) =>
                      updateSlot(slot.id, { areaType: e.target.value as AreaType })
                    }
                    className={selectCls}
                  >
                    <option value="region">Region</option>
                    <option value="country">Country</option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 col-span-2 sm:col-span-1">
                  {slot.areaType === "region" ? "Region" : "Country"}
                  <select
                    value={slot.areaKey}
                    onChange={(e) => updateSlot(slot.id, { areaKey: e.target.value })}
                    className={selectCls}
                    disabled={!areaOptions.length}
                  >
                    {areaOptions.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 justify-self-end sm:justify-self-auto mb-0.5"
                    aria-label="Remove column"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loadingCompare && !cols.length ? (
        <LoadingBlock />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 w-44 sticky left-0 bg-slate-50">
                  Metric
                </th>
                {cols.map((col) => (
                  <th
                    key={col.slotId}
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-700 min-w-[8rem]"
                  >
                    <span className="block">{formatQuarterLabel(col.quarter)}</span>
                    <span className="block font-normal text-slate-500 truncate max-w-[11rem] ml-auto">
                      {col.areaType === "region" ? "Region · " : "Country · "}
                      {col.areaKey}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METRICS.map(({ key, label, digits = 0 }) => {
                const hl = metricHighlights.get(key);
                return (
                  <tr key={key} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-700 sticky left-0 bg-white">
                      {label}
                    </td>
                    {cols.map((col) => {
                      const raw = col.data?.[key];
                      const val = typeof raw === "number" ? raw : null;
                      const isMax =
                        hl && val != null && cols.length > 1 && val === hl.max && hl.max !== hl.min;
                      return (
                        <td
                          key={`${col.slotId}-${key}`}
                          className={`px-4 py-2.5 text-right tabular-nums ${
                            isMax ? "font-bold text-brand-800 bg-brand-50/50" : "text-slate-800"
                          }`}
                        >
                          {col.data ? fmt(val, digits) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(cols.some((c) => !c.data) || loadingRollups) && (
            <p className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
              {loadingRollups
                ? "Loading area lists…"
                : "Some columns have no data for that quarter and area."}
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function QuarterComparePageLoader() {
  const [quarters, setQuarters] = useState<{ date: string; row_count: number }[]>([]);
  const [initialQuarter, setInitialQuarter] = useState("");
  const [initialRollups, setInitialRollups] = useState<QuarterRollups | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .analyticsQuarters()
      .then(async (q) => {
        const latest = q.latest ?? q.quarters[0]?.date ?? "";
        setQuarters(q.quarters);
        setInitialQuarter(latest);
        if (!latest) return;
        const [regRes, ctyRes] = await Promise.all([
          api.analyticsRollup({ date: latest, level: "region" }),
          api.analyticsRollup({ date: latest, level: "country" }),
        ]);
        setInitialRollups({
          regions: [...regRes.rows].sort((a, b) => a.label.localeCompare(b.label)),
          countries: [...ctyRes.rows].sort((a, b) => a.label.localeCompare(b.label)),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (loading || !initialQuarter) return <LoadingBlock />;

  return (
    <QuarterComparePage
      quarters={quarters}
      initialQuarter={initialQuarter}
      initialRollups={initialRollups}
    />
  );
}
