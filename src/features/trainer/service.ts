/**
 * Server-side trainer persistence and generation orchestration.
 *
 * Data ownership: every function that touches user data takes an explicit
 * `userId` that the caller MUST source from the session
 * (`getCurrentUser`/`requireUser`), never from client input. Queries are scoped
 * to that id so a user can only read/write their own plans, sessions and logs.
 * The one exception is `listExercises`: the Exercise catalog is shared,
 * read-only reference data, so it is intentionally NOT user-scoped.
 *
 * The plan-generation math lives entirely in the pure domain engine
 * (`@/lib/domain/plan-generator`) and the volume/plateau/progression math in
 * `@/lib/domain/training`; this layer only loads/persists data and adapts it to
 * those pure functions — it never reimplements the math.
 */
import type { Equipment, ExperienceLevel, MuscleGroup, PlanSource } from "@prisma/client";

import { prisma } from "@/server/db";
import type { NormalizedWorkoutPlan } from "@/features/workouts/import/types";
import {
  type CandidateExercise,
  type GeneratedPlan,
  type GeneratePlanInput as DomainGeneratePlanInput,
  generatePlan,
} from "@/lib/domain/plan-generator";
import {
  type DomainResult,
  type GoalType as DomainGoalType,
  ok,
} from "@/lib/domain/types";
import {
  type PlateauResult,
  type ProgressionResult,
  calculateTrainingVolume,
  detectPlateau,
  suggestProgression,
} from "@/lib/domain/training";
import { logsToVolumeEntries } from "@/lib/domain/volume-adapter";
import {
  type PeriodBucket,
  type PersonalRecord,
  type TopSetPoint,
  bucketByPeriod,
  computeAdherencePct,
  personalRecords,
  topSetE1rmOverTime,
} from "@/lib/domain/stats";
import type { GeneratePlanInput, LogSessionInput } from "./validation";

/** An inclusive-start / exclusive-end date range for stats queries. */
export interface DateRange {
  /** Lower bound (inclusive). Omit for all-time. */
  from?: Date;
  /** Upper bound (exclusive). Omit for "up to now". */
  to?: Date;
}

/** Builds a Prisma datetime filter from a DateRange (undefined when empty). */
function rangeFilter(range?: DateRange): { gte?: Date; lt?: Date } | undefined {
  if (!range || (range.from == null && range.to == null)) return undefined;
  return {
    ...(range.from != null ? { gte: range.from } : {}),
    ...(range.to != null ? { lt: range.to } : {}),
  };
}

/** Filter for the shared, read-only exercise catalog. */
export interface ExerciseFilter {
  muscle?: MuscleGroup;
  equipment?: Equipment;
  difficulty?: ExperienceLevel;
}

/** A catalog row as surfaced to the UI / generator. */
export interface ExerciseView {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  difficulty: ExperienceLevel | null;
  description: string | null;
  instructions: string | null;
  sourceName: string | null;
  sourceLicense: string | null;
}

/**
 * Lists the shared exercise catalog, optionally filtered. NOT user-scoped:
 * `Exercise` is read-only reference data shared across all users.
 */
export async function listExercises(filter?: ExerciseFilter): Promise<ExerciseView[]> {
  const exercises = await prisma.exercise.findMany({
    where: {
      ...(filter?.muscle ? { primaryMuscle: filter.muscle } : {}),
      ...(filter?.equipment ? { equipment: { has: filter.equipment } } : {}),
      ...(filter?.difficulty ? { difficulty: filter.difficulty } : {}),
    },
    orderBy: { name: "asc" },
  });

  return exercises.map((e) => ({
    id: e.id,
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
    difficulty: e.difficulty,
    description: e.description,
    instructions: e.instructions,
    sourceName: e.sourceName,
    sourceLicense: e.sourceLicense,
  }));
}

