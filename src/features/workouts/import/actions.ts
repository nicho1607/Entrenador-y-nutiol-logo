"use server";

/**
 * Server actions for the routine IMPORT feature. Mirrors
 * src/features/trainer/actions.ts: the user id always comes from the session
 * (`getCurrentUser`) — the client never supplies it, and the plan it may have
 * previewed is NEVER trusted. Both actions re-run the existing Zod-validated
 * parser (`importRoutineFromJson` / `importRoutineFromCsv`) server-side on the
 * raw content, and on confirm persist via the existing `saveImportedPlan`
 * transaction. On a successful write the trainer and dashboard routes
 * revalidate so the new plan shows.
 */
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/features/auth/session";
import { saveImportedPlan } from "@/features/trainer/service";
import { importRoutineFromCsv, importRoutineFromJson } from "./importer";
import type { ImportResult } from "./types";

/** Raw, client-supplied import request. The parsed plan is never trusted. */
export interface RoutineImportInput {
  format: "json" | "csv";
  content: string;
}

export interface ParseRoutineActionState {
  status: "idle" | "success" | "error";
  message?: string;
  /** The parser output (plan preview + rejected + importedCount). */
  result?: ImportResult | null;
}

export interface ConfirmImportActionState {
  status: "idle" | "success" | "error";
  message?: string;
  /** The persisted plan id when status is "success". */
  planId?: string;
}

/** Runs the parser for the chosen format on the raw content. */
function parse(input: RoutineImportInput): ImportResult {
  return input.format === "json"
    ? importRoutineFromJson(input.content)
    : importRoutineFromCsv(input.content);
}

/** Summarizes why a parse produced no plan, drawn from the rejected reasons. */
function rejectionMessage(result: ImportResult): string {
  if (result.rejected.length === 0) {
    return "Nothing could be imported from that input.";
  }
  const reasons = result.rejected.map((r) => `Row ${r.index}: ${r.reason}`).join(" ");
  return `Could not import this routine. ${reasons}`;
}

/**
 * Parses the pasted/uploaded routine for PREVIEW only (no write). Returns the
 * full ImportResult so the client can render the normalized plan AND every
 * rejected/unmappable row with its reason.
 */
export async function parseRoutineAction(
  rawInput: RoutineImportInput,
): Promise<ParseRoutineActionState> {
  if (!rawInput.content.trim()) {
    return {
      status: "error",
      message: "Paste a routine or choose a file first.",
      result: null,
    };
  }

  const result = parse(rawInput);

  if (!result.plan) {
    return { status: "error", message: rejectionMessage(result), result };
  }

  return {
    status: "success",
    message: `Previewing ${result.importedCount} exercise${
      result.importedCount === 1 ? "" : "s"
    }.`,
    result,
  };
}

/**
 * Persists the pasted/uploaded routine for the signed-in user. Ownership comes
 * from `getCurrentUser()` (never the client); the parser is RE-RUN server-side
 * on the raw content (the client's previewed plan is never trusted). Rejects
 * when the parser yields no plan, surfacing the rejected reasons.
 */
export async function confirmImportAction(
  rawInput: RoutineImportInput,
): Promise<ConfirmImportActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to import a routine." };
  }

  if (!rawInput.content.trim()) {
    return { status: "error", message: "Paste a routine or choose a file first." };
  }

  const result = parse(rawInput);
  if (!result.plan) {
    return { status: "error", message: rejectionMessage(result) };
  }

  try {
    const planId = await saveImportedPlan(user.id, result.plan);
    revalidatePath("/trainer");
    revalidatePath("/dashboard");
    return { status: "success", message: "Routine imported and saved.", planId };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not save the imported routine. Please try again.";
    return { status: "error", message };
  }
}
