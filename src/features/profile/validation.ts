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
    .number({ invalid_type_error: "Age must be a number." })
    .int("Age must be a whole number.")
    .min(13, "Age must be at least 13.")
    .max(120, "Age must be 120 or below.")
    .optional(),
  sex: z.enum(SEX_VALUES).optional(),
  weightKg: z
    .number({ invalid_type_error: "Weight must be a number." })
    .positive("Weight must be a positive number.")
    .max(500, "Weight must be below 500 kg.")
    .optional(),
  heightCm: z
    .number({ invalid_type_error: "Height must be a number." })
    .positive("Height must be a positive number.")
    .max(300, "Height must be below 300 cm.")
    .optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVEL_VALUES).optional(),
  goal: z.enum(GOAL_TYPE_VALUES).optional(),
  daysPerWeek: z
    .number({ invalid_type_error: "Days per week must be a number." })
    .int("Days per week must be a whole number.")
    .min(0, "Days per week cannot be negative.")
    .max(7, "Days per week cannot exceed 7.")
    .optional(),
  sessionMinutes: z
    .number({ invalid_type_error: "Session minutes must be a number." })
    .int("Session minutes must be a whole number.")
    .min(0, "Session minutes cannot be negative.")
    .max(600, "Session minutes must be 600 or below.")
    .optional(),
  activityLevel: z.enum(ACTIVITY_LEVEL_VALUES).optional(),
  equipment: z.array(z.enum(EQUIPMENT_VALUES)).default([]),
  dietaryPreferences: commaSeparatedList,
  allergies: commaSeparatedList,
  dietaryRestrictions: commaSeparatedList,
  foodBudget: z
    .number({ invalid_type_error: "Budget must be a number." })
    .nonnegative("Budget cannot be negative.")
    .max(100000, "Budget must be 100000 or below.")
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
