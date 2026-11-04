import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { listExercises, type ExerciseFilter } from "@/features/trainer/service";
import { exerciseFilterSchema } from "@/features/trainer/validation";
import {
  EQUIPMENT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  MUSCLE_GROUP_LABELS,
} from "@/features/trainer/labels";
import {
  EQUIPMENT_VALUES,
  EXPERIENCE_LEVEL_VALUES,
  MUSCLE_GROUP_VALUES,
} from "@/features/trainer/validation";

/**
 * Browsable exercise library. Guards on the session (defense in depth + the
 * data-ownership rule), though the catalog itself is shared read-only reference
 * data. Filters come from the query string and are validated with the shared
 * Zod schema before hitting the service, so an invalid value is simply dropped
 * rather than trusted. The filter form submits as a GET so it works without
 * client JavaScript and keeps filters bookmarkable.
 */
const selectClasses =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const raw = await searchParams;
  const parsed = exerciseFilterSchema.safeParse({
    muscle: typeof raw.muscle === "string" && raw.muscle !== "" ? raw.muscle : undefined,
    equipment:
      typeof raw.equipment === "string" && raw.equipment !== "" ? raw.equipment : undefined,
    difficulty:
      typeof raw.difficulty === "string" && raw.difficulty !== ""
        ? raw.difficulty
        : undefined,
  });
  const filter: ExerciseFilter = parsed.success ? parsed.data : {};

  const exercises = await listExercises(filter);

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
        <h1 className="text-3xl font-bold tracking-tight">Exercise library</h1>
        <p className="text-muted-foreground">
          A curated, provenance-tracked catalog. Filter by muscle group, equipment, or
          difficulty. Nothing here is fabricated — each entry cites its source and license.
        </p>
        <Link href="/trainer" className="text-sm underline underline-offset-4">
          Generate a plan from these exercises →
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="muscle" className="text-sm font-medium">
                  Muscle group
                </label>
                <select
                  id="muscle"
                  name="muscle"
                  className={selectClasses}
                  defaultValue={filter.muscle ?? ""}
                >
                  <option value="">All</option>
                  {MUSCLE_GROUP_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {MUSCLE_GROUP_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="equipment" className="text-sm font-medium">
                  Equipment
                </label>
                <select
                  id="equipment"
                  name="equipment"
                  className={selectClasses}
                  defaultValue={filter.equipment ?? ""}
                >
                  <option value="">All</option>
                  {EQUIPMENT_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {EQUIPMENT_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="difficulty" className="text-sm font-medium">
                  Difficulty
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  className={selectClasses}
                  defaultValue={filter.difficulty ?? ""}
                >
                  <option value="">All</option>
                  {EXPERIENCE_LEVEL_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {EXPERIENCE_LEVEL_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit">Apply filters</Button>
              <Link href="/exercises">
                <Button type="button" variant="ghost">
                  Clear
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-label="Exercise results" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {exercises.length === 0
            ? "No exercises match these filters."
            : `${exercises.length} exercise${exercises.length === 1 ? "" : "s"}.`}
        </p>
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            If the catalog looks empty, the exercise library has not been seeded into your
            database yet — run the seed (see the README) once your PostgreSQL is set up.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {exercises.map((exercise) => (
              <li key={exercise.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{exercise.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">
                      Primary: {MUSCLE_GROUP_LABELS[exercise.primaryMuscle]}
                      {exercise.secondaryMuscles.length > 0
                        ? ` · Also: ${exercise.secondaryMuscles
                            .map((m) => MUSCLE_GROUP_LABELS[m])
                            .join(", ")}`
                        : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Equipment:{" "}
                      {exercise.equipment.length > 0
                        ? exercise.equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ")
                        : "None listed"}
                      {exercise.difficulty
                        ? ` · ${EXPERIENCE_LEVEL_LABELS[exercise.difficulty]}`
                        : ""}
                    </p>
                    {exercise.instructions ? (
                      <p className="text-foreground">{exercise.instructions}</p>
                    ) : null}
                    {exercise.sourceName ? (
                      <p className="text-xs text-muted-foreground">
                        Source: {exercise.sourceName}
                        {exercise.sourceLicense ? ` (${exercise.sourceLicense})` : ""}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