/**
 * Generates a plan for the caller from their OWN profile + active goal (scoped
 * to `userId`) and the shared catalog. Returns a `DomainResult<GeneratedPlan>`
 * and performs NO database write; `savePlan` persists an accepted plan.
 */
export async function generatePlanForUser(
  userId: string,
  overrides?: GeneratePlanInput,
): Promise<DomainResult<GeneratedPlan>> {
  const [profile, goal, catalog] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.fitnessGoal.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
    listExercises(),
  ]);

  const experienceLevel =
    overrides?.experienceLevel ?? profile?.experienceLevel ?? null;
  const resolvedGoal: DomainGoalType | null = overrides?.goal ?? goal?.type ?? null;
  const daysPerWeek = overrides?.daysPerWeek ?? profile?.daysPerWeek ?? null;
  const sessionMinutes = overrides?.sessionMinutes ?? profile?.sessionMinutes ?? null;
  const availableEquipment = overrides?.availableEquipment ?? profile?.equipment ?? [];

  const missing: string[] = [];
  if (!experienceLevel) missing.push("experience level");
  if (!resolvedGoal) missing.push("a fitness goal");
  if (daysPerWeek == null) missing.push("training days per week");
  if (sessionMinutes == null) missing.push("session length in minutes");
  if (availableEquipment.length === 0) missing.push("available equipment");

  if (
    !experienceLevel ||
    !resolvedGoal ||
    daysPerWeek == null ||
    sessionMinutes == null ||
    availableEquipment.length === 0
  ) {
    return {
      ok: false,
      reason: "MISSING_INPUT",
      message: `Complete your profile first — missing: ${missing.join(", ")}.`,
    };
  }

  const candidates: CandidateExercise[] = catalog.map(toCandidate);

  const input: DomainGeneratePlanInput = {
    experienceLevel,
    goal: resolvedGoal,
    daysPerWeek,
    sessionMinutes,
    availableEquipment,
    limitations: overrides?.limitations,
  };

  return generatePlan(input, candidates);
}

/**
 * Adapts a catalog row to the generator's plain `CandidateExercise`. The
 * generator requires a concrete difficulty and instructions; rows missing
 * either get a safe default (BEGINNER / empty string) so a partially-provenanced
 * row is still schedulable without fabricating data.
 */
function toCandidate(e: ExerciseView): CandidateExercise {
  return {
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
    difficulty: e.difficulty ?? "BEGINNER",
    instructions: e.instructions ?? "",
  };
}

/**
 * The minimal structural shape `persistPlan` needs to write a plan, shared by
 * the native generator's `GeneratedPlan` and the importer's
 * `NormalizedWorkoutPlan`. Only persistence-relevant fields are required; any
 * extra fields on the caller's object (e.g. per-exercise `reason`) are ignored.
 */
interface PersistablePlan {
  name: string;
  description: string | null;
  days: readonly {
    order: number;
    name: string;
    exercises: readonly {
      order: number;
      exerciseName: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number | null;
      targetRir: number | null;
    }[];
  }[];
}

/**
 * Resolves every distinct `exerciseName` in `plan` to its catalog
 * `Exercise.id` and writes WorkoutPlan(source) -> WorkoutDay ->
 * WorkoutExercise in one transaction, scoped to `userId`. The single source of
 * the name-resolution + unresolved-name guard + transactional write for BOTH
 * native and imported plans. Throws if any referenced exercise name is not in
 * the catalog. Returns the created plan id.
 */
