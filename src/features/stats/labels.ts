/**
 * Labels for the statistics surfaces. Muscle-group wording is re-exported from
 * the trainer feature so every chart renders identical strings; period labels
 * are added here for the stats axes and summaries.
 */
import type { BucketPeriod } from "@/lib/domain/stats";

export { MUSCLE_GROUP_LABELS } from "@/features/trainer/labels";

/** Human-readable label for a bucketing period. */
export const PERIOD_LABELS: Record<BucketPeriod, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

/** Plural/axis label for a bucketing period (e.g. "per week"). */
export const PERIOD_UNIT_LABELS: Record<BucketPeriod, string> = {
  day: "día",
  week: "semana",
  month: "mes",
};
