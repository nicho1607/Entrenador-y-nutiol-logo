"use client";

/**
 * Per-muscle rep-volume over time (multi-series line chart). Receives rows that
 * already carry one numeric field per muscle series plus the list of series
 * keys/labels. Renders null when there are no rows; the page owns the empty
 * state and the adjacent accessible summary.
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

/** One week row: a `week` label plus one numeric field per muscle series key. */
export type VolumeByMuscleRow = { week: string } & Record<string, number | string>;

export interface VolumeSeries {
  /** Data key present on each row. */
  key: string;
  /** Human-readable muscle label for the legend. */
  label: string;
}

export function VolumeByMuscleChart({
  rows,
  series,
}: {
  rows: VolumeByMuscleRow[];
  series: VolumeSeries[];
}) {
  if (rows.length === 0 || series.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="Weekly rep-volume by muscle group"
      >
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
        <XAxis
          dataKey="week"
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{ value: "Week", position: "insideBottom", offset: -12, fill: MUTED }}
        />
        <YAxis
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{
            value: "Volume (reps)",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(i)}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
