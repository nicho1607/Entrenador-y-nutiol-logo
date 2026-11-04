/**
 * Shared Zod schema for the user profile (usable on client and server).
 *
 * The enum identifiers mirror the Prisma enums (Sex, ActivityLevel,
 * ExperienceLevel, Equipment, GoalType). Keeping them here lets both the client
 * form and the server action validate identical shapes. Nearly every field is
 * optional because the product records only what the user chooses to provide —
 * the only hard requirement for energy math (sex) is still allowed to be absent
 * at the profile level; the domain library surfaces a "missing input" signal
 * downstream rather than forcing data the user does not want to give.
 */
import { z } from "zod";

export const SEX_VALUES = ["MALE", "FEMALE"] as const;

export const ACTIVITY_LEVEL_VALUES = [
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
] as const;

export const EXPERIENCE_LEVEL_VALUES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const EQUIPMENT_VALUES = [
  "BODYWEIGHT",
  "DUMBBELLS",
  "BARBELL",
  "KETTLEBELL",
  "RESISTANCE_BANDS",
  "PULL_UP_BAR",
  "BENCH",
  "CABLE_MACHINE",
  "CARDIO_MACHINE",
  "FULL_GYM",
] as const;

export const GOAL_TYPE_VALUES = [
  "HYPERTROPHY",
  "FAT_LOSS",
  "RECOMPOSITION",
  "WEIGHT_GAIN",
  "STRENGTH",
  "ENDURANCE",
  "MAINTENANCE",
] as const;

/**
 * Parses a comma-separated list into a trimmed string array, dropping blanks.
 * Accepts an already-parsed array too (server payloads).
 */
const commaSeparatedList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [] as string[];
    const parts = Array.isArray(v) ? v : v.split(",");
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
  });

export const profileSchema = z.object({
  // Age in whole years. Adult range only — the energy equations are undefined
  // for children (see domain library assumptions).
  age: z
    .number({ invalid_type_error: "La edad debe ser un número." })
    .int("La edad debe ser un número entero.")
    .min(13, "La edad debe ser de al menos 13.")
    .max(120, "La edad debe ser 120 o menos.")
    .optional(),
  sex: z.enum(SEX_VALUES).optional(),
  weightKg: z
    .number({ invalid_type_error: "El peso debe ser un número." })
    .positive("El peso debe ser un número positivo.")
    .max(500, "El peso debe ser menor que 500 kg.")
    .optional(),
  heightCm: z
    .number({ invalid_type_error: "La altura debe ser un número." })
    .positive("La altura debe ser un número positivo.")
    .max(300, "La altura debe ser menor que 300 cm.")
    .optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVEL_VALUES).optional(),
  goal: z.enum(GOAL_TYPE_VALUES).optional(),
  daysPerWeek: z
    .number({ invalid_type_error: "Los días por semana deben ser un número." })
    .int("Los días por semana deben ser un número entero.")
    .min(0, "Los días por semana no pueden ser negativos.")
    .max(7, "Los días por semana no pueden superar 7.")
    .optional(),
  sessionMinutes: z
    .number({ invalid_type_error: "Los minutos por sesión deben ser un número." })
    .int("Los minutos por sesión deben ser un número entero.")
    .min(0, "Los minutos por sesión no pueden ser negativos.")
    .max(600, "Los minutos por sesión deben ser 600 o menos.")
    .optional(),
  activityLevel: z.enum(ACTIVITY_LEVEL_VALUES).optional(),
  equipment: z.array(z.enum(EQUIPMENT_VALUES)).default([]),
  dietaryPreferences: commaSeparatedList,
  allergies: commaSeparatedList,
  dietaryRestrictions: commaSeparatedList,
  foodBudget: z
    .number({ invalid_type_error: "El presupuesto debe ser un número." })
    .nonnegative("El presupuesto no puede ser negativo.")
    .max(100000, "El presupuesto debe ser 100000 o menos.")
    .optional(),
  // Safety self-report that gates automatic calorie targeting.
  flaggedForProfessionalReview: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type Sex = (typeof SEX_VALUES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVEL_VALUES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVEL_VALUES)[number];
export type Equipment = (typeof EQUIPMENT_VALUES)[number];
export type GoalType = (typeof GOAL_TYPE_VALUES)[number];
