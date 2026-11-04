/**
 * Shared Zod schemas for the trainer feature (usable on client and server).
 *
 * Follows the profile feature's convention: enum identifiers mirror the Prisma
 * enums via `as const` *_VALUES arrays, reused here so both the client form and
 * the server actions validate identical shapes. Numeric constraints mirror the
 * Prisma model (WorkoutExercise / ExerciseLog) so a payload that validates here
 * is always persistable.
 */
import { z } from "zod";

import {
  EQUIPMENT_VALUES,
  EXPERIENCE_LEVEL_VALUES,
  GOAL_TYPE_VALUES,
} from "@/features/profile/validation";

export { EQUIPMENT_VALUES, EXPERIENCE_LEVEL_VALUES, GOAL_TYPE_VALUES };

export const MUSCLE_GROUP_VALUES = [
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

export type MuscleGroup = (typeof MUSCLE_GROUP_VALUES)[number];
export type Equipment = (typeof EQUIPMENT_VALUES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_VALUES)[number];
export type GoalType = (typeof GOAL_TYPE_VALUES)[number];

/**
 * Overrides for plan generation. Every field is optional because the generator
 * sources its inputs from the user's saved profile + active goal; these are
 * explicit overrides the UI may offer. `limitations` is a free-text list the
 * generator uses to exclude contraindicated movements.
 */
export const generatePlanSchema = z.object({
  goal: z.enum(GOAL_TYPE_VALUES).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVEL_VALUES).optional(),
  daysPerWeek: z
    .number({ invalid_type_error: "Days per week must be a number." })
    .int("Days per week must be a whole number.")
    .min(1, "Days per week must be at least 1.")
    .max(7, "Days per week cannot exceed 7.")
    .optional(),
  sessionMinutes: z
    .number({ invalid_type_error: "Session minutes must be a number." })
    .int("Session minutes must be a whole number.")
    .min(1, "Session minutes must be at least 1.")
    .max(600, "Session minutes must be 600 or below.")
    .optional(),
  availableEquipment: z.array(z.enum(EQUIPMENT_VALUES)).optional(),
  limitations: z.array(z.string().trim().min(1)).optional(),
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

/** Filters for the read-only exercise catalog listing. */
export const exerciseFilterSchema = z.object({
  muscle: z.enum(MUSCLE_GROUP_VALUES).optional(),
  equipment: z.enum(EQUIPMENT_VALUES).optional(),
  difficulty: z.enum(EXPERIENCE_LEVEL_VALUES).optional(),
});

export type ExerciseFilterInput = z.infer<typeof exerciseFilterSchema>;

/**
 * One logged set. Numeric bounds mirror the ExerciseLog Prisma model:
 * setNumber/reps are positive integers, weightKg is non-negative (0 for
 * bodyweight), rir is a non-negative integer, rpe is 1-10.
 */
export const logEntrySchema = z.object({
  workoutExerciseId: z.string().min(1, "A workout exercise id is required."),
  setNumber: z
    .number({ invalid_type_error: "Set number must be a number." })
    .int("Set number must be a whole number.")
    .min(1, "Set number must be at least 1."),
  reps: z
    .number({ invalid_type_error: "Reps must be a number." })
    .int("Reps must be a whole number.")
    .min(0, "Reps cannot be negative."),
  weightKg: z
    .number({ invalid_type_error: "Weight must be a number." })
    .nonnegative("Weight cannot be negative.")
    .max(1000, "Weight must be 1000 kg or below."),
  rir: z
    .number({ invalid_type_error: "RIR must be a number." })
    .int("RIR must be a whole number.")
    .min(0, "RIR cannot be negative.")
    .max(20, "RIR must be 20 or below.")
    .optional(),
  rpe: z
    .number({ invalid_type_error: "RPE must be a number." })
    .min(1, "RPE must be at least 1.")
    .max(10, "RPE must be 10 or below.")
    .optional(),
});

export type LogEntryInput = z.infer<typeof logEntrySchema>;

/** A logged workout session with at least one set. */
export const logSessionSchema = z.object({
  dayId: z.string().min(1).optional(),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or below.").optional(),
  performedAt: z.coerce.date().optional(),
  entries: z.array(logEntrySchema).min(1, "Log at least one set."),
});

export type LogSessionInput = z.infer<typeof logSessionSchema>;