async function persistPlan(
  userId: string,
  plan: PersistablePlan,
  source: PlanSource,
): Promise<string> {
  const names = Array.from(
    new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseName))),
  );

  const catalog = await prisma.exercise.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });
  const idByName = new Map(catalog.map((e) => [e.name, e.id]));

  const unresolved = names.filter((n) => !idByName.has(n));
  if (unresolved.length > 0) {
    throw new Error(`Cannot save plan: unknown exercise(s) ${unresolved.join(", ")}.`);
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.workoutPlan.create({
      data: {
        userId,
        name: plan.name,
        description: plan.description,
        source,
      },
    });

    for (const day of plan.days) {
      const createdDay = await tx.workoutDay.create({
        data: { planId: created.id, order: day.order, name: day.name },
      });

      for (const exercise of day.exercises) {
        const exerciseId = idByName.get(exercise.exerciseName)!;
        await tx.workoutExercise.create({
          data: {
            dayId: createdDay.id,
            exerciseId,
            order: exercise.order,
            sets: exercise.sets,
            repsMin: exercise.repsMin,
            repsMax: exercise.repsMax,
            restSeconds: exercise.restSeconds,
            targetRir: exercise.targetRir,
          },
        });
      }
    }

    return created.id;
  });
}

/**
 * Persists an accepted generated plan for the caller. Writes
 * WorkoutPlan(source: NATIVE) -> WorkoutDay -> WorkoutExercise in one
 * transaction, resolving each `exerciseName` to its catalog `Exercise.id` (the
 * same target the routine importer maps into). Scoped to `userId`.
 *
 * Returns the created plan id. Throws if a referenced exercise name is not in
 * the catalog (the generator only emits catalog names, so this guards drift).
 */
export async function savePlan(userId: string, generated: GeneratedPlan): Promise<string> {
  return persistPlan(userId, generated, "NATIVE");
}

/**
 * Persists an IMPORTED routine for the caller, reusing the SAME
 * name-resolution + unresolved-name guard + transactional write as `savePlan`
 * (both delegate to `persistPlan`). The only difference is `source: IMPORTED`.
 * Scoped to `userId`; `plan` is the importer's normalized output.
 *
 * Returns the created plan id. Throws if a referenced exercise name is not in
 * the catalog.
 */
export async function saveImportedPlan(
  userId: string,
  plan: NormalizedWorkoutPlan,
): Promise<string> {
  return persistPlan(userId, plan, "IMPORTED");
}

/** Lists the caller's own plans (newest first), scoped to `userId`. */
export async function listPlans(userId: string) {
  return prisma.workoutPlan.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { days: true } } },
  });
}

/**
 * Loads one of the caller's own plans with its days and exercises. Returns null
 * when the plan does not exist OR is not owned by `userId` (a user can only read
 * their own).
 */
export async function getPlan(userId: string, planId: string) {
  return prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { exercise: true },
          },
        },
      },
    },
  });
}

/**
 * Records a performed workout session for the caller. Creates a WorkoutSession
 * scoped to `userId` plus its ExerciseLog rows. Every `workoutExerciseId` is
 * verified to belong to one of the user's OWN plans before any write; an id the
 * user does not own is rejected (ownership cannot be bypassed via client input).
 *
 * Returns the created session id.
 */
export async function logSession(userId: string, input: LogSessionInput): Promise<string> {
  const exerciseIds = Array.from(new Set(input.entries.map((e) => e.workoutExerciseId)));

  // Verify every referenced WorkoutExercise belongs to a plan owned by userId.
  const owned = await prisma.workoutExercise.findMany({
    where: { id: { in: exerciseIds }, day: { plan: { userId } } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((e) => e.id));
  const foreign = exerciseIds.filter((id) => !ownedIds.has(id));
  if (foreign.length > 0) {
    throw new Error("Cannot log sets for exercises that are not in your own plans.");
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.workoutSession.create({
      data: {
        userId,
        dayId: input.dayId ?? null,
        notes: input.notes ?? null,
        ...(input.performedAt ? { performedAt: input.performedAt } : {}),
      },
    });

    for (const entry of input.entries) {
      await tx.exerciseLog.create({
        data: {
          sessionId: session.id,
          workoutExerciseId: entry.workoutExerciseId,
          setNumber: entry.setNumber,
          reps: entry.reps,
          weightKg: entry.weightKg,
          rir: entry.rir ?? null,
          rpe: entry.rpe ?? null,
        },
      });
    }

    return session.id;
  });
}

/**
 * Lists the caller's most recent workout sessions (newest first), scoped to
 * `userId`. Read-only; used by the dashboard summary. Returns at most `limit`
 * rows (default 5).
 */
export async function listRecentSessions(userId: string, limit = 5) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take: limit,
    select: { id: true, performedAt: true },
  });
}

