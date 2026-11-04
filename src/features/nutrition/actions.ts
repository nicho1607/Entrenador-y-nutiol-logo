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
    return { status: "error", message: "Debes iniciar sesión para crear un plan." };
  }

  const parsed = createPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await createPlan(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Plan creado." };
  } catch {
    return { status: "error", message: "No se pudo crear el plan. Inténtalo de nuevo." };
  }
}

/** Adds a meal to one of the signed-in user's plans. */
export async function addMealAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para añadir una comida." };
  }

  const parsed = addMealSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await addMeal(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Comida añadida." };
  } catch {
    return { status: "error", message: "No se pudo añadir la comida. Inténtalo de nuevo." };
  }
}

/** Adds a food (by grams) to one of the signed-in user's meals. */
export async function addMealItemAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para añadir un alimento." };
  }

  const parsed = addMealItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await addMealItem(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Alimento añadido a la comida." };
  } catch {
    return { status: "error", message: "No se pudo añadir el alimento. Inténtalo de nuevo." };
  }
}

/** Substitutes the food (and optional quantity) of one of the user's meal items. */
export async function substituteMealItemAction(
  rawInput: unknown,
): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para sustituir un alimento." };
  }

  const parsed = substituteMealItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await substituteMealItem(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Alimento sustituido." };
  } catch {
    return { status: "error", message: "No se pudo sustituir el alimento. Inténtalo de nuevo." };
  }
}

/** Logs a consumed food for the signed-in user. */
export async function logFoodAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para registrar alimentos." };
  }

  const parsed = logFoodSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await logFood(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Alimento registrado." };
  } catch {
    return { status: "error", message: "No se pudo registrar el alimento. Inténtalo de nuevo." };
  }
}

/** Logs a water intake for the signed-in user. */
export async function logWaterAction(rawInput: unknown): Promise<NutritionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para registrar agua." };
  }

  const parsed = logWaterSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await logWater(user.id, parsed.data);
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Agua registrada." };
  } catch {
    return { status: "error", message: "No se pudo registrar el agua. Inténtalo de nuevo." };
  }
}
