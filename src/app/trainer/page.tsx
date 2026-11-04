import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { GeneratePlanForm } from "@/features/trainer/generate-plan-form";
import { listPlans } from "@/features/trainer/service";

/**
 * Trainer page. Guards on the session and scopes every read to the signed-in
 * user's id (the data-ownership rule). The generate/preview/save flow is a
 * client component; the saved-plans list is read on the server via
 * listPlans(user.id) so a user only ever sees their own plans.
 */
export default async function TrainerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const plans = await listPlans(user.id);

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
        <h1 className="text-3xl font-bold tracking-tight">Tu entrenador</h1>
        <p className="text-muted-foreground">
          Genera un plan de entrenamiento a partir de tu perfil y tu objetivo activo. Cada
          recomendación muestra por qué se propuso. La carga nunca se aumenta automáticamente — la
          progresión queda en manos de la regla basada en RIR y recuperación en cuanto empieces a
          registrar sesiones.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/exercises" className="underline underline-offset-4">
            Explorar la biblioteca de ejercicios →
          </Link>
          <Link href="/trainer/log" className="underline underline-offset-4">
            Registrar una sesión de entrenamiento →
          </Link>
          <Link href="/trainer/import" className="underline underline-offset-4">
            Importar una rutina →
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Generar un plan</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneratePlanForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tus planes guardados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has guardado ningún plan. Genera uno arriba y guárdalo para verlo aquí.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border p-4"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{plan.name}</span>
                    {plan.description ? (
                      <span className="text-xs text-muted-foreground">{plan.description}</span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {plan._count.days} día{plan._count.days === 1 ? "" : "s"} ·{" "}
                    {plan.source === "NATIVE" ? "Generado" : "Importado"} ·{" "}
                    {new Date(plan.updatedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista de detalle del plan (marcador)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Una página de detalle por plan (edición día a día y programación) aún no está
          disponible. Los planes de arriba están guardados en tu cuenta y puedes registrar sesiones
          sobre ellos desde la página de registro.
        </CardContent>
      </Card>
    </main>
  );
}
