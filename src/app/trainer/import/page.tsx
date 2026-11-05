import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent } from "@/components/ui/card";
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
        <h1 className="text-3xl font-bold tracking-tight">Importar una rutina</h1>
        <p className="max-w-prose text-muted-foreground">
          Trae tu rutina de Hevy a FitMind. Antes de guardar verás cada ejercicio con su
          demostración, series y repeticiones, y lo que no se pueda importar aparecerá con el
          motivo.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/trainer" className="underline underline-offset-4">
            ← Volver al entrenador
          </Link>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <ImportRoutineForm />
        </CardContent>
      </Card>
      <details className="rounded-surface border border-border p-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Formato de los archivos JSON y CSV
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p>
            Las rutinas se importan como <strong>JSON</strong> (un objeto de plan) o{" "}
            <strong>CSV</strong> (una fila por ejercicio). Cada campo se valida; las filas que no
            podemos mapear se listan como rechazadas con un motivo en lugar de descartarse en
            silencio.
          </p>
          <p>
            <strong>JSON:</strong> un plan con <code>name</code> y un arreglo <code>days</code>;
            cada día tiene un <code>name</code>, un <code>order</code> entero y un arreglo{" "}
            <code>exercises</code>. Cada ejercicio necesita <code>name</code>, <code>muscle</code>,{" "}
            <code>sets</code>, <code>repsMin</code> y <code>repsMax</code> (con{" "}
            <code>repsMax ≥ repsMin</code>); <code>restSeconds</code> y <code>targetRir</code> son
            opcionales.
          </p>
          <p>
            <strong>Encabezado CSV:</strong>{" "}
            <code>planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax</code> con las
            columnas opcionales <code>restSeconds,targetRir</code>. La agrupación por día se deriva
            de <code>dayOrder</code> + <code>dayName</code>.
          </p>
          <p>
            <code>muscle</code> debe ser uno de: CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, QUADS,
            HAMSTRINGS, GLUTES, CALVES, CORE, FULL_BODY, OTHER. Los nombres de los ejercicios deben
            coincidir con la biblioteca de ejercicios. La referencia completa está en{" "}
            <code>docs/routine-import-format.md</code> en el repositorio del proyecto.
          </p>
        </div>
      </details>
    </main>
  );
}
