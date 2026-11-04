"use client";

/**
 * Top-set estimated-1RM over time (single-series line). Receives already-shaped
 * rows. Renders null when empty — the page owns the empty state and the
 * adjacent accessible summary.
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

export interface StrengthLineRow {
  /** Week label for the X axis. */
  week: string;
  /** Best estimated 1RM for that week, in kilograms. */
  e1rm: number;
}

export function StrengthLineChart({ rows }: { rows: StrengthLineRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="1RM estimado a lo largo del tiempo"
      >
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
        <XAxis
          dataKey="week"
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{ value: "Semana", position: "insideBottom", offset: -12, fill: MUTED }}
        />
        <YAxis
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{
            value: "1RM estimado (kg)",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip
          formatter={(value: number) => [`${value} kg`, "1RM est."]}
          contentStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="e1rm"
          name="1RM estimado (kg)"
          stroke={PRIMARY}
          dot={{ r: 3 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
