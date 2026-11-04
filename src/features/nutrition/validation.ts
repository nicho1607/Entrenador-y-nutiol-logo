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
  q: z.string().trim().max(120, "El término de búsqueda debe tener 120 caracteres o menos.").optional(),
});

export type FoodFilterInput = z.infer<typeof foodFilterSchema>;

/** Create a nutrition plan. */
export const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Se requiere un nombre de plan.")
    .max(120, "El nombre del plan debe tener 120 caracteres o menos."),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

/** Add a meal to one of the caller's plans. */
export const addMealSchema = z.object({
  planId: z.string().min(1, "Se requiere un id de plan."),
  name: z
    .string()
    .trim()
    .min(1, "Se requiere un nombre de comida.")
    .max(120, "El nombre de la comida debe tener 120 caracteres o menos."),
  type: z.enum(MEAL_TYPE_VALUES),
  order: z
    .number({ invalid_type_error: "El orden debe ser un número." })
    .int("El orden debe ser un número entero.")
    .min(0, "El orden no puede ser negativo.")
    .max(100, "El orden debe ser 100 o menos.")
    .optional(),
});

export type AddMealInput = z.infer<typeof addMealSchema>;

/** Numeric bound for a food portion in grams (mirrors the Float column). */
const quantityG = z
  .number({ invalid_type_error: "La cantidad debe ser un número." })
  .positive("La cantidad debe ser un número positivo.")
  .max(5000, "La cantidad debe ser 5000 g o menos.");

/** Add a food (by grams) to one of the caller's meals. */
export const addMealItemSchema = z.object({
  mealId: z.string().min(1, "Se requiere un id de comida."),
  foodId: z.string().min(1, "Se requiere un id de alimento."),
  quantityG,
});

export type AddMealItemInput = z.infer<typeof addMealItemSchema>;

/** Substitute the food (and optionally the quantity) of one of the caller's meal items. */
export const substituteMealItemSchema = z.object({
  mealItemId: z.string().min(1, "Se requiere un id de elemento de comida."),
  newFoodId: z.string().min(1, "Se requiere un id de alimento de reemplazo."),
  quantityG: quantityG.optional(),
});

export type SubstituteMealItemInput = z.infer<typeof substituteMealItemSchema>;

/** Log a consumed food for the day. */
export const logFoodSchema = z.object({
  foodId: z.string().min(1, "Se requiere un id de alimento."),
  mealType: z.enum(MEAL_TYPE_VALUES),
  quantityG,
});

export type LogFoodInput = z.infer<typeof logFoodSchema>;

/** Log a water intake (millilitres). */
export const logWaterSchema = z.object({
  amountMl: z
    .number({ invalid_type_error: "La cantidad debe ser un número." })
    .positive("La cantidad debe ser un número positivo.")
    .max(10000, "La cantidad debe ser 10000 ml o menos."),
});

export type LogWaterInput = z.infer<typeof logWaterSchema>;
