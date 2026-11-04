"use client";

/**
 * Workout logging form. Mirrors the profile-form client pattern (useTransition,
 * client-side Zod validation, the shared action-state result). The user picks
 * one of their OWN workout exercises (passed in from the server, already scoped
 * to their id) and logs per-set weight/reps and an optional RIR or RPE. The
 * server action re-validates and the service re-verifies ownership, so this
 * form is a convenience layer, not the trust boundary.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logSessionAction } from "./actions";
import { logSessionSchema } from "./validation";

/** A selectable workout exercise option, flattened from the user's plans. */
export interface WorkoutExerciseOption {
  workoutExerciseId: string;
  label: string;
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

export function LogSessionForm({ options }: { options: WorkoutExerciseOption[] }) {
  const router = useRouter();
  const [workoutExerciseId, setWorkoutExerciseId] = useState(
    options[0]?.workoutExerciseId ?? "",
  );
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SetRow[]>([emptyRow(1)]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function num(v: string): number | undefined {
    const t = v.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  }

  function updateRow(index: number, key: keyof SetRow, value: string) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow(rs.length + 1)]);
  }

  function removeRow(index: number) {
    setRows((rs) =>
      rs
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, setNumber: String(i + 1) })),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

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
          onChange={(e) => setWorkoutExerciseId(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.workoutExerciseId} value={o.workoutExerciseId}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notas (opcional)
        </label>
        <Input
          id="notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando..." : "Registrar sesión"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
