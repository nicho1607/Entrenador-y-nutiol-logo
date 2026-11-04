/**
 * Types for the routine IMPORT module.
 *
 * The importer maps an external routine (JSON or CSV) into the internal
 * WorkoutPlan / WorkoutDay / WorkoutExercise shape. The documented external
 * format lives in docs/routine-import-format.md.
 */
import { type MuscleGroup } from "@/lib/domain/types-training";

/** Internal normalized shapes the importer produces (framework-free). */
export interface NormalizedWorkoutExercise {
  order: number;
  exerciseName: string;
  primaryMuscle: MuscleGroup;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number | null;
  targetRir: number | null;
}

export interface NormalizedWorkoutDay {
  order: number;
  name: string;
  exercises: NormalizedWorkoutExercise[];
}

export interface NormalizedWorkoutPlan {
  name: string;
  description: string | null;
  days: NormalizedWorkoutDay[];
}

/** A row that could not be mapped is reported rather than silently dropped. */
export interface RejectedRow {
  /** 1-based index into the source rows/entries, for user feedback. */
  index: number;
  raw: unknown;
  reason: string;
}

export interface ImportResult {
  plan: NormalizedWorkoutPlan | null;
  rejected: RejectedRow[];
  /** Number of exercise rows successfully mapped. */
  importedCount: number;
}
