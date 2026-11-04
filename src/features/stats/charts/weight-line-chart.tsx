"use client";

/**
 * Body-weight over time (single-series line). Receives already-shaped rows.
 * Renders null when empty — the page owns the empty state and the adjacent
 * accessible summary.
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BORDER, MUTED, PRIMARY } from "../chart-theme";

export interface WeightLineRow {
  /** Date label for the X axis. */
  date: string;
  /** Body weight for that measurement, in kilograms. */
  weightKg: number;
}

export function WeightLineChart({ rows }: { rows: WeightLineRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="Body weight over time"
      >
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{ value: "Date", position: "insideBottom", offset: -12, fill: MUTED }}
        />
        <YAxis
          domain={["auto", "auto"]}
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{
            value: "Weight (kg)",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip
          formatter={(value: number) => [`${value} kg`, "Weight"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="weightKg"
          name="Weight (kg)"
          stroke={PRIMARY}
          dot={{ r: 3 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
