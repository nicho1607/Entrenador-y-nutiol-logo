"use client";

/**
 * One exercise in a plan list, laid out like a workout app's routine view: a
 * round demo thumbnail beside the name, the details line, and a striped
 * per-set table. Tapping the thumbnail opens the large demo animation inline
 * (motion only in answer to the tap).
 */
import { useId, useState, type ReactNode } from "react";
import { MUSCLE_GROUP_LABELS } from "./labels";
import { ExerciseAnimation } from "./exercise-animation";
import { exerciseFrames } from "./exercise-media";
import type { MuscleGroup } from "./validation";

export interface ExerciseListItemProps {
  exerciseName: string;
  primaryMuscle: MuscleGroup;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number | null;
  targetRir: number | null;
  /** Extra line under the table, e.g. why the generator chose it. */
  children?: ReactNode;
}

function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest} s`;
}

export function ExerciseListItem({
  exerciseName,
  primaryMuscle,
  sets,
  repsMin,
  repsMax,
  restSeconds,
  targetRir,
  children,
}: ExerciseListItemProps) {
  const [open, setOpen] = useState(false);
  const demoId = useId();
  const frames = exerciseFrames(exerciseName);
  const reps = repsMin === repsMax ? String(repsMin) : `${repsMin}-${repsMax}`;
  const details = [
    MUSCLE_GROUP_LABELS[primaryMuscle],
    restSeconds != null ? `descanso ${formatRest(restSeconds)}` : null,
    targetRir != null ? `RIR ${targetRir}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ExerciseThumb
          exerciseName={exerciseName}
          frames={frames}
          open={open}
          controls={demoId}
          onToggle={() => setOpen((o) => !o)}
        />
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-link">{exerciseName}</p>
          <p className="text-xs text-muted-foreground">{details.join(", ")}</p>
        </div>
      </div>

      {frames && open ? (
        <div id={demoId} className="exercise-demo-open">
          <ExerciseAnimation exerciseName={exerciseName} className="max-w-xs" />
        </div>
      ) : null}

      <table className="w-full text-sm">
        <caption className="sr-only">
          {sets} series de {reps} repeticiones
        </caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="w-16 py-1 text-left font-medium">
              Serie
            </th>
            <th scope="col" className="py-1 text-left font-medium">
              Reps
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: sets }, (_, i) => (
            <tr key={i} className="odd:bg-muted/60">
              <td className="rounded-l-control px-2 py-1.5 font-semibold">{i + 1}</td>
              <td className="rounded-r-control py-1.5">{reps}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {children}
    </div>
  );
}

function ExerciseThumb({
  exerciseName,
  frames,
  open,
  controls,
  onToggle,
}: {
  exerciseName: string;
  frames: [string, string] | null;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const circle =
    "relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-white";

  if (!frames) {
    return (
      <span aria-hidden className={`${circle} flex items-center justify-center`}>
        <span className="font-display text-xl font-bold text-[hsl(210_12%_13%)]">
          {exerciseName.charAt(0)}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${open ? "Ocultar" : "Ver"} demostración de ${exerciseName}`}
      className={`${circle} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static public-domain frames */}
      <img
        src={frames[0]}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frames[1]}
        alt=""
        loading="lazy"
        className="exercise-frame-end absolute inset-0 h-full w-full object-cover"
      />
    </button>
  );
}
