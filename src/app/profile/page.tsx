import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ProfileForm } from "@/features/profile/profile-form";
import { DerivedValuesList } from "@/features/profile/derived-values";
import { computeDerived, getProfile } from "@/features/profile/service";

/**
 * Profile page. Guards on the session and scopes the read to the signed-in
 * user's id (the data-ownership rule). Shows the computed values alongside the
 * create/update form; when no profile exists yet the form renders its empty
 * state and the summary shows the domain library's "missing input" signals.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user.id);
  const derived = profile ? computeDerived(profile) : null;

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

      <section>
        <h1 className="text-3xl font-bold tracking-tight">Tu perfil</h1>
        <p className="text-muted-foreground">
          {profile
            ? "Actualiza tus datos y recalcularemos tus estimaciones."
            : "Cuéntanos sobre ti para ver tus estimaciones personalizadas. Todo lo que no sea necesario para los cálculos es opcional."}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Valores calculados</CardTitle>
        </CardHeader>
        <CardContent>
          {derived ? (
            <DerivedValuesList derived={derived} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no tienes un perfil. Completa el formulario de abajo y guárdalo para ver tu IMC,
              TMB, GET, objetivo diario de calorías y reparto de macros.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Estas son estimaciones orientativas, no consejo médico. En situaciones señaladas, la
            app desactiva el cálculo automático de objetivos y te pide que consultes a un
            profesional.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profile ? "Edita tus datos" : "Crea tu perfil"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </main>
  );
}
