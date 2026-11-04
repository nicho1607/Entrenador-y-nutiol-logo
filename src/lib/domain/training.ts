/**
 * Training domain calculations for FitMind AI.
 *
 * Pure and framework-free. The progression rule is deliberately CONSERVATIVE:
 * it never auto-increases load from reps alone. Load only goes up when the
 * target reps were met, the last set still had reps in reserve (RIR >= 2), and
 * the athlete reported good recovery. This avoids pushing users into injury or
 * overtraining.
 *
 * UNITS: weight in kilograms (kg), reps as integer counts. RIR = reps in
 * reserve (0 = taken to failure). RPE = rate of perceived exertion (6-10).
 */
import { type DomainResult, type MuscleGroup, fail, ok } from "./types-training";

export interface VolumeEntry {
  muscle: MuscleGroup;
  sets: number;
  reps: number;
}

/**
 * Training volume per muscle group = sum of (sets * reps) for that muscle.
 * This is a simple rep-volume metric (not tonnage, which would need load).
 */
export function calculateTrainingVolume(
  entries: readonly VolumeEntry[],
): DomainResult<Partial<Record<MuscleGroup, number>>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const e of entries) {
    if (!isNonNegativeInt(e.sets) || !isNonNegativeInt(e.reps)) {
      return fail("INVALID_INPUT", "sets and reps must be non-negative integers.");
    }
    out[e.muscle] = (out[e.muscle] ?? 0) + e.sets * e.reps;
  }
  return ok(out);
}

export type ProgressionAction = "INCREASE" | "HOLD" | "DECREASE";

export interface ProgressionResult {
  action: ProgressionAction;
  nextWeightKg: number;
  rationale: string;
}

/**
 * Suggests the next session's load for one exercise.
 *
 * Decision rules (in order):
 *  1. If achieved reps fell well short of target (< ~60%) -> DECREASE load.
 *  2. If recovery was poor -> HOLD (never progress while under-recovered).
 *  3. If target reps met AND last set had RIR >= 2 -> INCREASE by `stepPct`.
 *  4. Otherwise -> HOLD.
 *
 * `recoveredWell` is REQUIRED: without recovery information we refuse to make
 * a progression call rather than guessing.
 */
export function suggestProgression(input: {
  currentWeightKg: number;
  targetReps: number;
  achievedReps: number;
  lastSetRir: number;
  recoveredWell?: boolean;
  /** Percentage load increase when progressing. Default 2.5%. */
  stepPct?: number;
}): DomainResult<ProgressionResult> {
  const { currentWeightKg, targetReps, achievedReps, lastSetRir } = input;
  const stepPct = input.stepPct ?? 2.5;

  if (!isPositive(currentWeightKg) || !isPositive(targetReps) || achievedReps < 0) {
    return fail("INVALID_INPUT", "weights/reps must be valid non-negative numbers.");
  }
  if (lastSetRir < 0) {
    return fail("INVALID_INPUT", "lastSetRir must be >= 0.");
  }
  if (typeof input.recoveredWell !== "boolean") {
    return fail("MISSING_INPUT", "recoveredWell is required to make a progression decision.");
  }

  // Rule 1: well short of target reps -> reduce load.
  if (achievedReps < targetReps * 0.6) {
    return ok({
      action: "DECREASE",
      nextWeightKg: round(currentWeightKg * (1 - stepPct / 100)),
      rationale: "Achieved reps were well below target; reduce load to rebuild.",
    });
  }

  // Rule 2: poor recovery blocks any progression.
  if (!input.recoveredWell) {
    return ok({
      action: "HOLD",
      nextWeightKg: currentWeightKg,
      rationale: "Recovery was poor; hold load and prioritize recovery.",
    });
  }

  // Rule 3: met target with reps in reserve -> progress.
  if (achievedReps >= targetReps && lastSetRir >= 2) {
    return ok({
      action: "INCREASE",
      nextWeightKg: round(currentWeightKg * (1 + stepPct / 100)),
      rationale: "Target reps met with RIR >= 2 and good recovery; progress load.",
    });
  }

  // Rule 4: default hold.
  return ok({
    action: "HOLD",
    nextWeightKg: currentWeightKg,
    rationale: "Conditions for a load increase not met; hold and consolidate.",
  });
}

export interface PlateauPoint {
  weightKg: number;
  reps: number;
}

export interface PlateauResult {
  isPlateau: boolean;
  /** Estimated 1RM at the start and end of the window. */
  startE1rm: number;
  endE1rm: number;
  improvementPct: number;
}

/**
 * Simple plateau detector over the most recent `windowSize` performances.
 *
 * Uses the Epley estimated one-rep max e1RM = weight * (1 + reps/30) to compare
 * performances at different rep counts on an equal footing. A plateau is
 * flagged when the improvement from the window's first to last point is below
 * `minImprovementPct`.
 */
export function detectPlateau(input: {
  history: readonly PlateauPoint[];
  windowSize: number;
  minImprovementPct: number;
}): DomainResult<PlateauResult> {
  const { history, windowSize, minImprovementPct } = input;
  if (windowSize < 2) {
    return fail("INVALID_INPUT", "windowSize must be at least 2.");
  }
  if (history.length < windowSize) {
    return fail("MISSING_INPUT", "history is shorter than the requested window.");
  }

  const window = history.slice(history.length - windowSize);
  const first = window[0];
  const last = window[window.length - 1];
  if (!first || !last) {
    return fail("MISSING_INPUT", "window endpoints are undefined.");
  }

  const startE1rm = epley(first);
  const endE1rm = epley(last);
  if (startE1rm <= 0) {
    return fail("INVALID_INPUT", "starting estimated 1RM must be positive.");
  }

  const improvementPct = ((endE1rm - startE1rm) / startE1rm) * 100;
  return ok({
    isPlateau: improvementPct < minImprovementPct,
    startE1rm,
    endE1rm,
    improvementPct,
  });
}

function epley(p: PlateauPoint): number {
  return p.weightKg * (1 + p.reps / 30);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function isPositive(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}
