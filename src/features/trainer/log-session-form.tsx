"use client";

/**
 * Workout logging form. Mirrors the profile-form client pattern (useTransition,
 * client-side Zod validation, the shared action-state result). The user picks
 * one of their OWN workout exercises (passed in from the server, already scoped
 * to their id) and logs per-set weight/reps and an optional RIR or RPE. The
 * server action re-validates and the service re-verifies ownership, so this
 * form is a convenience layer, not the trust boundary.
 *
 * Alongside the form it shows the selected exercise's demo animation and weight
 * history, warns as soon as a typed weight beats the previous best, and
 * announces the records the server confirms after saving.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WeightRecord } from "@/lib/domain/weight-records";
import { logSessionAction } from "./actions";
import { ExerciseAnimation } from "./exercise-animation";
import type { ExerciseWeightLog } from "./service";
import { logSessionSchema } from "./validation";

/** A selectable workout exercise option, flattened from the user's plans. */
export interface WorkoutExerciseOption {
  workoutExerciseId: string;
  label: string;
  /** Catalog exercise name; keys the demo animation and the weight log. */
  exerciseName: string;
}

interface SetRow {
  setNumber: string;
  reps: string;
  weightKg: string;
  rir: string;
  rpe: string;
}

function emptyRow(setNumber: number): SetRow {
  return { setNumber: String(setNumber), reps: "", weightKg: "", rir: "", rpe: "" };
}

const selectClasses =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

export function LogSessionForm({
  options,
  weightLog,
}: {
  options: WorkoutExerciseOption[];
  weightLog: Record<string, ExerciseWeightLog>;
}) {
  const router = useRouter();
  const [workoutExerciseId, setWorkoutExerciseId] = useState(options[0]?.workoutExerciseId ?? "");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SetRow[]>([emptyRow(1)]);
  const [message, setMessage] = useState<string | null>(null);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [isPending, startTransition] = useTransition();

  function num(v: string): number | undefined {
    const t = v.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  }

  const selected = options.find((o) => o.workoutExerciseId === workoutExerciseId);
  const history = selected ? weightLog[selected.exerciseName] : undefined;
  const typedMax = Math.max(-Infinity, ...rows.map((r) => num(r.weightKg) ?? -Infinity));
  const beatsBest = history != null && typedMax > history.bestWeightKg;

  function updateRow(index: number, key: keyof SetRow, value: string) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow(rs.length + 1)]);
  }

  function removeRow(index: number) {
    setRows((rs) =>
      rs.filter((_, i) => i !== index).map((r, i) => ({ ...r, setNumber: String(i + 1) })),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setRecords([]);

    const payload = {
      notes: notes.trim() === "" ? undefined : notes,
      entries: rows.map((r) => ({
        workoutExerciseId,
        setNumber: num(r.setNumber),
        reps: num(r.reps),
        weightKg: num(r.weightKg),
        rir: num(r.rir),
        rpe: num(r.rpe),
      })),
    };

    const parsed = logSessionSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Corrige los campos resaltados.");
      return;
    }

    startTransition(async () => {
      const result = await logSessionAction(parsed.data);
      if (result.status === "success") {
        setMessage("Sesión registrada.");
        setRecords(result.records ?? []);
        setRows([emptyRow(1)]);
        setNotes("");
        router.refresh();
      } else {
        setMessage(result.message ?? "No se pudo registrar la sesión.");
      }
    });
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no tienes planes guardados, así que no hay ejercicios sobre los que registrar. Genera y
        guarda un plan primero en la{" "}
        <a href="/trainer" className="underline underline-offset-4">
          página del entrenador
        </a>
        .
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="workoutExerciseId" className="text-sm font-medium">
          Ejercicio
        </label>
        <select
          id="workoutExerciseId"
          className={selectClasses}
          value={workoutExerciseId}
          onChange={(e) => {
            setWorkoutExerciseId(e.target.value);
            setRecords([]);
          }}
        >
          {options.map((o) => (
            <option key={o.workoutExerciseId} value={o.workoutExerciseId}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <ExerciseAnimation exerciseName={selected.exerciseName} className="sm:w-48" />
          <WeightHistory history={history} />
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Series</legend>
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-5">
            <Field id={`set-${index}`} label="Serie">
              <Input
                id={`set-${index}`}
                type="number"
                inputMode="numeric"
                min={1}
                value={row.setNumber}
                onChange={(e) => updateRow(index, "setNumber", e.target.value)}
              />
            </Field>
            <Field id={`reps-${index}`} label="Repeticiones">
              <Input
                id={`reps-${index}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={row.reps}
                onChange={(e) => updateRow(index, "reps", e.target.value)}
              />
            </Field>
            <Field id={`weight-${index}`} label="Peso (kg)">
              <Input
                id={`weight-${index}`}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                value={row.weightKg}
                onChange={(e) => updateRow(index, "weightKg", e.target.value)}
              />
            </Field>
            <Field id={`rir-${index}`} label="RIR (opcional)">
              <Input
                id={`rir-${index}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={row.rir}
                onChange={(e) => updateRow(index, "rir", e.target.value)}
              />
            </Field>
            <Field id={`rpe-${index}`} label="RPE (opcional)">
              <Input
                id={`rpe-${index}`}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={1}
                max={10}
                value={row.rpe}
                onChange={(e) => updateRow(index, "rpe", e.target.value)}
              />
            </Field>
            {rows.length > 1 ? (
              <div className="sm:col-span-5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeRow(index)}
                  aria-label={`Eliminar serie ${index + 1}`}
                >
                  Eliminar serie
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" onClick={addRow}>
            Añadir otra serie
          </Button>
        </div>
      </fieldset>

      {beatsBest && history ? (
        <p
          role="alert"
          className="rounded-md border border-caution/60 bg-caution/10 px-3 py-2 text-sm text-foreground"
        >
          ⚠️ Estás superando tu mejor peso en este ejercicio: {formatKg(typedMax)} frente a{" "}
          {formatKg(history.bestWeightKg)}. Comprueba la técnica y el calentamiento.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notas (opcional)
        </label>
        <Input id="notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      {records.length > 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-record/70 bg-record/10 px-3 py-2 text-sm text-foreground"
        >
          <p className="font-semibold">
            🏆 ¡Nuevo récord de peso{records.length === 1 ? "" : "s"}!
          </p>
          <ul className="flex flex-col gap-0.5">
            {records.map((r) => (
              <li key={r.exerciseKey}>
                {r.exerciseKey}: {formatKg(r.newBestKg)}{" "}
                <span className="text-muted-foreground">
                  (antes {formatKg(r.previousBestKg)}, +{formatKg(r.newBestKg - r.previousBestKg)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando..." : "Registrar sesión"}
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function formatKg(kg: number): string {
  return `${Number(kg.toFixed(2))} kg`;
}

function WeightHistory({ history }: { history: ExerciseWeightLog | undefined }) {
  if (!history) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no has registrado pesos para este ejercicio. Tu primera sesión será la referencia para
        detectar récords.
      </p>
    );
  }

  return (
    <section aria-label="Registro de pesos" className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-sm">
        <span className="font-medium">Mejor peso:</span> {formatKg(history.bestWeightKg)}
      </p>
      <h3 className="text-xs font-medium text-muted-foreground">Últimas series</h3>
      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
        {history.recent.map((set, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="text-muted-foreground">
              {dateFormat.format(set.performedAt)} · serie {set.setNumber}
            </span>
            <span className={set.weightKg === history.bestWeightKg ? "font-semibold" : undefined}>
              {formatKg(set.weightKg)} × {set.reps}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
