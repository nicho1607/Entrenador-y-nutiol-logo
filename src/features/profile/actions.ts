"use server";

/**
 * Server action that saves the signed-in user's profile. The user id comes
 * from the session only (the data-ownership rule) — the client never supplies
 * it. Input is validated with the same Zod schema the client uses; on success
 * the profile page revalidates so the recomputed derived values show.
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { saveProfile } from "./service";
import { profileSchema } from "./validation";

export interface ProfileActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function saveProfileAction(
  rawInput: unknown,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to save a profile." };
  }

  const parsed = profileSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    await saveProfile(user.id, parsed.data);
  } catch {
    return { status: "error", message: "Could not save your profile. Please try again." };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { status: "success", message: "Profile saved." };
}
