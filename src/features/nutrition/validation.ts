/**
 * Shared Zod schemas for the nutrition feature (usable on client and server).
 *
 * Follows the trainer/profile convention: enum identifiers mirror the Prisma
 * enums via `as const` *_VALUES arrays, reused here so both the client forms and
 * the server actions validate identical shapes. Numeric constraints mirror the
 * Prisma Float columns (MealItem.quantityG, FoodLog.quantityG, WaterLog.amountMl)
 * so a payload that validates here is always persistable.
 */
import { z } from "zod";

/** Mirrors the Prisma `MealType` enum. */
export const MEAL_TYPE_VALUES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export type MealType = (typeof MEAL_TYPE_VALUES)[number];

/** Filter for the read-only food catalog listing (case-insensitive name search). */
export const foodFilterSchema = z.object({
  q: z.string().trim().max(120, "Search term must be 120 characters or below.").optional(),
});

export type FoodFilterInput = z.infer<typeof foodFilterSchema>;

/** Create a nutrition plan. */
export const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "A plan name is required.")
    .max(120, "Plan name must be 120 characters or below."),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

/** Add a meal to one of the caller's plans. */
export const addMealSchema = z.object({
  planId: z.string().min(1, "A plan id is required."),
  name: z
    .string()
    .trim()
    .min(1, "A meal name is required.")
    .max(120, "Meal name must be 120 characters or below."),
  type: z.enum(MEAL_TYPE_VALUES),
  order: z
    .number({ invalid_type_error: "Order must be a number." })
    .int("Order must be a whole number.")
    .min(0, "Order cannot be negative.")
    .max(100, "Order must be 100 or below.")
    .optional(),
});

export type AddMealInput = z.infer<typeof addMealSchema>;

/** Numeric bound for a food portion in grams (mirrors the Float column). */
const quantityG = z
  .number({ invalid_type_error: "Quantity must be a number." })
  .positive("Quantity must be a positive number.")
  .max(5000, "Quantity must be 5000 g or below.");

/** Add a food (by grams) to one of the caller's meals. */
export const addMealItemSchema = z.object({
  mealId: z.string().min(1, "A meal id is required."),
  foodId: z.string().min(1, "A food id is required."),
  quantityG,
});

export type AddMealItemInput = z.infer<typeof addMealItemSchema>;

/** Substitute the food (and optionally the quantity) of one of the caller's meal items. */
export const substituteMealItemSchema = z.object({
  mealItemId: z.string().min(1, "A meal item id is required."),
  newFoodId: z.string().min(1, "A replacement food id is required."),
  quantityG: quantityG.optional(),
});

export type SubstituteMealItemInput = z.infer<typeof substituteMealItemSchema>;

/** Log a consumed food for the day. */
export const logFoodSchema = z.object({
  foodId: z.string().min(1, "A food id is required."),
  mealType: z.enum(MEAL_TYPE_VALUES),
  quantityG,
});

export type LogFoodInput = z.infer<typeof logFoodSchema>;

/** Log a water intake (millilitres). */
export const logWaterSchema = z.object({
  amountMl: z
    .number({ invalid_type_error: "Amount must be a number." })
    .positive("Amount must be a positive number.")
    .max(10000, "Amount must be 10000 ml or below."),
});

export type LogWaterInput = z.infer<typeof logWaterSchema>;
