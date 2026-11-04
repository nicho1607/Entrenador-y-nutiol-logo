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
  MALE: "Hombre",
  FEMALE: "Mujer",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentario (poco o nada de ejercicio)",
  LIGHT: "Ligero (1-3 días/semana)",
  MODERATE: "Moderado (3-5 días/semana)",
  ACTIVE: "Activo (6-7 días/semana)",
  VERY_ACTIVE: "Muy activo (entrenamiento intenso / trabajo físico)",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  BEGINNER: "Principiante",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzado",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BODYWEIGHT: "Solo peso corporal",
  DUMBBELLS: "Mancuernas",
  BARBELL: "Barra",
  KETTLEBELL: "Pesa rusa",
  RESISTANCE_BANDS: "Bandas de resistencia",
  PULL_UP_BAR: "Barra de dominadas",
  BENCH: "Banco",
  CABLE_MACHINE: "Máquina de poleas",
  CARDIO_MACHINE: "Máquina de cardio",
  FULL_GYM: "Gimnasio completo",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  HYPERTROPHY: "Hipertrofia muscular",
  FAT_LOSS: "Pérdida de grasa",
  RECOMPOSITION: "Recomposición corporal",
  WEIGHT_GAIN: "Aumento de peso",
  STRENGTH: "Fuerza",
  ENDURANCE: "Resistencia",
  MAINTENANCE: "Mantenimiento",
};
