"use client";

/**
 * Consumed calories vs the daily target (two-series line). Receives already
 * day-shaped rows; `target` may be null on days before a target was available.
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

export interface CaloriesVsTargetRow {
  /** Day label for the X axis. */
  day: string;
  /** Calories consumed that day. */
  consumed: number | null;
  /** Target calories that day (null when no profile target). */
  target: number | null;
}

export function CaloriesVsTargetChart({ rows }: { rows: CaloriesVsTargetRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="Calories consumed versus daily target"
      >
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{ value: "Day", position: "insideBottom", offset: -12, fill: MUTED }}
        />
        <YAxis
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{
            value: "Calories (kcal)",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend />
        <Line
          type="monotone"
          dataKey="consumed"
          name="Consumed (kcal)"
          stroke={seriesColor(0)}
          dot={false}
          strokeWidth={2}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="target"
          name="Target (kcal)"
          stroke={seriesColor(2)}
          strokeDasharray="5 4"
          dot={false}
          strokeWidth={2}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
