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
    .number({ invalid_type_error: "Los días por semana deben ser un número." })
    .int("Los días por semana deben ser un número entero.")
    .min(1, "Los días por semana deben ser al menos 1.")
    .max(7, "Los días por semana no pueden superar 7.")
    .optional(),
  sessionMinutes: z
    .number({ invalid_type_error: "Los minutos por sesión deben ser un número." })
    .int("Los minutos por sesión deben ser un número entero.")
    .min(1, "Los minutos por sesión deben ser al menos 1.")
    .max(600, "Los minutos por sesión deben ser 600 o menos.")
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
  workoutExerciseId: z.string().min(1, "Se requiere un id de ejercicio de entrenamiento."),
  setNumber: z
    .number({ invalid_type_error: "El número de serie debe ser un número." })
    .int("El número de serie debe ser un número entero.")
    .min(1, "El número de serie debe ser al menos 1."),
  reps: z
    .number({ invalid_type_error: "Las repeticiones deben ser un número." })
    .int("Las repeticiones deben ser un número entero.")
    .min(0, "Las repeticiones no pueden ser negativas."),
  weightKg: z
    .number({ invalid_type_error: "El peso debe ser un número." })
    .nonnegative("El peso no puede ser negativo.")
    .max(1000, "El peso debe ser 1000 kg o menos."),
  rir: z
    .number({ invalid_type_error: "El RIR debe ser un número." })
    .int("El RIR debe ser un número entero.")
    .min(0, "El RIR no puede ser negativo.")
    .max(20, "El RIR debe ser 20 o menos.")
    .optional(),
  rpe: z
    .number({ invalid_type_error: "El RPE debe ser un número." })
    .min(1, "El RPE debe ser al menos 1.")
    .max(10, "El RPE debe ser 10 o menos.")
    .optional(),
});

export type LogEntryInput = z.infer<typeof logEntrySchema>;

/** A logged workout session with at least one set. */
export const logSessionSchema = z.object({
  dayId: z.string().min(1).optional(),
  notes: z.string().trim().max(2000, "Las notas deben tener 2000 caracteres o menos.").optional(),
  performedAt: z.coerce.date().optional(),
  entries: z.array(logEntrySchema).min(1, "Registra al menos una serie."),
});

export type LogSessionInput = z.infer<typeof logSessionSchema>;
