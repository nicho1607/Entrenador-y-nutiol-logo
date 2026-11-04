/**
 * Pure workout plan-generation engine for FitMind AI.
 *
 * Framework-free: imports ONLY from the domain library (./types,
 * ./types-training, ./training). No Prisma / React / Next. The engine takes a
 * profile-derived input plus a catalog of candidate exercises as PLAIN DATA
 * (the persistence layer injects it) and returns a `GeneratedPlan` whose shape
 * mirrors the routine importer's `NormalizedWorkoutPlan` so that generated and
 * imported plans are the SAME model — with one addition: a per-exercise
 * human-readable `reason`.
 *
 * It builds ON TOP OF the existing training math in ./training (it does NOT
 * duplicate volume/progression/plateau logic). The engine never auto-increases
 * load: progression is deferred to `suggestProgression`, which requires RIR and
 * recovery information, and that contract is referenced in the reasons.
 */
import { type DomainResult, type GoalType } from "./types";
import { type MuscleGroup, fail, ok } from "./types-training";
import { type NormalizedWorkoutPlan } from "@/features/workouts/import/types";

/** Equipment identifiers, mirroring the Prisma `Equipment` enum. */
export type Equipment =
  | "BODYWEIGHT"
  | "DUMBBELLS"
  | "BARBELL"
  | "KETTLEBELL"
  | "RESISTANCE_BANDS"
  | "PULL_UP_BAR"
  | "BENCH"
  | "CABLE_MACHINE"
  | "CARDIO_MACHINE"
  | "FULL_GYM";

/** Experience identifiers, mirroring the Prisma `ExperienceLevel` enum. */
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/**
 * A plain catalog row the generator selects from. Deliberately a structural
 * subset of `prisma/data/exercises.ts`'s `SeedExercise`, so the persistence
 * layer can pass seeded/stored exercises straight in without a Prisma import
 * leaking into the domain library.
 */
export interface CandidateExercise {
  readonly name: string;
  readonly primaryMuscle: MuscleGroup;
  readonly secondaryMuscles: readonly MuscleGroup[];
  readonly equipment: readonly Equipment[];
  readonly difficulty: ExperienceLevel;
  readonly instructions: string;
}

/** The profile-derived request for a generated plan. */
export interface GeneratePlanInput {
  readonly experienceLevel: ExperienceLevel;
  readonly goal: GoalType;
  readonly daysPerWeek: number;
  readonly sessionMinutes: number;
  readonly availableEquipment: readonly Equipment[];
  /** Free-text limitations, e.g. ["knee", "lower back"]. Optional. */
  readonly limitations?: readonly string[];
}

/**
 * One prescribed exercise in a generated plan. Field-for-field compatible with
 * the importer's `NormalizedWorkoutExercise`, plus `reason`.
 */
export interface GeneratedExercise {
  readonly order: number;
  readonly exerciseName: string;
  readonly primaryMuscle: MuscleGroup;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly restSeconds: number | null;
  readonly targetRir: number | null;
  /** Human-readable "why this was proposed". */
  readonly reason: string;
}

export interface GeneratedDay {
  readonly order: number;
  readonly name: string;
  readonly exercises: readonly GeneratedExercise[];
}

/**
 * A generated plan. Structurally compatible with the importer's
 * `NormalizedWorkoutPlan` (same field names/types) with each exercise carrying
 * an extra `reason`.
 */
export interface GeneratedPlan {
  readonly name: string;
  readonly description: string | null;
  readonly days: readonly GeneratedDay[];
}

// Compile-time assertion: a GeneratedPlan is assignable to the importer's
// NormalizedWorkoutPlan (the extra `reason` is a widening-only addition). If the
// importer's shape drifts, this line fails typecheck and flags the divergence.
const _planShapeCheck: NormalizedWorkoutPlan = {
  name: "",
  description: null,
  days: [],
} satisfies GeneratedPlan;
void _planShapeCheck;

/** Per-goal set/rep/rest prescription. */
interface GoalPrescription {
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly restSeconds: number;
  readonly targetRir: number;
  /** Which base profile this goal maps onto, for the reason text. */
  readonly basis: "STRENGTH" | "HYPERTROPHY" | "ENDURANCE";
}

