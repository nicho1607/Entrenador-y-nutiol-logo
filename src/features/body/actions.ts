"use server";

/**
 * Server actions for the body-composition feature. The user id always comes
 * from the session (`getCurrentUser`) — the client never supplies it
 * (data-ownership rule). Input is re-validated with the shared Zod schema on
 * the server even when the client already validated. On a successful write the
 * dashboard and stats routes revalidate so the recomputed charts show.
 */
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/features/auth/session";
import { logBodyMeasurement } from "./service";
import { logMeasurementSchema } from "./validation";

export interface BodyActionState {
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

/** Logs a body measurement for the signed-in user. */
export async function logMeasurementAction(
  rawInput: unknown,
): Promise<BodyActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to log a measurement." };
  }

  const parsed = logMeasurementSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  try {
    await logBodyMeasurement(user.id, parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/stats");
    return { status: "success", message: "Measurement logged." };
  } catch {
    return { status: "error", message: "Could not log the measurement. Please try again." };
  }
}
