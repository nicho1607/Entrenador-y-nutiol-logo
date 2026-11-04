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
import { detectRoutineFormat, fetchRoutineFromUrl, RoutineFetchError } from "./fetch-routine";
import { importRoutineFromCsv, importRoutineFromJson } from "./importer";
import type { ImportResult } from "./types";

/**
 * Raw, client-supplied import request: pasted/uploaded text, or a link the
 * server downloads itself. The parsed plan is never trusted.
 */
export type RoutineImportInput =
  { source: "text"; format: "json" | "csv"; content: string } | { source: "url"; url: string };

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

type Loaded = { result: ImportResult } | { error: string };

/**
 * Resolves the raw content (downloading it for a link) and runs the parser.
 * For links the format is inferred from the downloaded text.
 */
async function load(input: RoutineImportInput): Promise<Loaded> {
  let format: "json" | "csv";
  let content: string;

  if (input?.source === "url") {
    if (typeof input.url !== "string" || !input.url.trim()) {
      return { error: "Primero pega el enlace de tu rutina." };
    }
    try {
      content = await fetchRoutineFromUrl(input.url);
    } catch (error) {
      return {
        error:
          error instanceof RoutineFetchError
            ? error.message
            : "No se pudo descargar la rutina desde ese enlace.",
      };
    }
    if (!content.trim()) return { error: "El enlace no contiene ninguna rutina." };
    format = detectRoutineFormat(content);
  } else {
    if (typeof input?.content !== "string" || !input.content.trim()) {
      return { error: "Primero pega una rutina o elige un archivo." };
    }
    content = input.content;
    format = input.format === "csv" ? "csv" : "json";
  }

  return {
    result: format === "json" ? importRoutineFromJson(content) : importRoutineFromCsv(content),
  };
}

/** Summarizes why a parse produced no plan, drawn from the rejected reasons. */
function rejectionMessage(result: ImportResult): string {
  if (result.rejected.length === 0) {
    return "No se pudo importar nada de esa entrada.";
  }
  const reasons = result.rejected.map((r) => `Fila ${r.index}: ${r.reason}`).join(" ");
  return `No se pudo importar esta rutina. ${reasons}`;
}

/**
 * Parses the pasted/uploaded/linked routine for PREVIEW only (no write). Returns the
 * full ImportResult so the client can render the normalized plan AND every
 * rejected/unmappable row with its reason.
 */
export async function parseRoutineAction(
  rawInput: RoutineImportInput,
): Promise<ParseRoutineActionState> {
  // A link preview makes an outbound request, so it needs a session too.
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "error",
      message: "Debes iniciar sesión para importar una rutina.",
      result: null,
    };
  }

  const loaded = await load(rawInput);
  if ("error" in loaded) {
    return { status: "error", message: loaded.error, result: null };
  }
  const { result } = loaded;

  if (!result.plan) {
    return { status: "error", message: rejectionMessage(result), result };
  }

  return {
    status: "success",
    message: `Vista previa de ${result.importedCount} ejercicio${
      result.importedCount === 1 ? "" : "s"
    }.`,
    result,
  };
}

/**
 * Persists the pasted/uploaded/linked routine for the signed-in user. Ownership comes
 * from `getCurrentUser()` (never the client); the parser is RE-RUN server-side
 * on the raw content (the client's previewed plan is never trusted). Rejects
 * when the parser yields no plan, surfacing the rejected reasons.
 */
export async function confirmImportAction(
  rawInput: RoutineImportInput,
): Promise<ConfirmImportActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para importar una rutina." };
  }

  const loaded = await load(rawInput);
  if ("error" in loaded) {
    return { status: "error", message: loaded.error };
  }
  const { result } = loaded;
  if (!result.plan) {
    return { status: "error", message: rejectionMessage(result) };
  }

  try {
    const planId = await saveImportedPlan(user.id, result.plan);
    revalidatePath("/trainer");
    revalidatePath("/dashboard");
    return { status: "success", message: "Rutina importada y guardada.", planId };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo guardar la rutina importada. Inténtalo de nuevo.";
    return { status: "error", message };
  }
}