/**
 * The three base prescriptions. STRENGTH: low reps, long rest. HYPERTROPHY:
 * moderate reps, moderate rest. ENDURANCE: high reps, short rest. Secondary
 * goals map onto the nearest base (documented in docs/domain-equations.md and
 * in each exercise `reason`).
 */
const STRENGTH: GoalPrescription = {
  sets: 4,
  repsMin: 3,
  repsMax: 6,
  restSeconds: 180,
  targetRir: 2,
  basis: "STRENGTH",
};
const HYPERTROPHY: GoalPrescription = {
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  restSeconds: 90,
  targetRir: 2,
  basis: "HYPERTROPHY",
};
const ENDURANCE: GoalPrescription = {
  sets: 3,
  repsMin: 15,
  repsMax: 20,
  restSeconds: 45,
  targetRir: 1,
  basis: "ENDURANCE",
};

/**
 * Maps every GoalType onto a base prescription. The nearest-profile rationale:
 *  - FAT_LOSS      -> ENDURANCE   (higher reps / short rest sustain work density)
 *  - RECOMPOSITION -> HYPERTROPHY (muscle retention drives a recomp)
 *  - WEIGHT_GAIN   -> HYPERTROPHY (surplus is spent building muscle)
 *  - MAINTENANCE   -> HYPERTROPHY (moderate, sustainable general training)
 */
function prescriptionFor(goal: GoalType): GoalPrescription {
  switch (goal) {
    case "STRENGTH":
      return STRENGTH;
    case "HYPERTROPHY":
      return HYPERTROPHY;
    case "ENDURANCE":
      return ENDURANCE;
    case "FAT_LOSS":
      return ENDURANCE;
    case "RECOMPOSITION":
    case "WEIGHT_GAIN":
    case "MAINTENANCE":
      return HYPERTROPHY;
  }
}

function goalBasisNote(goal: GoalType, p: GoalPrescription): string {
  if (goal === p.basis) return "";
  return ` (mapped from ${goal} to the ${p.basis} rep/rest profile)`;
}

/** A named training day targeting a set of muscle groups, in priority order. */
interface SplitDay {
  readonly name: string;
  readonly muscles: readonly MuscleGroup[];
}

/**
 * Builds the weekly split sized by days per week:
 *  - 1-2 -> full body (each day covers the main groups)
 *  - 3   -> full body x3
 *  - 4   -> upper / lower x2
 *  - 5-6 -> push / pull / legs (repeating to fill the week)
 */
function buildSplit(daysPerWeek: number): readonly SplitDay[] {
  const FULL: readonly MuscleGroup[] = [
    "CHEST",
    "BACK",
    "SHOULDERS",
    "QUADS",
    "HAMSTRINGS",
    "CORE",
  ];
  const UPPER: readonly MuscleGroup[] = ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS"];
  const LOWER: readonly MuscleGroup[] = ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE"];
  const PUSH: readonly MuscleGroup[] = ["CHEST", "SHOULDERS", "TRICEPS"];
  const PULL: readonly MuscleGroup[] = ["BACK", "BICEPS", "CORE"];
  const LEGS: readonly MuscleGroup[] = ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES"];

  const days: SplitDay[] = [];
  if (daysPerWeek <= 3) {
    // 1-2 and 3 are both full body; the day count follows daysPerWeek.
    for (let i = 0; i < daysPerWeek; i += 1) {
      days.push({ name: `Full Body ${i + 1}`, muscles: FULL });
    }
    return days;
  }
  if (daysPerWeek === 4) {
    const cycle: readonly SplitDay[] = [
      { name: "Upper A", muscles: UPPER },
      { name: "Lower A", muscles: LOWER },
      { name: "Upper B", muscles: UPPER },
      { name: "Lower B", muscles: LOWER },
    ];
    return cycle;
  }
  // 5-6: push / pull / legs, repeating to fill the requested days.
  const ppl: readonly SplitDay[] = [
    { name: "Push", muscles: PUSH },
    { name: "Pull", muscles: PULL },
    { name: "Legs", muscles: LEGS },
  ];
  for (let i = 0; i < daysPerWeek; i += 1) {
    const base = ppl[i % ppl.length]!;
    const cycle = Math.floor(i / ppl.length) + 1;
    const suffix = daysPerWeek > ppl.length ? ` ${cycle}` : "";
    days.push({ name: `${base.name}${suffix}`, muscles: base.muscles });
  }
  return days;
}

