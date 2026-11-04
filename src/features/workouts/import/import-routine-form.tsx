"use client";

/**
 * Paste/upload → preview → confirm flow for importing an external routine.
 * Mirrors the native generate-plan-form client pattern: useState + useTransition
 * for pending states, the shared action-state shape for results, role='status'
 * messages, and no fabricated output. The preview and the save both come from
 * the server actions (which RE-RUN the parser on the raw content); this form
 * only holds the raw input and renders what the server returns.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MUSCLE_GROUP_LABELS } from "@/features/trainer/labels";
import {
  confirmImportAction,
  parseRoutineAction,
  type RoutineImportInput,
} from "./actions";
import type { ImportResult, NormalizedWorkoutPlan, RejectedRow } from "./types";

type Format = "json" | "csv";

export function ImportRoutineForm() {
  const router = useRouter();
  const [format, setFormat] = useState<Format>("json");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPreviewing, startPreview] = useTransition();
  const [isSaving, startSave] = useTransition();

  const input: RoutineImportInput = { format, content };
  const previewPlan = result?.plan ?? null;

  function resetFeedback() {
    setMessage(null);
    setSaved(false);
  }

  function onFormatChange(next: Format) {
    setFormat(next);
    setResult(null);
    resetFeedback();
  }

  function onContentChange(next: string) {
    setContent(next);
    // The previewed result no longer matches the edited input.
    setResult(null);
    resetFeedback();
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onContentChange(text);
  }

  function onPreview() {
    resetFeedback();
    startPreview(async () => {
      const state = await parseRoutineAction(input);
      setResult(state.result ?? null);
      setMessage(state.message ?? null);
    });
  }

  function onConfirm() {
    if (!previewPlan) return;
    resetFeedback();
    startSave(async () => {
      const state = await confirmImportAction(input);
      if (state.status === "success") {
        setSaved(true);
        setMessage(state.message ?? "Rutina importada y guardada.");
        router.refresh();
      } else {
        setMessage(state.message ?? "No se pudo importar la rutina.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Formato</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="import-format"
              value="json"
              checked={format === "json"}
              onChange={() => onFormatChange("json")}
            />
            JSON
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="import-format"
              value="csv"
              checked={format === "csv"}
              onChange={() => onFormatChange("csv")}
            />
            CSV
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="routine-content" className="text-sm font-medium">
          Pega tu rutina en {format.toUpperCase()}
        </label>
        <textarea
          id="routine-content"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={
            format === "json"
              ? '{ "name": "...", "days": [ ... ] }'
              : "planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax,restSeconds,targetRir"
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="routine-file" className="text-sm font-medium">
          …o elige un archivo {format.toUpperCase()}
        </label>
        <input
          id="routine-file"
          type="file"
          accept={format === "json" ? ".json,application/json" : ".csv,text/csv"}
          onChange={onFileChange}
          className="text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onPreview} disabled={isPreviewing || !content.trim()}>
          {isPreviewing ? "Generando vista previa..." : "Vista previa"}
        </Button>
        {previewPlan && !saved ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Confirmar y guardar"}
          </Button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      {!result && !message ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay nada que previsualizar. Pega una rutina o elige un archivo y luego selecciona
          Vista previa.
        </p>
      ) : null}

      {previewPlan ? <PlanPreview plan={previewPlan} /> : null}

      {result && result.rejected.length > 0 ? (
        <RejectedRows rows={result.rejected} />
      ) : null}
    </div>
  );
}

function PlanPreview({ plan }: { plan: NormalizedWorkoutPlan }) {
  return (
    <section aria-label="Vista previa del plan importado" className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        ) : null}
      </div>

      {plan.days.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta rutina no tiene días válidos para previsualizar.
        </p>
      ) : (
        <ol className="flex flex-col gap-5">
          {plan.days.map((day) => (
            <li key={day.order} className="rounded-md border border-border p-4">
              <h4 className="text-sm font-semibold">
                Día {day.order}: {day.name}
              </h4>
              <ul className="mt-3 flex flex-col gap-3">
                {day.exercises.map((exercise) => (
                  <li key={exercise.order} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{exercise.exerciseName}</span>
                      <span className="text-xs text-muted-foreground">
                        {MUSCLE_GROUP_LABELS[exercise.primaryMuscle]} ·{" "}
                        {exercise.sets} × {exercise.repsMin}-{exercise.repsMax} reps
                        {exercise.restSeconds != null
                          ? ` · ${exercise.restSeconds}s de descanso`
                          : ""}
                        {exercise.targetRir != null ? ` · RIR ${exercise.targetRir}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RejectedRows({ rows }: { rows: RejectedRow[] }) {
  return (
    <section
      aria-label="Filas rechazadas"
      className="flex flex-col gap-2 rounded-md border border-border p-4"
    >
      <h4 className="text-sm font-semibold">
        No se {rows.length === 1 ? "pudo" : "pudieron"} importar {rows.length} fila
        {rows.length === 1 ? "" : "s"}
      </h4>
      <p className="text-xs text-muted-foreground">
        Estas filas se omitieron (nunca se descartan en silencio). Corrígelas en tu origen y vuelve
        a previsualizar para incluirlas.
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.index} className="text-xs text-foreground">
            <span className="font-medium">Fila {row.index}:</span>{" "}
            <span className="text-muted-foreground">{row.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
