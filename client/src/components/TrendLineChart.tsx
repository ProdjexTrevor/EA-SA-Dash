import { useMemo } from "react";
import { formatPlaceName } from "../lib/formatPlaceName";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendSeries = {
  key: string;
  name: string;
  color: string;
};

/** Distinct colors for regional comparison lines (one per region). */
export const REGION_LINE_COLORS = [
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#e11d48",
  "#0891b2",
  "#c026d3",
  "#ca8a04",
  "#0d9488",
  "#9333ea",
  "#dc2626",
  "#4f46e5",
];

export function seriesForRegions(regions: string[]): TrendSeries[] {
  return regions.map((region, i) => ({
    key: region,
    name: formatPlaceName(region),
    color: REGION_LINE_COLORS[i % REGION_LINE_COLORS.length],
  }));
}

type Props = {
  data: Record<string, unknown>[];
  indexKey?: string;
  series: TrendSeries[];
  height?: number;
};

/** Recharts needs a fixed pixel width/height — ResponsiveContainer often renders blank lines inside Tremor cards. */
export function TrendLineChart({ data, indexKey = "year_quarter", series, height = 300 }: Props) {
  const chartData = useMemo(
    () =>
      data.map((row) => {
        const out: Record<string, string | number> = {
          [indexKey]: String(row[indexKey] ?? ""),
        };
        for (const s of series) {
          out[s.key] = Number(row[s.key]) || 0;
        }
        return out;
      }),
    [data, indexKey, series]
  );

  const width = useMemo(() => Math.max(520, chartData.length * 56), [chartData.length]);

  if (!chartData.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <LineChart
        width={width}
        height={height}
        data={chartData}
        margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
      >
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
        <XAxis
          dataKey={indexKey}
          tick={{ fontSize: 11, fill: "#475569" }}
          interval={chartData.length > 10 ? Math.floor(chartData.length / 8) : 0}
          angle={chartData.length > 8 ? -35 : 0}
          textAnchor={chartData.length > 8 ? "end" : "middle"}
          height={chartData.length > 8 ? 56 : 30}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#475569" }}
          width={56}
          tickFormatter={(v) => Number(v).toLocaleString()}
          domain={[0, "auto"]}
        />
        <Tooltip
          formatter={(value) => (value != null ? Number(value).toLocaleString() : "—")}
          labelFormatter={(label) => String(label)}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={3}
            dot={{ r: 4, fill: s.color, stroke: "#fff", strokeWidth: 1 }}
            activeDot={{ r: 6, fill: s.color }}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </div>
  );
}