/** Count of the caller's logged sessions, scoped to `userId`. */
export async function countSessions(userId: string): Promise<number> {
  return prisma.workoutSession.count({ where: { userId } });
}

export interface ExerciseHistoryEntry {
  loggedAt: Date;
  setNumber: number;
  reps: number;
  weightKg: number;
  rir: number | null;
  rpe: number | null;
}

export interface ExerciseHistory {
  entries: ExerciseHistoryEntry[];
  /** Plateau assessment over the logged sets (needs >= 2 points). */
  plateau: DomainResult<PlateauResult>;
  /**
   * Next-load suggestion for the most recent set, deferred entirely to the
   * RIR/recovery-aware domain rule. Null when the latest set lacks an RIR (the
   * domain rule refuses to guess without recovery/RIR information).
   */
  progression: DomainResult<ProgressionResult> | null;
}

/**
 * Returns the caller's logged history for one of their own WorkoutExercises and
 * surfaces plateau detection + a progression suggestion using the EXISTING
 * domain helpers. Scoped to `userId`: logs for an exercise not owned by the
 * user are never returned (the join requires the plan to belong to `userId`).
 */
export async function getExerciseHistory(
  userId: string,
  workoutExerciseId: string,
): Promise<ExerciseHistory> {
  const logs = await prisma.exerciseLog.findMany({
    where: {
      workoutExerciseId,
      workoutExercise: { day: { plan: { userId } } },
    },
    orderBy: { createdAt: "asc" },
    include: { session: { select: { performedAt: true } } },
  });

  const entries: ExerciseHistoryEntry[] = logs.map((l) => ({
    loggedAt: l.session.performedAt,
    setNumber: l.setNumber,
    reps: l.reps,
    weightKg: l.weightKg,
    rir: l.rir,
    rpe: l.rpe,
  }));

  const plateau = detectPlateau({
    history: entries.map((e) => ({ weightKg: e.weightKg, reps: e.reps })),
    windowSize: Math.min(3, Math.max(2, entries.length)),
    minImprovementPct: 1,
  });

  // Defer the load decision to the domain rule; it REQUIRES recovery info, so
  // we only call it when the latest set reported an RIR and skip it otherwise.
  let progression: DomainResult<ProgressionResult> | null = null;
  const last = entries[entries.length - 1];
  if (last && last.rir != null && last.weightKg > 0) {
    progression = suggestProgression({
      currentWeightKg: last.weightKg,
      targetReps: last.reps,
      achievedReps: last.reps,
      lastSetRir: last.rir,
      // Recovery is user-reported per session; absent here, so we withhold a
      // call rather than assume. The domain rule returns MISSING_INPUT.
      recoveredWell: undefined,
    });
  }

  return { entries, plateau, progression };
}

/**
 * Computes the caller's per-muscle training volume over their own logs since
 * `sinceDate` (all-time when omitted). Maps logs -> domain `VolumeEntry[]`
 * (muscle = the exercise's primaryMuscle, sets = 1 per logged set, reps = that
 * set's reps) and defers to the EXISTING `calculateTrainingVolume` for the math.
 * Scoped to `userId`.
 */
