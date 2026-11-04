"use server";

/**
 * Server actions for the trainer feature. The user id always comes from the
 * session (`getCurrentUser`) — the client never supplies it (data-ownership
 * rule). Inputs are re-validated with the shared Zod schemas on the server even
 * when the client already validated. On a successful write the trainer and
 * dashboard routes revalidate so recomputed values show.
 */
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/features/auth/session";
import type { GeneratedPlan } from "@/lib/domain/plan-generator";
import {
  generatePlanForUser,
  logSession,
  savePlan,
} from "./service";
import {
  generatePlanSchema,
  logSessionSchema,
} from "./validation";

export interface TrainerActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface GeneratePlanActionState extends TrainerActionState {
  /** The generated plan when status is "success"; null otherwise. */
  plan?: GeneratedPlan | null;
}

export interface SavePlanActionState extends TrainerActionState {
  /** The persisted plan id when status is "success". */
  planId?: string;
}

export interface LogSessionActionState extends TrainerActionState {
  /** The persisted session id when status is "success". */
  sessionId?: string;
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

/** Generates (but does not save) a plan from the signed-in user's profile. */
export async function generatePlanAction(
  rawInput: unknown = {},
): Promise<GeneratePlanActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para generar un plan." };
  }

  const parsed = generatePlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const result = await generatePlanForUser(user.id, parsed.data);
  if (!result.ok) {
    return { status: "error", message: result.message, plan: null };
  }

  return { status: "success", message: "Plan generado.", plan: result.value };
}

/** Persists a generated plan for the signed-in user. */
export async function savePlanAction(
  generated: GeneratedPlan,
): Promise<SavePlanActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para guardar un plan." };
  }

  try {
    const planId = await savePlan(user.id, generated);
    revalidatePath("/trainer");
    revalidatePath("/dashboard");
    return { status: "success", message: "Plan guardado.", planId };
  } catch {
    return { status: "error", message: "No se pudo guardar el plan. Inténtalo de nuevo." };
  }
}

/** Records a performed workout session for the signed-in user. */
export async function logSessionAction(
  rawInput: unknown,
): Promise<LogSessionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para registrar una sesión." };
  }

  const parsed = logSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    const sessionId = await logSession(user.id, parsed.data);
    revalidatePath("/trainer");
    revalidatePath("/dashboard");
    return { status: "success", message: "Sesión registrada.", sessionId };
  } catch {
    return { status: "error", message: "No se pudo registrar la sesión. Inténtalo de nuevo." };
  }
}
