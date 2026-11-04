/**
 * Statistics / aggregation domain helpers for FitMind AI (Phase 5).
 *
 * Pure and framework-free: this module imports ONLY from `./types` and holds no
 * Prisma/React/Next dependency so it stays trivially unit-testable. Every
 * function returns a `DomainResult<T>` so callers handle invalid input and
 * empty ranges explicitly rather than receiving a silently-wrong number.
 *
 * These helpers are the foundation the Phase 5 charts and the stats page read
 * from (via the trainer/nutrition services). They REUSE the established domain
 * conventions: the Epley estimated one-rep max (e1RM = weight * (1 + reps/30),
 * the same formula `detectPlateau` in `training.ts` uses) and the same
 * ok()/fail() result contract. Empty inputs are valid, not errors.
 *
 * UNITS: weight in kilograms (kg), reps as integer counts, dates as `Date`,
 * percentages in the 0..100 range.
 */
import { type DomainResult, fail, ok } from "./types";

export type BucketPeriod = "day" | "week" | "month";

/** One grouped bucket: its ISO bucket-start key and the items that fell in it. */
export interface PeriodBucket<T> {
  /** ISO-8601 timestamp of the bucket start (UTC), e.g. the week's Monday. */
  key: string;
  /** The start of the bucket as a Date (UTC midnight of the bucket start). */
  start: Date;
  items: T[];
}

/**
 * Groups timestamped items into 'day' | 'week' | 'month' buckets keyed by the
 * ISO timestamp of the bucket start (UTC), returned in chronological order.
 *
 *  - day:   bucket start = that date at UTC midnight.
 *  - week:  ISO week — bucket start = the Monday of that week at UTC midnight.
 *  - month: bucket start = the 1st of that month at UTC midnight.
 *
 * An empty `items` list is valid and yields `ok([])`. A non-Date / invalid date
 * from `getDate` is INVALID_INPUT.
 */
export function bucketByPeriod<T>(input: {
  items: readonly T[];
  getDate: (item: T) => Date;
  period: BucketPeriod;
}): DomainResult<PeriodBucket<T>[]> {
  const { items, getDate, period } = input;

  const byKey = new Map<string, PeriodBucket<T>>();
  for (const item of items) {
    const date = getDate(item);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return fail("INVALID_INPUT", "getDate must return a valid Date for every item.");
    }
    const start = bucketStart(date, period);
    const key = start.toISOString();
    const existing = byKey.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      byKey.set(key, { key, start, items: [item] });
    }
  }

  const buckets = [...byKey.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
  return ok(buckets);
}

/** UTC bucket-start for a date under the given period. */
function bucketStart(date: Date, period: BucketPeriod): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (period === "day") {
    return new Date(Date.UTC(year, month, day));
  }
  if (period === "month") {
    return new Date(Date.UTC(year, month, 1));
  }
  // ISO week: Monday as the first day. getUTCDay() returns 0 (Sun)..6 (Sat).
  const dow = date.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(year, month, day + mondayOffset));
}

/**
 * Epley estimated one-rep max: e1RM = weightKg * (1 + reps/30). Mirrors the
 * `epley()` helper in `training.ts` (kept as one formula, not re-derived with a
 * different constant). Non-positive / non-finite weight or reps is INVALID_INPUT.
 */
export function estimate1RM(input: {
  weightKg: number;
  reps: number;
}): DomainResult<number> {
  const { weightKg, reps } = input;
  if (!isPositive(weightKg) || !isPositive(reps)) {
    return fail("INVALID_INPUT", "weightKg and reps must be positive finite numbers.");
  }
  return ok(weightKg * (1 + reps / 30));
}

/** One logged set reduced to the fields strength-over-time needs. */
export interface StrengthSet {
  weightKg: number;
  reps: number;
  date: Date;
}

/** The top (max e1RM) set in one time bucket. */
export interface TopSetPoint {
  /** ISO bucket-start key (see bucketByPeriod). */
  key: string;
  start: Date;
  /** Max estimated 1RM across the bucket's sets. */
  e1rm: number;
}

/**
 * Reduces logged {weightKg, reps, date} sets to the maximum estimated 1RM per
 * time bucket, in chronological order. Sets whose e1RM cannot be estimated
 * (non-positive weight/reps) are skipped. A bucket with no estimable set is
 * omitted. Empty input is valid and yields `ok([])`.
 */
export function topSetE1rmOverTime(input: {
  sets: readonly StrengthSet[];
  period: BucketPeriod;
}): DomainResult<TopSetPoint[]> {
  const { sets, period } = input;
  const bucketed = bucketByPeriod({ items: sets, getDate: (s) => s.date, period });
  if (!bucketed.ok) return bucketed;

  const points: TopSetPoint[] = [];
  for (const bucket of bucketed.value) {
    let max = -Infinity;
    for (const set of bucket.items) {
      const e = estimate1RM({ weightKg: set.weightKg, reps: set.reps });
      if (e.ok && e.value > max) max = e.value;
    }
    if (max > -Infinity) {
      points.push({ key: bucket.key, start: bucket.start, e1rm: max });
    }
  }
  return ok(points);
}

/**
 * Program adherence as a percentage: clamp(completed / planned * 100, 0, 100).
 *
 * CONVENTION (what the service passes): `planned` = the active plan's day count
 * summed per ISO week across the range (how many training days were scheduled),
 * and `completed` = the number of distinct session-days actually performed in
 * that same range. When nothing was planned (`planned <= 0`) and nothing was
 * completed, there is nothing to measure, so adherence is the neutral value 0.
 * A negative `completed` is INVALID_INPUT.
 */
