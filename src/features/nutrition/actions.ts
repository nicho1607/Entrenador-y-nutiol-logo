"use server";

/**
 * Server actions for the nutrition feature. The user id always comes from the
 * session (`getCurrentUser`) — the client never supplies it (data-ownership
 * rule). Inputs are re-validated with the shared Zod schemas on the server even
 * when the client already validated. On a successful write the nutrition and
 * dashboard routes revalidate so recomputed values show.
 */
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/features/auth/session";
import {
  addMeal,
  addMealItem,
  createPlan,
  logFood,
  logWater,
  substituteMealItem,
} from "./service";
import {
  addMealItemSchema,
  addMealSchema,
  createPlanSchema,
  logFoodSchema,
  logWaterSchema,
  substituteMealItemSchema,
} from "./validation";

export interface NutritionActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

function collectFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Creates a nutrition plan for the signed-in user. */
export async function createPlanAction(
  rawInput: unknown,
): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to create a plan." };
  }

  const parsed = createPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await createPlan(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Plan created." };
  } catch {
    return { status: "error", message: "Could not create the plan. Please try again." };
  }
}

/** Adds a meal to one of the signed-in user's plans. */
export async function addMealAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to add a meal." };
  }

  const parsed = addMealSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await addMeal(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Meal added." };
  } catch {
    return { status: "error", message: "Could not add the meal. Please try again." };
  }
}

/** Adds a food (by grams) to one of the signed-in user's meals. */
export async function addMealItemAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to add a food." };
  }

  const parsed = addMealItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await addMealItem(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Food added to the meal." };
  } catch {
    return { status: "error", message: "Could not add the food. Please try again." };
  }
}

/** Substitutes the food (and optional quantity) of one of the user's meal items. */
export async function substituteMealItemAction(
  rawInput: unknown,
): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to substitute a food." };
  }

  const parsed = substituteMealItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await substituteMealItem(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Food substituted." };
  } catch {
    return { status: "error", message: "Could not substitute the food. Please try again." };
  }
}

/** Logs a consumed food for the signed-in user. */
export async function logFoodAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to log food." };
  }

  const parsed = logFoodSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await logFood(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Food logged." };
  } catch {
    return { status: "error", message: "Could not log the food. Please try again." };
  }
}

/** Logs a water intake for the signed-in user. */
export async function logWaterAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to log water." };
  }

  const parsed = logWaterSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await logWater(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Water logged." };
  } catch {
    return { status: "error", message: "Could not log water. Please try again." };
  }
}
