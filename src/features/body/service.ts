/**
 * Server-side body-composition persistence and read aggregations.
 *
 * Data ownership: every function takes an explicit `userId` the caller MUST
 * source from the session (`getCurrentUser` / `requireUser`), never from client
 * input. Each query is scoped to that id so a user only reads/writes their own
 * `BodyMeasurement` rows.
 *
 * Only the existing `BodyMeasurement` columns are touched (weightKg, bodyFatPct,
 * waistCm, hipCm, measuredAt) — there is no progress-photo column, so no photo
 * storage is invented here. All time-bucketing and period-over-period math is
 * delegated to the pure `@/lib/domain/stats` helpers (FEAT-001); this layer only
 * loads/persists rows and adapts them to those functions.
 */
import { prisma } from "@/server/db";
import {
  type BucketPeriod,
  type PeriodBucket,
  type PeriodComparison,
  bucketByPeriod,
  comparePeriods,
} from "@/lib/domain/stats";
import type { DomainResult } from "@/lib/domain/types";
import type { LogMeasurementInput } from "./validation";

/** An inclusive-start / exclusive-end date range for body-stats queries. */
export interface BodyDateRange {
  /** Lower bound (inclusive). Omit for all-time. */
  from?: Date;
  /** Upper bound (exclusive). Omit for all-time. */
  to?: Date;
}

/** Builds a Prisma datetime filter from a BodyDateRange (undefined when empty). */
function rangeFilter(range?: BodyDateRange): { gte?: Date; lt?: Date } | undefined {
  if (!range || (range.from == null && range.to == null)) return undefined;
  return {
    ...(range.from != null ? { gte: range.from } : {}),
    ...(range.to != null ? { lt: range.to } : {}),
  };
}

