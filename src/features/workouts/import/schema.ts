/**
 * Zod schemas for the routine import format (shared client/server).
 *
 * See docs/routine-import-format.md for the human-readable spec.
 *
 * JSON format: a single plan object with an array of days, each with an array
 * of exercises. CSV format: one row per exercise, flattened, with day grouping
 * derived from the `day` / `dayName` columns.
 */
import { z } from "zod";

const MUSCLE_GROUPS = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "CORE",
  "FULL_BODY",
  "OTHER",
] as const;

export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);

/** A single exercise as it appears in the external JSON format. */
export const externalExerciseSchema = z
  .object({
    name: z.string().trim().min(1, "exercise name is required"),
    muscle: muscleGroupSchema,
    sets: z.number().int().positive(),
    repsMin: z.number().int().positive(),
    repsMax: z.number().int().positive(),
    restSeconds: z.number().int().nonnegative().nullable().optional(),
    targetRir: z.number().int().nonnegative().nullable().optional(),
  })
  .refine((e) => e.repsMax >= e.repsMin, {
    message: "repsMax must be >= repsMin",
  });

export const externalDaySchema = z.object({
  name: z.string().trim().min(1, "day name is required"),
  order: z.number().int().positive(),
  exercises: z.array(externalExerciseSchema).min(1, "a day needs at least one exercise"),
});

export const externalPlanSchema = z.object({
  name: z.string().trim().min(1, "plan name is required"),
  description: z.string().trim().nullable().optional(),
  days: z.array(externalDaySchema).min(1, "a plan needs at least one day"),
});

export type ExternalPlan = z.infer<typeof externalPlanSchema>;
export type ExternalExercise = z.infer<typeof externalExerciseSchema>;

/**
 * One CSV row (after header mapping). Numbers arrive as strings from CSV so we
 * coerce. Day grouping uses `dayOrder` + `dayName`.
 */
export const csvRowSchema = z
  .object({
    planName: z.string().trim().min(1, "planName is required"),
    dayName: z.string().trim().min(1, "dayName is required"),
    dayOrder: z.coerce.number().int().positive(),
    exerciseName: z.string().trim().min(1, "exerciseName is required"),
    muscle: muscleGroupSchema,
    sets: z.coerce.number().int().positive(),
    repsMin: z.coerce.number().int().positive(),
    repsMax: z.coerce.number().int().positive(),
    restSeconds: z
      .union([z.literal(""), z.coerce.number().int().nonnegative()])
      .transform((v) => (v === "" ? null : v))
      .optional(),
    targetRir: z
      .union([z.literal(""), z.coerce.number().int().nonnegative()])
      .transform((v) => (v === "" ? null : v))
      .optional(),
  })
  .refine((r) => r.repsMax >= r.repsMin, {
    message: "repsMax must be >= repsMin",
  });

export type CsvRow = z.infer<typeof csvRowSchema>;
