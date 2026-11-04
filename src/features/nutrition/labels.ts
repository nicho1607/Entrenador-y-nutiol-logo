/**
 * Human-readable labels for the nutrition surfaces. Meal-type and food-category
 * wording lives here so every nutrition surface renders identical strings (the
 * profile feature already owns the goal/sex/activity labels, re-exported for any
 * nutrition surface that needs them).
 */
import type { MealType } from "./validation";

export { GOAL_TYPE_LABELS, SEX_LABELS, ACTIVITY_LEVEL_LABELS } from "@/features/profile/labels";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

/**
 * Coarse food-category labels. The catalog stores `category` as a plain string
 * (no Prisma enum), so this map covers the seeded categories and any unknown
 * value falls back to the raw string in the UI.
 */
export const FOOD_CATEGORY_LABELS: Record<string, string> = {
  PROTEIN: "Protein",
  GRAIN: "Grain",
  LEGUME: "Legume",
  FRUIT: "Fruit",
  VEGETABLE: "Vegetable",
  DAIRY: "Dairy",
  FAT: "Fat",
};