export function computeAdherencePct(input: {
  planned: number;
  completed: number;
}): DomainResult<number> {
  const { planned, completed } = input;
  if (!Number.isFinite(planned) || !Number.isFinite(completed) || completed < 0) {
    return fail("INVALID_INPUT", "planned and completed must be finite, completed >= 0.");
  }
  if (planned <= 0) {
    // Nothing scheduled to adhere to -> neutral 0 (documented above).
    return ok(0);
  }
  return ok(clamp((completed / planned) * 100, 0, 100));
}

/** Per-day consumed-vs-target snapshot for target-compliance scoring. */
export interface ComplianceDay {
  consumedCalories: number;
  targetCalories: number;
  consumedProteinG: number;
  targetProteinG: number;
  consumedCarbsG: number;
  targetCarbsG: number;
  consumedFatG: number;
  targetFatG: number;
}

/**
 * Share (0..100) of days that "hit target" within a documented tolerance band.
 *
 * TOLERANCE BAND (documented, conservative): a day counts as on-target when its
 * calories are within +/-10% of the calorie target AND every macro (protein,
 * carbs, fat) is at least 90% of its target. A target of 0 for a macro means
 * that macro imposes no floor (its check passes). Days with a non-positive
 * calorie target are skipped (nothing to compare against). Empty input (or no
 * comparable day) is valid and yields `ok(0)`. Any non-finite number is
 * INVALID_INPUT.
 */
export function computeTargetCompliancePct(input: {
  days: readonly ComplianceDay[];
}): DomainResult<number> {
  const { days } = input;

  let comparable = 0;
  let onTarget = 0;
  for (const d of days) {
    const nums = [
      d.consumedCalories,
      d.targetCalories,
      d.consumedProteinG,
      d.targetProteinG,
      d.consumedCarbsG,
      d.targetCarbsG,
      d.consumedFatG,
      d.targetFatG,
    ];
    if (nums.some((n) => !Number.isFinite(n))) {
      return fail("INVALID_INPUT", "every consumed/target value must be a finite number.");
    }
    if (d.targetCalories <= 0) continue; // no target to compare against
    comparable += 1;

    const caloriesOk =
      Math.abs(d.consumedCalories - d.targetCalories) <= d.targetCalories * 0.1;
    const macroOk = (consumed: number, target: number): boolean =>
      target <= 0 ? true : consumed >= target * 0.9;

    if (
      caloriesOk &&
      macroOk(d.consumedProteinG, d.targetProteinG) &&
      macroOk(d.consumedCarbsG, d.targetCarbsG) &&
      macroOk(d.consumedFatG, d.targetFatG)
    ) {
      onTarget += 1;
    }
  }

  if (comparable === 0) return ok(0);
  return ok((onTarget / comparable) * 100);
}

export type TrendDirection = "UP" | "DOWN" | "FLAT";

export interface PeriodComparison {
  absoluteDelta: number;
  /** Percent change vs `previous`; null when `previous` is 0 (undefined ratio). */
  percentDelta: number | null;
  direction: TrendDirection;
}

/**
 * Period-over-period comparison of a numeric metric. Returns the absolute delta
 * (current - previous), the percent change relative to `previous` (null when
 * `previous` is 0, never Infinity), and a direction. Non-finite inputs are
 * INVALID_INPUT.
 */
export function comparePeriods(input: {
  current: number;
  previous: number;
}): DomainResult<PeriodComparison> {
  const { current, previous } = input;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return fail("INVALID_INPUT", "current and previous must be finite numbers.");
  }
  const absoluteDelta = current - previous;
  const percentDelta = previous === 0 ? null : (absoluteDelta / previous) * 100;
  const direction: TrendDirection =
    absoluteDelta > 0 ? "UP" : absoluteDelta < 0 ? "DOWN" : "FLAT";
  return ok({ absoluteDelta, percentDelta, direction });
}

/** One logged set keyed by exercise, for personal-record detection. */
export interface PrSet {
  exerciseKey: string;
  weightKg: number;
  reps: number;
  date: Date;
}

/** Per-exercise personal records: heaviest load and best estimated 1RM. */
export interface PersonalRecord {
  exerciseKey: string;
  maxWeightKg: number;
  maxE1rm: number;
}

/**
 * Computes per `exerciseKey` the maximum logged `weightKg` and the maximum
 * estimated 1RM (reusing `estimate1RM`). Sets whose e1RM cannot be estimated
 * (non-positive weight/reps) do not contribute to `maxE1rm` but a positive
 * weight still updates `maxWeightKg`. Results are sorted by exerciseKey
 * (ascending). Empty input is valid and yields `ok([])`.
 */
export function personalRecords(
  sets: readonly PrSet[],
): DomainResult<PersonalRecord[]> {
  const byKey = new Map<string, PersonalRecord>();
  for (const set of sets) {
    if (!Number.isFinite(set.weightKg) || !Number.isFinite(set.reps)) {
      return fail("INVALID_INPUT", "every set's weightKg and reps must be finite numbers.");
    }
    const e = estimate1RM({ weightKg: set.weightKg, reps: set.reps });
    const e1rm = e.ok ? e.value : 0;
    const existing = byKey.get(set.exerciseKey);
    if (existing) {
      existing.maxWeightKg = Math.max(existing.maxWeightKg, set.weightKg);
      existing.maxE1rm = Math.max(existing.maxE1rm, e1rm);
    } else {
      byKey.set(set.exerciseKey, {
        exerciseKey: set.exerciseKey,
        maxWeightKg: set.weightKg,
        maxE1rm: e1rm,
      });
    }
  }

  const records = [...byKey.values()].sort((a, b) =>
    a.exerciseKey.localeCompare(b.exerciseKey),
  );
  return ok(records);
}

function isPositive(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
