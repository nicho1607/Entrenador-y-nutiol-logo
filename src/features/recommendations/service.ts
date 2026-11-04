/**
 * Server-side orchestration for adaptive recommendations (Phase 6).
 *
 * Data ownership: `getRecommendations` takes an explicit `userId` the caller
 * MUST source from the session (`getCurrentUser`), never from client input.
 * Every underlying read is one of the EXISTING userId-scoped trainer /
 * nutrition services — this layer adds NO new query; it only gathers their
 * already-computed outputs into the pure engine's `EngineInput`.
 *
 * It never reimplements training or nutrition math and never fabricates data:
 * when an underlying `DomainResult` fails, the corresponding engine input is
 * mapped to `null` so the engine emits an explicit insufficient-data note
 * rather than guessing. The optional AI seam runs AFTER the rule engine and its
 * items are appended last, so AI can never replace a rule or safety item.
 */
import {
  type EngineInput,
  type ExerciseSignal,
  type NutritionSignal,
  type Recommendation,
  buildRecommendations,
} from "@/lib/domain/recommendations";
import type { MuscleGroup } from "@/lib/domain/types-training";
import {
  getPersonalRecords,
  getProgramAdherence,
  getVolumeByMuscle,
  getExerciseHistory,
} from "@/features/trainer/service";
import {
  getDailyConsumed,
  getNutritionTargets,
  getTargetCompliance,
  type NutritionDateRange,
} from "@/features/nutrition/service";
import { prisma } from "@/server/db";
import { getAiRecommender } from "./ai";

/** The inclusive nutrition date range covering the trailing `days` days. */
function trailingDays(days: number): NutritionDateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from, to };
}

/** The recommendations report surfaced to the page, with a generation stamp. */
export interface RecommendationsResult {
  recommendations: Recommendation[];
  insufficientData: string[];
  /** When the report was generated (server time). */
  generatedAt: Date;
}

/**
 * Resolves a per-exercise plateau/progression signal for the user's most-logged
 * exercises. Reuses `getPersonalRecords` to learn WHICH exercises the user has
 * logged (keyed by catalog name), then `getExerciseHistory` per exercise for
 * the already-computed plateau + progression. Failures map to null so the
 * engine treats them as missing rather than guessing. Scoped to `userId`.
 */
async function gatherExerciseSignals(userId: string): Promise<ExerciseSignal[]> {
  const prs = await getPersonalRecords(userId);
  if (!prs.ok || prs.value.length === 0) return [];

  // Resolve each exercise key to one of the user's OWN WorkoutExercise ids so
  // getExerciseHistory (which is keyed by workoutExerciseId) can be reused.
  const keys = prs.value.map((p) => p.exerciseKey);
  const workoutExercises = await prisma.workoutExercise.findMany({
    where: {
      day: { plan: { userId } },
      exercise: { name: { in: keys } },
    },
    select: { id: true, exercise: { select: { name: true } } },
  });

  // One representative workoutExerciseId per exercise name.
  const idByName = new Map<string, string>();
  for (const we of workoutExercises) {
    if (!idByName.has(we.exercise.name)) idByName.set(we.exercise.name, we.id);
  }

  const signals: ExerciseSignal[] = [];
  for (const key of keys) {
    const workoutExerciseId = idByName.get(key);
    if (!workoutExerciseId) {
      signals.push({ key, plateau: null, progression: null });
      continue;
    }
    const history = await getExerciseHistory(userId, workoutExerciseId);
    signals.push({
      key,
      plateau: history.plateau.ok ? history.plateau.value : null,
      progression: history.progression?.ok ? history.progression.value : null,
    });
  }
  return signals;
}

/**
 * Builds the nutrition signal from the EXISTING nutrition services. The
 * clampedToFloor / professional-review signals come from the profile-derived
 * calorie target (`getNutritionTargets`); the calorie/protein deltas (consumed
 * − target) come from today's `getDailyConsumed` comparison. Returns null when
 * no profile-derived target exists, so the engine emits an insufficient-data
 * note instead of fabricating one.
 */
async function gatherNutritionSignal(userId: string): Promise<NutritionSignal | null> {
  const [targets, daily] = await Promise.all([
    getNutritionTargets(userId),
    getDailyConsumed(userId, new Date()),
  ]);

  const calorieTarget = targets.derived.calorieTarget;
  const professionalReviewRequired =
    !calorieTarget.ok && calorieTarget.reason === "PROFESSIONAL_REVIEW_REQUIRED";

  // Without a usable target (and not a safety gate) there is nothing to advise on.
  if (!calorieTarget.ok && !professionalReviewRequired) {
    return null;
  }

  const clampedToFloor = calorieTarget.ok ? calorieTarget.value.clampedToFloor : false;

  // Delta = consumed − target. The comparison carries `remaining = target −
  // consumed`, so delta = −remaining. Null when the comparison is unavailable.
  let calorieDelta: number | null = null;
  let proteinDeltaG: number | null = null;
  if (daily.comparison.ok) {
    calorieDelta = -daily.comparison.value.calories.remaining;
    proteinDeltaG = -daily.comparison.value.proteinG.remaining;
  }

  return { clampedToFloor, professionalReviewRequired, calorieDelta, proteinDeltaG };
}

/**
 * Gathers every already-computed input the pure engine needs, by REUSING the
 * existing userId-scoped services, runs `buildRecommendations`, then APPENDS the
 * optional AI seam's output (always `basis: 'ai'`, empty while disabled) AFTER
 * the rule/calculation items so AI never replaces a rule or safety item.
 * Scoped to `userId`; no client-supplied id is trusted.
 */
export async function getRecommendations(userId: string): Promise<RecommendationsResult> {
  const range = trailingDays(30);

  const [volume, adherence, compliance, exercises, nutrition] = await Promise.all([
    getVolumeByMuscle(userId),
    getProgramAdherence(userId),
    getTargetCompliance(userId, range),
    gatherExerciseSignals(userId),
    gatherNutritionSignal(userId),
  ]);

  const input: EngineInput = {
    volumeByMuscle: volume.ok
      ? (volume.value as Partial<Record<MuscleGroup, number>>)
      : null,
    adherencePct:
      adherence.adherencePct.ok && adherence.planned > 0
        ? adherence.adherencePct.value
        : null,
    // Map a failed compliance DomainResult to null so the engine emits an
    // insufficient-data note rather than guessing a score.
    targetCompliancePct: compliance.ok ? compliance.value : null,
    exercises,
    nutrition,
  };

  const report = buildRecommendations(input);

  // AI seam runs AFTER the engine and is appended last (never replaces rules).
  const aiItems = await getAiRecommender().generate(input);

  return {
    recommendations: [...report.recommendations, ...aiItems],
    insufficientData: report.insufficientData,
    generatedAt: new Date(),
  };
}
