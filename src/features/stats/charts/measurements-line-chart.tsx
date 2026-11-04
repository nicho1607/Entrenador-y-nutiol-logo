"use client";

/**
 * Waist / hip / body-fat over time (multi-series line). Receives already-shaped
 * rows; each series field may be null on measurements that didn't record it.
 * Renders null when empty — the page owns the empty state and the adjacent
 * accessible summary.
 */
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BORDER, MUTED, seriesColor } from "../chart-theme";

export interface MeasurementsLineRow {
  /** Date label for the X axis. */
  date: string;
  waistCm: number | null;
  hipCm: number | null;
  bodyFatPct: number | null;
}

interface MeasurementSeries {
  key: keyof MeasurementsLineRow;
  label: string;
  colorIndex: number;
}

const SERIES: MeasurementSeries[] = [
  { key: "waistCm", label: "Waist (cm)", colorIndex: 1 },
  { key: "hipCm", label: "Hip (cm)", colorIndex: 3 },
  { key: "bodyFatPct", label: "Body fat (%)", colorIndex: 4 },
];

export function MeasurementsLineChart({ rows }: { rows: MeasurementsLineRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="Waist, hip and body-fat over time"
      >
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{ value: "Date", position: "insideBottom", offset: -12, fill: MUTED }}
        />
        <YAxis
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{
            value: "cm / %",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend />
        {SERIES.map((s) => (
          <Line
            key={String(s.key)}
            type="monotone"
            dataKey={String(s.key)}
            name={s.label}
            stroke={seriesColor(s.colorIndex)}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