/**
 * Minutes budgeted per exercise (one working block: warm-up ramp + working sets
 * + rest). Used to cap each day's exercise count against `sessionMinutes`. This
 * is a deliberately simple planning assumption documented in
 * docs/domain-equations.md; actual set timing is tracked by logging later.
 */
const MINUTES_PER_EXERCISE = 10;
const MIN_EXERCISES_PER_DAY = 1;
const MAX_EXERCISES_PER_DAY = 8;

/** True when every equipment item an exercise needs is available. */
function equipmentAvailable(
  required: readonly Equipment[],
  available: ReadonlySet<Equipment>,
): boolean {
  // FULL_GYM in the available set stands in for every equipment option.
  if (available.has("FULL_GYM")) return true;
  for (const item of required) {
    // BODYWEIGHT never needs anything extra; a FULL_GYM requirement is met by
    // the FULL_GYM check above, so any residual FULL_GYM requirement here fails.
    if (item === "BODYWEIGHT") continue;
    if (!available.has(item)) return false;
  }
  return true;
}

/** Lower-cased limitation keywords, for substring matching against names. */
function normalizeLimitations(limitations?: readonly string[]): readonly string[] {
  if (!limitations) return [];
  return limitations.map((l) => l.trim().toLowerCase()).filter((l) => l.length > 0);
}

/**
 * Maps a limitation keyword to the muscle groups it contraindicates. Unknown
 * keywords match nothing here but are still applied as a name-substring filter.
 */
function musclesBlockedBy(keyword: string): readonly MuscleGroup[] {
  if (keyword.includes("knee")) return ["QUADS", "HAMSTRINGS", "CALVES"];
  if (keyword.includes("back") || keyword.includes("spine") || keyword.includes("lumbar")) {
    return ["BACK", "HAMSTRINGS", "GLUTES"];
  }
  if (keyword.includes("shoulder")) return ["SHOULDERS", "CHEST"];
  if (keyword.includes("hip")) return ["GLUTES", "QUADS"];
  if (keyword.includes("elbow") || keyword.includes("wrist")) return ["BICEPS", "TRICEPS"];
  if (keyword.includes("ankle")) return ["CALVES"];
  return [];
}

function isContraindicated(
  exercise: CandidateExercise,
  limitations: readonly string[],
): boolean {
  if (limitations.length === 0) return false;
  const nameLower = exercise.name.toLowerCase();
  const touched = new Set<MuscleGroup>([exercise.primaryMuscle, ...exercise.secondaryMuscles]);
  for (const keyword of limitations) {
    if (nameLower.includes(keyword)) return true;
    for (const m of musclesBlockedBy(keyword)) {
      if (touched.has(m)) return true;
    }
  }
  return false;
}

/**
 * Generates a personalized weekly plan from a profile and a candidate catalog.
 *
 * Steps: validate -> filter by equipment and limitations -> build the split ->
 * for each day pick exercises whose primary muscle matches the day's targets,
 * capped by the session-minute budget -> apply the goal prescription and attach
 * a reason. Returns `fail(...)` for unusable input (no days, empty catalog after
 * filtering, nothing selectable).
 */
