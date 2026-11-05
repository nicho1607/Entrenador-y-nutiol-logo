"use client";

/**
 * Hevy paste (default), link or paste/upload → preview → confirm flow
 * for importing an external routine.
 * Mirrors the native generate-plan-form client pattern: useState + useTransition
 * for pending states, the shared action-state shape for results, role='status'
 * messages, and no fabricated output. The preview and the save both come from
 * the server actions (which RE-RUN the parser on the raw content); this form
 * only holds the raw input and renders what the server returns.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ExerciseListItem } from "@/features/trainer/exercise-list-item";
import { confirmImportAction, parseRoutineAction, type RoutineImportInput } from "./actions";
import { isHevyShareLink } from "./hevy-text";
import type { ImportResult, NormalizedWorkoutPlan, RejectedRow } from "./types";

type Format = "json" | "csv";
type Source = "hevy-text" | "url" | "text";

const fieldClasses =
  "w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ImportRoutineForm() {
  const router = useRouter();
  const [source, setSource] = useState<Source>("hevy-text");
  const [hevyText, setHevyText] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("json");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPreviewing, startPreview] = useTransition();
  const [isSaving, startSave] = useTransition();

  const input: RoutineImportInput =
    source === "hevy-text"
      ? { source, content: hevyText }
      : source === "url"
        ? { source, url }
        : { source, format, content };
  const hasInput =
    source === "hevy-text"
      ? hevyText.trim().length > 0
      : source === "url"
        ? url.trim().length > 0
        : content.trim().length > 0;
  const pastedHevyLink = source === "hevy-text" && isHevyShareLink(hevyText);

  const previewPlan = result?.plan ?? null;

  function resetFeedback() {
    setMessage(null);
    setSaved(false);
  }

  function onSourceChange(next: Source) {
    setSource(next);
    setResult(null);
    resetFeedback();
  }

  function onHevyTextChange(next: string) {
    setHevyText(next);
    setResult(null);
    resetFeedback();
  }

  function onUrlChange(next: string) {
    setUrl(next);
    setResult(null);
    resetFeedback();
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
      {source === "hevy-text" ? (
        <section aria-labelledby="hevy-paste-title" className="flex flex-col gap-5">
          <h2 id="hevy-paste-title" className="text-3xl font-bold">
            Pega tu rutina de Hevy
          </h2>
          <ol className="flex flex-col gap-3 text-sm">
            {[
              "Abre el enlace de tu rutina (hevy.com/routine/…) en el navegador.",
              "Selecciona toda la página con Ctrl+A y cópiala con Ctrl+C. En el móvil, mantén pulsado y elige «Seleccionar todo».",
              "Pégala en el recuadro de abajo.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <span className="pt-1 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2">
            <label htmlFor="hevy-text" className="text-sm font-medium">
              Texto de la rutina
            </label>
            <textarea
              id="hevy-text"
              value={hevyText}
              onChange={(e) => onHevyTextChange(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={"Pecho día 1\nPress de Banca (Barra)\n5 series · 6-12 repeticiones\n…"}
              className={fieldClasses}
            />
            {pastedHevyLink ? (
              <p
                role="status"
                className="rounded-control border border-ring/50 bg-ring/10 px-3 py-2 text-sm"
              >
                Has pegado el enlace. El enlace solo no trae los ejercicios:{" "}
                <a
                  href={hevyText.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-link underline underline-offset-4"
                >
                  abre tu rutina en Hevy
                </a>
                , copia toda la página y pégala aquí en lugar del enlace.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <details className="group rounded-surface border border-border" open={source !== "hevy-text"}>
        <summary className="cursor-pointer rounded-surface px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Otras formas de importar
        </summary>
        <div className="flex flex-col gap-6 border-t border-border p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Origen</legend>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="import-source"
                  value="hevy-text"
                  checked={source === "hevy-text"}
                  onChange={() => onSourceChange("hevy-text")}
                />
                Pegar desde Hevy
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="import-source"
                  value="url"
                  checked={source === "url"}
                  onChange={() => onSourceChange("url")}
                />
                Enlace a un archivo JSON o CSV
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="import-source"
                  value="text"
                  checked={source === "text"}
                  onChange={() => onSourceChange("text")}
                />
                Pegar o subir JSON o CSV
              </label>
            </div>
          </fieldset>

          {source === "hevy-text" ? null : source === "url" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="routine-url" className="text-sm font-medium">
                Enlace de la rutina
              </label>
              <input
                id="routine-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className={fieldClasses}
              />
              <p className="text-xs text-muted-foreground">
                Enlace público https a un JSON o CSV: Google Sheets (compartido como
                &quot;cualquiera con el enlace&quot;), GitHub, Gist, Dropbox u otro archivo directo.
                Detectamos el formato automáticamente.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onPreview} disabled={isPreviewing || !hasInput}>
          {isPreviewing ? "Generando vista previa..." : "Vista previa"}
        </Button>
        {previewPlan && !saved ? (
          <Button type="button" variant="secondary" onClick={onConfirm} disabled={isSaving}>
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
          Aún no hay nada que previsualizar. Pega tu rutina y luego selecciona Vista previa.
        </p>
      ) : null}

      {previewPlan ? <PlanPreview plan={previewPlan} /> : null}

      {result && result.rejected.length > 0 ? <RejectedRows rows={result.rejected} /> : null}
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
              <ul className="mt-4 divide-y divide-border">
                {day.exercises.map((exercise) => (
                  <li key={exercise.order} className="py-4 first:pt-0 last:pb-0">
                    <ExerciseListItem {...exercise}></ExerciseListItem>
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