/** A serialized body-measurement row as surfaced to the UI. */
export interface BodyMeasurementRow {
  id: string;
  measuredAt: Date;
  weightKg: number | null;
  bodyFatPct: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

/**
 * Records a body measurement for the caller. Scoped to `userId`; only the
 * existing columns are written and `measuredAt` falls back to the Prisma
 * default (now()) when the input omits it. Returns the created row id.
 */
export async function logBodyMeasurement(
  userId: string,
  input: LogMeasurementInput,
): Promise<string> {
  const measurement = await prisma.bodyMeasurement.create({
    data: {
      userId,
      ...(input.weightKg != null ? { weightKg: input.weightKg } : {}),
      ...(input.bodyFatPct != null ? { bodyFatPct: input.bodyFatPct } : {}),
      ...(input.waistCm != null ? { waistCm: input.waistCm } : {}),
      ...(input.hipCm != null ? { hipCm: input.hipCm } : {}),
      ...(input.measuredAt != null ? { measuredAt: input.measuredAt } : {}),
    },
  });
  return measurement.id;
}

/** Loads the caller's own measurements over `range`, oldest first. Scoped to `userId`. */
async function listMeasurements(
  userId: string,
  range?: BodyDateRange,
): Promise<BodyMeasurementRow[]> {
  const measuredAt = rangeFilter(range);
  const rows = await prisma.bodyMeasurement.findMany({
    where: { userId, ...(measuredAt ? { measuredAt } : {}) },
    orderBy: { measuredAt: "asc" },
    select: {
      id: true,
      measuredAt: true,
      weightKg: true,
      bodyFatPct: true,
      waistCm: true,
      hipCm: true,
    },
  });
  return rows;
}

/** One weight data point over time. */
export interface WeightPoint {
  measuredAt: Date;
  weightKg: number;
}

/**
 * The caller's weight history over `range`, oldest first — only measurements
 * that recorded a weight are returned. Scoped to `userId`.
 */
export async function getWeightHistory(
  userId: string,
  range?: BodyDateRange,
): Promise<WeightPoint[]> {
  const rows = await listMeasurements(userId, range);
  const points: WeightPoint[] = [];
  for (const r of rows) {
    if (r.weightKg != null) {
      points.push({ measuredAt: r.measuredAt, weightKg: r.weightKg });
    }
  }
  return points;
}

/** The caller's measurements grouped into period buckets (serializable rows). */
export interface MeasurementHistoryBucket {
  /** ISO bucket-start key (see bucketByPeriod). */
  key: string;
  start: Date;
  measurements: BodyMeasurementRow[];
}

/**
 * The caller's measurement history over `range`, bucketed by `period` (default
 * 'week') via FEAT-001's `bucketByPeriod`. Returns the buckets in chronological
 * order wrapped in a `DomainResult` (bucketing can fail on an invalid date).
 * Scoped to `userId`.
 */
export async function getMeasurementHistory(
  userId: string,
  range?: BodyDateRange,
  period: BucketPeriod = "week",
): Promise<DomainResult<MeasurementHistoryBucket[]>> {
  const rows = await listMeasurements(userId, range);
  const bucketed = bucketByPeriod({
    items: rows,
    getDate: (r) => r.measuredAt,
    period,
  });
  if (!bucketed.ok) return bucketed;

  const buckets: MeasurementHistoryBucket[] = bucketed.value.map(
    (b: PeriodBucket<BodyMeasurementRow>) => ({
      key: b.key,
      start: b.start,
      measurements: b.items,
    }),
  );
  return { ok: true, value: buckets };
}

/** This-month-vs-last-month comparison for one body metric (null when absent). */
export interface BodyMetricComparison {
  /** Mean of the metric across this calendar month's measurements, or null. */
  current: number | null;
  /** Mean of the metric across last calendar month's measurements, or null. */
  previous: number | null;
  /** Period-over-period comparison; present only when both months have data. */
  comparison: DomainResult<PeriodComparison> | null;
}

/** This-month-vs-last-month comparison for the tracked body metrics. */
export interface BodyComparison {
  weightKg: BodyMetricComparison;
  bodyFatPct: BodyMetricComparison;
  waistCm: BodyMetricComparison;
}

/** UTC start of the calendar month `monthsAgo` before the month containing `now`. */
function monthStart(now: Date, monthsAgo: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
}

/** Mean of the defined values of one metric across a set of rows (null when none). */
function meanOf(
  rows: readonly BodyMeasurementRow[],
  pick: (row: BodyMeasurementRow) => number | null,
): number | null {
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const value = pick(row);
    if (value != null) {
      sum += value;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

/** Builds one metric's comparison, delegating the delta math to comparePeriods. */
function compareMetric(
  current: readonly BodyMeasurementRow[],
  previous: readonly BodyMeasurementRow[],
  pick: (row: BodyMeasurementRow) => number | null,
): BodyMetricComparison {
  const currentMean = meanOf(current, pick);
  const previousMean = meanOf(previous, pick);
  const comparison =
    currentMean != null && previousMean != null
      ? comparePeriods({ current: currentMean, previous: previousMean })
      : null;
  return { current: currentMean, previous: previousMean, comparison };
}

/**
 * Compares the caller's this-calendar-month measurements against last calendar
 * month's for weight, body-fat and waist, delegating each metric's delta to
 * FEAT-001's `comparePeriods` (so previous 0 yields a null percentDelta, never
 * Infinity). Months are computed in UTC to match the stats bucketing. Scoped to
 * `userId`.
 */
export async function getBodyComparison(
  userId: string,
  now: Date = new Date(),
): Promise<BodyComparison> {
  const thisMonthStart = monthStart(now, 0);
  const lastMonthStart = monthStart(now, 1);
  const nextMonthStart = monthStart(now, -1);

  const [previousRows, currentRows] = await Promise.all([
    listMeasurements(userId, { from: lastMonthStart, to: thisMonthStart }),
    listMeasurements(userId, { from: thisMonthStart, to: nextMonthStart }),
  ]);

  return {
    weightKg: compareMetric(currentRows, previousRows, (r) => r.weightKg),
    bodyFatPct: compareMetric(currentRows, previousRows, (r) => r.bodyFatPct),
    waistCm: compareMetric(currentRows, previousRows, (r) => r.waistCm),
  };
}
