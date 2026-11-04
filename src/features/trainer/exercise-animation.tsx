/**
 * Looping demo of an exercise: the start and end position photos from Free
 * Exercise DB, cross-faded with CSS (paused for prefers-reduced-motion). Renders
 * nothing for exercises without photos.
 */
import { cn } from "@/lib/cn";
import { exerciseFrames } from "./exercise-media";

export function ExerciseAnimation({
  exerciseName,
  className,
}: {
  exerciseName: string;
  className?: string;
}) {
  const frames = exerciseFrames(exerciseName);
  if (!frames) return null;

  return (
    <div
      role="img"
      aria-label={`Demostración: ${exerciseName}`}
      className={cn(
        "relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md border border-border bg-white",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static public-domain frames, no optimizer needed */}
      <img
        src={frames[0]}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frames[1]}
        alt=""
        loading="lazy"
        className="exercise-frame-end absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