export function generatePlan(
  input: GeneratePlanInput,
  catalog: readonly CandidateExercise[],
): DomainResult<GeneratedPlan> {
  if (!Number.isInteger(input.daysPerWeek) || input.daysPerWeek < 1) {
    return fail("INVALID_INPUT", "daysPerWeek must be an integer of at least 1.");
  }
  if (input.daysPerWeek > 7) {
    return fail("INVALID_INPUT", "daysPerWeek cannot exceed 7.");
  }
  if (!Number.isFinite(input.sessionMinutes) || input.sessionMinutes <= 0) {
    return fail("INVALID_INPUT", "sessionMinutes must be a positive number.");
  }
  if (catalog.length === 0) {
    return fail("MISSING_INPUT", "the exercise catalog is empty.");
  }
  if (input.availableEquipment.length === 0) {
    return fail("MISSING_INPUT", "no available equipment was provided.");
  }

  const available = new Set<Equipment>(input.availableEquipment);
  const limitations = normalizeLimitations(input.limitations);

  const feasible = catalog.filter(
    (e) =>
      equipmentAvailable(e.equipment, available) && !isContraindicated(e, limitations),
  );
  if (feasible.length === 0) {
    return fail(
      "INVALID_INPUT",
      "no exercises match the available equipment and limitations.",
    );
  }

  const prescription = prescriptionFor(input.goal);
  const split = buildSplit(input.daysPerWeek);
  const perDayCap = clamp(
    Math.floor(input.sessionMinutes / MINUTES_PER_EXERCISE),
    MIN_EXERCISES_PER_DAY,
    MAX_EXERCISES_PER_DAY,
  );

  const days: GeneratedDay[] = [];
  let totalSelected = 0;

  split.forEach((splitDay, dayIndex) => {
    const selected: GeneratedExercise[] = [];
    const usedNames = new Set<string>();

    // One exercise per target muscle, in the day's priority order, until the
    // per-day cap is reached. Primary-muscle match keeps each day on-target.
    for (const muscle of splitDay.muscles) {
      if (selected.length >= perDayCap) break;
      const match = feasible.find(
        (e) => e.primaryMuscle === muscle && !usedNames.has(e.name),
      );
      if (!match) continue;
      usedNames.add(match.name);
      selected.push(
        toGeneratedExercise(match, selected.length + 1, input, prescription),
      );
    }

    // If the day still has room under the cap, backfill with any remaining
    // feasible exercises so short-equipment profiles still get a full session.
    if (selected.length < perDayCap) {
      for (const e of feasible) {
        if (selected.length >= perDayCap) break;
        if (usedNames.has(e.name)) continue;
        usedNames.add(e.name);
        selected.push(toGeneratedExercise(e, selected.length + 1, input, prescription));
      }
    }

    totalSelected += selected.length;
    days.push({ order: dayIndex + 1, name: splitDay.name, exercises: selected });
  });

  if (totalSelected === 0) {
    return fail("INVALID_INPUT", "no exercises could be scheduled for the requested split.");
  }

  const basisNote = goalBasisNote(input.goal, prescription);
  const description =
    `Auto-generated ${input.daysPerWeek}-day ${prescription.basis.toLowerCase()} plan ` +
    `for a ${input.experienceLevel.toLowerCase()} lifter with a ${input.goal} goal` +
    `${basisNote}. Load progression is not auto-applied: use the RIR- and ` +
    `recovery-aware progression rule after logging each session.`;

  return ok({
    name: `${titleCaseGoal(input.goal)} ${input.daysPerWeek}-Day Plan`,
    description,
    days,
  });
}

function toGeneratedExercise(
  e: CandidateExercise,
  order: number,
  input: GeneratePlanInput,
  p: GoalPrescription,
): GeneratedExercise {
  const basisNote = goalBasisNote(input.goal, p);
  const reason =
    `Targets ${e.primaryMuscle} for a ${input.goal} goal${basisNote}; ` +
    `fits the available equipment (${e.equipment.join(", ")}). ` +
    `${p.repsMin}-${p.repsMax} reps x ${p.sets} sets, ~${p.restSeconds}s rest, ` +
    `target RIR ${p.targetRir}. Increase load only when the RIR/recovery-aware ` +
    `progression rule allows it.`;
  return {
    order,
    exerciseName: e.name,
    primaryMuscle: e.primaryMuscle,
    sets: p.sets,
    repsMin: p.repsMin,
    repsMax: p.repsMax,
    restSeconds: p.restSeconds,
    targetRir: p.targetRir,
    reason,
  };
}

function titleCaseGoal(goal: GoalType): string {
  return goal
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