export async function getVolumeByMuscle(
  userId: string,
  sinceDate?: Date,
): Promise<DomainResult<Partial<Record<MuscleGroup, number>>>> {
  const logs = await prisma.exerciseLog.findMany({
    where: {
      workoutExercise: { day: { plan: { userId } } },
      ...(sinceDate ? { session: { performedAt: { gte: sinceDate } } } : {}),
    },
    include: {
      workoutExercise: {
        include: { exercise: { select: { primaryMuscle: true } } },
      },
    },
  });

  const entries = logsToVolumeEntries(
    logs.map((l) => ({
      muscle: l.workoutExercise.exercise.primaryMuscle,
      reps: l.reps,
    })),
  );

  return calculateTrainingVolume(entries);
}

// ---------------------------------------------------------------------------
// Phase 5 statistics (read-only, userId-scoped). Each function loads only the
// caller's OWN rows (scoped exactly like getVolumeByMuscle) and defers ALL math
// to the pure domain helpers in @/lib/domain/stats and @/lib/domain/training —
// no formula is reimplemented here.
// ---------------------------------------------------------------------------

/** One ISO week with the caller's session count for that week. */
export interface TrainingFrequencyPoint {
  /** ISO bucket-start key (the week's Monday, UTC midnight). */
  weekKey: string;
  weekStart: Date;
  sessionCount: number;
}

/**
 * Sessions-per-ISO-week for the caller over `range`. Loads the user's OWN
 * WorkoutSession rows (scoped to `userId`), buckets them by ISO week via the
 * pure `bucketByPeriod`, and returns the count per week in chronological order.
 */
export async function getTrainingFrequency(
  userId: string,
  range?: DateRange,
): Promise<DomainResult<TrainingFrequencyPoint[]>> {
  const performedAt = rangeFilter(range);
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, ...(performedAt ? { performedAt } : {}) },
    select: { performedAt: true },
  });

  const bucketed = bucketByPeriod({
    items: sessions,
    getDate: (s) => s.performedAt,
    period: "week",
  });
  if (!bucketed.ok) return bucketed;

  const points: TrainingFrequencyPoint[] = bucketed.value.map(
    (b: PeriodBucket<{ performedAt: Date }>) => ({
      weekKey: b.key,
      weekStart: b.start,
      sessionCount: b.items.length,
    }),
  );
  return ok(points);
}

/** One ISO week with per-muscle rep-volume for that week. */
export interface VolumeOverTimePoint {
  weekKey: string;
  weekStart: Date;
  volumeByMuscle: DomainResult<Partial<Record<MuscleGroup, number>>>;
}

/**
 * Per-ISO-week, per-muscle rep-volume for the caller over `range`. Reuses the
 * exact same ownership join as getVolumeByMuscle (workoutExercise.day.plan.userId),
 * buckets the logged sets by the session's `performedAt` via `bucketByPeriod`,
 * and defers each bucket's math to `logsToVolumeEntries` + `calculateTrainingVolume`.
 */
export async function getVolumeByMuscleOverTime(
  userId: string,
  range?: DateRange,
): Promise<DomainResult<VolumeOverTimePoint[]>> {
  const performedAt = rangeFilter(range);
  const logs = await prisma.exerciseLog.findMany({
    where: {
      workoutExercise: { day: { plan: { userId } } },
      ...(performedAt ? { session: { performedAt } } : {}),
    },
    include: {
      session: { select: { performedAt: true } },
      workoutExercise: {
        include: { exercise: { select: { primaryMuscle: true } } },
      },
    },
  });

  const bucketed = bucketByPeriod({
    items: logs,
    getDate: (l) => l.session.performedAt,
    period: "week",
  });
  if (!bucketed.ok) return bucketed;

  const points: VolumeOverTimePoint[] = bucketed.value.map((b) => ({
    weekKey: b.key,
    weekStart: b.start,
    volumeByMuscle: calculateTrainingVolume(
      logsToVolumeEntries(
        b.items.map((l) => ({
          muscle: l.workoutExercise.exercise.primaryMuscle,
          reps: l.reps,
        })),
      ),
    ),
  }));
  return ok(points);
}

