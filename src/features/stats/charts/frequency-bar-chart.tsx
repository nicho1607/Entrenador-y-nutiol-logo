"use client";

/**
 * Workouts-per-week bar chart. Receives already-aggregated rows (no data
 * fetching here). Renders null when there are no rows — the page supplies the
 * empty-state copy and the accessible text alternative.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BORDER, MUTED, PRIMARY } from "../chart-theme";

export interface FrequencyBarRow {
  /** Short week label for the X axis (e.g. "Mar 4"). */
  week: string;
  /** Number of sessions logged that week. */
  sessions: number;
}

export function FrequencyBarChart({ rows }: { rows: FrequencyBarRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="Workouts logged per week"
      >
        <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="week"
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{ value: "Week", position: "insideBottom", offset: -12, fill: MUTED }}
        />
        <YAxis
          allowDecimals={false}
          stroke={MUTED}
          tick={{ fill: MUTED, fontSize: 12 }}
          label={{
            value: "Sessions (count)",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip
          formatter={(value: number) => [`${value}`, "Sessions"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend />
        <Bar dataKey="sessions" name="Sessions / week" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
