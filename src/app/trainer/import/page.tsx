import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ImportRoutineForm } from "@/features/workouts/import/import-routine-form";

/**
 * Routine import. Guards on the session and redirects to /login when signed
 * out. The import flow (paste/upload → preview → confirm) is a client
 * component; every write is scoped to the session user's id server-side via
 * the import actions (the client never supplies a userId).
 */
export default async function ImportRoutinePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

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
        <h1 className="text-3xl font-bold tracking-tight">Import a routine</h1>
        <p className="text-muted-foreground">
          Paste or upload a routine exported as JSON or CSV. We preview the normalized plan —
          days, exercises, sets and reps — and list any rows we could not map so nothing is
          dropped silently. Confirming saves it to your account as an imported plan. Exercise
          names must match the exercise library.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/trainer" className="underline underline-offset-4">
            ← Back to the trainer
          </Link>
        </div>
        <details className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            Supported JSON / CSV format
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <p>
              Routines import as <strong>JSON</strong> (one plan object) or <strong>CSV</strong>{" "}
              (one row per exercise). Every field is validated; rows we cannot map are listed as
              rejected with a reason rather than dropped silently.
            </p>
            <p>
              <strong>JSON:</strong> a plan with <code>name</code> and a <code>days</code> array;
              each day has a <code>name</code>, an integer <code>order</code>, and an{" "}
              <code>exercises</code> array. Each exercise needs <code>name</code>,{" "}
              <code>muscle</code>, <code>sets</code>, <code>repsMin</code> and <code>repsMax</code>{" "}
              (with <code>repsMax ≥ repsMin</code>); <code>restSeconds</code> and{" "}
              <code>targetRir</code> are optional.
            </p>
            <p>
              <strong>CSV header:</strong>{" "}
              <code>
                planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax
              </code>{" "}
              with optional <code>restSeconds,targetRir</code> columns. Day grouping is derived
              from <code>dayOrder</code> + <code>dayName</code>.
            </p>
            <p>
              <code>muscle</code> must be one of: CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, QUADS,
              HAMSTRINGS, GLUTES, CALVES, CORE, FULL_BODY, OTHER. Exercise names must match the
              exercise library. The full reference lives in{" "}
              <code>docs/routine-import-format.md</code> in the project repository.
            </p>
          </div>
        </details>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Paste or upload a routine</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportRoutineForm />
        </CardContent>
      </Card>
    </main>
  );
}
