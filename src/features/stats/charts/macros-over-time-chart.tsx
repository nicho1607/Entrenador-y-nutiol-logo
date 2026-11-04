"use client";

/**
 * Protein / carbs / fat consumed vs their targets over time (multi-series
 * line). Receives already-shaped day rows carrying one field per macro plus
 * optional per-macro target fields. Renders null when empty — the page owns the
 * empty state and the adjacent accessible summary.
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

export interface MacrosOverTimeRow {
  /** Day label for the X axis. */
  day: string;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
}

interface MacroSeries {
  consumedKey: keyof MacrosOverTimeRow;
  targetKey: keyof MacrosOverTimeRow;
  label: string;
  colorIndex: number;
}

const SERIES: MacroSeries[] = [
  { consumedKey: "proteinG", targetKey: "targetProteinG", label: "Protein", colorIndex: 0 },
  { consumedKey: "carbsG", targetKey: "targetCarbsG", label: "Carbs", colorIndex: 1 },
  { consumedKey: "fatG", targetKey: "targetFatG", label: "Fat", colorIndex: 2 },
];

export function MacrosOverTimeChart({ rows }: { rows: MacrosOverTimeRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 28, left: 8 }}
        aria-label="Macronutrients consumed versus target over time"
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
            value: "Macros (g)",
            angle: -90,
            position: "insideLeft",
            fill: MUTED,
          }}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend />
        {SERIES.map((s) => (
          <Line
            key={String(s.consumedKey)}
            type="monotone"
            dataKey={String(s.consumedKey)}
            name={`${s.label} (g)`}
            stroke={seriesColor(s.colorIndex)}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
        {SERIES.map((s) => (
          <Line
            key={String(s.targetKey)}
            type="monotone"
            dataKey={String(s.targetKey)}
            name={`${s.label} target (g)`}
            stroke={seriesColor(s.colorIndex)}
            strokeDasharray="5 4"
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