/**
 * Top-set estimated-1RM progression over `range` for one of the caller's
 * exercises. Selection is scoped to the user's OWN logs; pass either the
 * exercise's catalog name (`exerciseKey`) or a specific `workoutExerciseId`.
 * The per-bucket max e1RM is computed entirely by `topSetE1rmOverTime`.
 */
export async function getStrengthProgression(
  userId: string,
  selector: { exerciseKey: string } | { workoutExerciseId: string },
  range?: DateRange,
): Promise<DomainResult<TopSetPoint[]>> {
  const performedAt = rangeFilter(range);
  const logs = await prisma.exerciseLog.findMany({
    where: {
      workoutExercise: {
        day: { plan: { userId } },
        ...("workoutExerciseId" in selector
          ? { id: selector.workoutExerciseId }
          : { exercise: { name: selector.exerciseKey } }),
      },
      ...(performedAt ? { session: { performedAt } } : {}),
    },
    include: { session: { select: { performedAt: true } } },
  });

  return topSetE1rmOverTime({
    sets: logs.map((l) => ({
      weightKg: l.weightKg,
      reps: l.reps,
      date: l.session.performedAt,
    })),
    period: "week",
  });
}

/**
 * Personal records (max weight + max e1RM) per exercise over the caller's OWN
 * logged sets, keyed by the exercise's catalog name. Scoped to `userId`; all
 * selection math is deferred to `personalRecords`.
 */
export async function getPersonalRecords(
  userId: string,
): Promise<DomainResult<PersonalRecord[]>> {
  const logs = await prisma.exerciseLog.findMany({
    where: { workoutExercise: { day: { plan: { userId } } } },
    include: {
      session: { select: { performedAt: true } },
      workoutExercise: { include: { exercise: { select: { name: true } } } },
    },
  });

  return personalRecords(
    logs.map((l) => ({
      exerciseKey: l.workoutExercise.exercise.name,
      weightKg: l.weightKg,
      reps: l.reps,
      date: l.session.performedAt,
    })),
  );
}

export interface ProgramAdherence {
  /** Scheduled training days across the range (active plans' day count per week). */
  planned: number;
  /** Distinct session-days actually performed in the range. */
  completed: number;
  /** clamp(completed / planned * 100, 0, 100) via computeAdherencePct. */
  adherencePct: DomainResult<number>;
}

/**
 * Program adherence for the caller over `range`: the active WorkoutPlan(s)'
 * scheduled day count summed per ISO week vs the distinct session-days actually
 * performed. Both sides are scoped to `userId`; the percentage is computed by
 * the pure `computeAdherencePct`. When no active plan exists, `planned` is 0 and
 * adherence is the documented neutral 0.
 */
export async function getProgramAdherence(
  userId: string,
  range?: DateRange,
): Promise<ProgramAdherence> {
  const performedAt = rangeFilter(range);

  const [activePlans, sessions] = await Promise.all([
    prisma.workoutPlan.findMany({
      where: { userId, isActive: true },
      select: { _count: { select: { days: true } } },
    }),
    prisma.workoutSession.findMany({
      where: { userId, ...(performedAt ? { performedAt } : {}) },
      select: { performedAt: true },
    }),
  ]);

  const daysPerWeek = activePlans.reduce((sum, p) => sum + p._count.days, 0);

  // Group sessions into ISO weeks so "planned" scales with the number of weeks
  // actually covered by the range's logged activity.
  const weekBuckets = bucketByPeriod({
    items: sessions,
    getDate: (s) => s.performedAt,
    period: "week",
  });
  const weekCount = weekBuckets.ok ? weekBuckets.value.length : 0;
  const planned = daysPerWeek * weekCount;

  // Completed = distinct calendar days on which a session was performed.
  const completed = new Set(
    sessions.map((s) => {
      const d = s.performedAt;
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    }),
  ).size;

  return { planned, completed, adherencePct: computeAdherencePct({ planned, completed }) };
}
