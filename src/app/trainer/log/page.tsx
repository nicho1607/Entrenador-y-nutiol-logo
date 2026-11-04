import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import {
  LogSessionForm,
  type WorkoutExerciseOption,
} from "@/features/trainer/log-session-form";
import { getPlan, getVolumeByMuscle, listPlans } from "@/features/trainer/service";
import { MUSCLE_GROUP_LABELS } from "@/features/trainer/labels";
import type { MuscleGroup } from "@/features/trainer/validation";

/**
 * Workout logging. Guards on the session and scopes every read to the signed-in
 * user's id. The selectable exercises are flattened from the user's OWN saved
 * plans (getPlan re-checks ownership), and per-muscle volume is computed via the
 * existing domain calculateTrainingVolume (through getVolumeByMuscle) — the UI
 * only renders numbers here; full charts are a later phase and labeled as such.
 */
export default async function LogWorkoutPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const plans = await listPlans(user.id);
  const fullPlans = await Promise.all(plans.map((p) => getPlan(user.id, p.id)));

  const options: WorkoutExerciseOption[] = [];
  for (const plan of fullPlans) {
    if (!plan) continue;
    for (const day of plan.days) {
      for (const exercise of day.exercises) {
        options.push({
          workoutExerciseId: exercise.id,
          label: `${plan.name} · ${day.name} · ${exercise.exercise.name}`,
        });
      }
    }
  }

  const volume = await getVolumeByMuscle(user.id);
  const volumeEntries: [MuscleGroup, number][] = volume.ok
    ? (Object.entries(volume.value) as [MuscleGroup, number][]).filter(
        ([, sets]) => typeof sets === "number",
      )
    : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold">
          FitMind AI
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Log a workout</h1>
        <p className="text-muted-foreground">
          Record the sets you performed. Weight, reps, and an optional RIR or RPE per set feed
          the volume and progression math.
        </p>
        <Link href="/trainer" className="text-sm underline underline-offset-4">
          ← Back to the trainer
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Record a session</CardTitle>
        </CardHeader>
        <CardContent>
          <LogSessionForm options={options} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Training volume by muscle (all-time)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {volumeEntries.length === 0 ? (
            <p className="text-muted-foreground">
              No logged sets yet. Log a session above to see per-muscle volume here. This is a
              rep-volume metric (sets × reps), computed by the domain library.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {volumeEntries
                .sort((a, b) => b[1] - a[1])
                .map(([muscle, sets]) => (
                  <li key={muscle} className="flex justify-between">
                    <span className="text-foreground">{MUSCLE_GROUP_LABELS[muscle]}</span>
                    <span className="text-muted-foreground">{sets} reps total</span>
                  </li>
                ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Volume charts and trend lines are a later phase; this card shows the raw numeric
            totals only.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
