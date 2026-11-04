"use client";

/**
 * SSR-safe chart wrappers.
 *
 * Recharts measures the DOM and breaks when server-rendered, so every chart is
 * re-exported here through `next/dynamic` with `{ ssr: false }` plus a light
 * loading placeholder. The stats page imports ONLY these wrapped versions, so
 * Recharts never runs on the server and `next build` does not try to
 * server-render chart internals.
 */
import dynamic from "next/dynamic";

/** Shared skeleton shown while a chart's client bundle loads. */
function ChartLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-[260px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground"
    >
      Loading chart…
    </div>
  );
}

export const FrequencyBarChart = dynamic(
  () => import("./frequency-bar-chart").then((m) => m.FrequencyBarChart),
  { ssr: false, loading: ChartLoading },
);

export const VolumeByMuscleChart = dynamic(
  () => import("./volume-by-muscle-chart").then((m) => m.VolumeByMuscleChart),
  { ssr: false, loading: ChartLoading },
);

export const StrengthLineChart = dynamic(
  () => import("./strength-line-chart").then((m) => m.StrengthLineChart),
  { ssr: false, loading: ChartLoading },
);

export const CaloriesVsTargetChart = dynamic(
  () => import("./calories-vs-target-chart").then((m) => m.CaloriesVsTargetChart),
  { ssr: false, loading: ChartLoading },
);

export const MacrosOverTimeChart = dynamic(
  () => import("./macros-over-time-chart").then((m) => m.MacrosOverTimeChart),
  { ssr: false, loading: ChartLoading },
);

export const WeightLineChart = dynamic(
  () => import("./weight-line-chart").then((m) => m.WeightLineChart),
  { ssr: false, loading: ChartLoading },
);

export const MeasurementsLineChart = dynamic(
  () => import("./measurements-line-chart").then((m) => m.MeasurementsLineChart),
  { ssr: false, loading: ChartLoading },
);
