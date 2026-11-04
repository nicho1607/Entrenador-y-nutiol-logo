/**
 * Human-readable labels for the profile enums. Kept beside the feature so the
 * form, the summary card, and any future surface render the same wording. The
 * keys mirror the Prisma / Zod enum identifiers exactly.
 */
import type {
  ActivityLevel,
  Equipment,
  ExperienceLevel,
  GoalType,
  Sex,
} from "./validation";

export const SEX_LABELS: Record<Sex, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentary (little or no exercise)",
  LIGHT: "Light (1-3 days/week)",
  MODERATE: "Moderate (3-5 days/week)",
  ACTIVE: "Active (6-7 days/week)",
  VERY_ACTIVE: "Very active (hard training / physical job)",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BODYWEIGHT: "Bodyweight only",
  DUMBBELLS: "Dumbbells",
  BARBELL: "Barbell",
  KETTLEBELL: "Kettlebell",
  RESISTANCE_BANDS: "Resistance bands",
  PULL_UP_BAR: "Pull-up bar",
  BENCH: "Bench",
  CABLE_MACHINE: "Cable machine",
  CARDIO_MACHINE: "Cardio machine",
  FULL_GYM: "Full gym",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  HYPERTROPHY: "Muscle hypertrophy",
  FAT_LOSS: "Fat loss",
  RECOMPOSITION: "Body recomposition",
  WEIGHT_GAIN: "Weight gain",
  STRENGTH: "Strength",
  ENDURANCE: "Endurance",
  MAINTENANCE: "Maintenance",
};
