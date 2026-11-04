/**
 * Human-readable labels for the trainer surfaces. Muscle-group wording lives
 * here (the profile feature already owns the equipment/experience/goal labels,
 * which we re-export so every trainer surface renders identical strings).
 */
import type { MuscleGroup } from "./validation";

export {
  EQUIPMENT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  GOAL_TYPE_LABELS,
} from "@/features/profile/labels";

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  BICEPS: "Biceps",
  TRICEPS: "Triceps",
  QUADS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  CORE: "Core",
  FULL_BODY: "Full body",
  OTHER: "Other",
};
