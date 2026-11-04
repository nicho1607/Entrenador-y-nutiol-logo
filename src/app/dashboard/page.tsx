import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { DerivedValuesList } from "@/features/profile/derived-values";
import { computeDerived, getProfile } from "@/features/profile/service";
import { GOAL_TYPE_LABELS } from "@/features/profile/labels";
import {
  countSessions,
  getVolumeByMuscle,
  listPlans,
  listRecentSessions,
} from "@/features/trainer/service";
import { MUSCLE_GROUP_LABELS } from "@/features/trainer/labels";
import type { MuscleGroup } from "@/features/trainer/validation";
import { getDailyConsumed } from "@/features/nutrition/service";
import { getRecommendations } from "@/features/recommendations/service";
import { RecommendationCard } from "@/features/recommendations/recommendation-card";
import type { Macros, TargetComparison } from "@/lib/domain/nutrition";
import type { DomainResult } from "@/lib/domain/types";

/**
 * Protected dashboard. Middleware already guards /dashboard; we re-check here so
 * server data access is always scoped to the authenticated user (defense in
 * depth + the data-ownership rule). The profile summary is real; the remaining
 * areas are still honest placeholders.
 */
/** Rounds a macro value, or shows a dash when the domain result declined. */
function macroValue(result: DomainResult<Macros>, key: keyof Macros): string {
  return result.ok ? `${Math.round(result.value[key])}` : "—";
}

/** "N left" / "N over" per macro, or a dash when the comparison is unavailable. */
function remaining(
  result: DomainResult<TargetComparison>,
  key: keyof TargetComparison,
): string {
  if (!result.ok) return "—";
  const c = result.value[key];
  const rounded = Math.round(c.remaining);
  return c.over ? `${rounded} (excedido)` : `${rounded} restante`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user.id);
  const derived = profile ? computeDerived(profile) : null;

  const [plans, sessionCount, recentSessions, volume, daily, recommendations] =
    await Promise.all([
      listPlans(user.id),
      countSessions(user.id),
      listRecentSessions(user.id, 1),
      getVolumeByMuscle(user.id),
      getDailyConsumed(user.id, new Date()),
      getRecommendations(user.id),
    ]);
  const activePlan = plans[0] ?? null;
  const lastSession = recentSessions[0] ?? null;
  const topVolume: [MuscleGroup, number][] = volume.ok
    ? (Object.entries(volume.value) as [MuscleGroup, number][])
        .filter(([, sets]) => typeof sets === "number")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  // Insights preview: the top 1-2 recommendations (the full set, grouped by
  // basis, lives on /recommendations). When there is neither a recommendation
  // nor a data gap, show an explicit empty state instead of inventing advice.
  const topRecommendations = recommendations.recommendations.slice(0, 2);
  const hasRecommendations = recommendations.recommendations.length > 0;
  const hasInsufficient = recommendations.insufficientData.length > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold">FitMind AI</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bienvenido{user.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-muted-foreground">Sesión iniciada como {user.email}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/stats">
            <Button>Estadísticas completas</Button>
          </Link>
          <Link href="/dashboard/stats">
            <Button variant="secondary">Registrar una medida corporal</Button>
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del perfil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile && derived ? (
            <>
              <p className="text-sm text-muted-foreground">
                Objetivo:{" "}
                <span className="text-foreground">
                  {profile.goal ? GOAL_TYPE_LABELS[profile.goal] : "sin definir"}
                </span>
              </p>
              <DerivedValuesList derived={derived} />
              <div>
                <Link href="/profile">
                  <Button variant="secondary">Editar perfil</Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Aún no has configurado tu perfil. Añade tus datos para ver tu IMC, TMB, GET,
                objetivo diario de calorías y reparto de macros.
              </p>
              <div>
                <Link href="/profile">
                  <Button>Configurar tu perfil</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del entrenador</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Plan activo:{" "}
              <span className="text-foreground">
                {activePlan ? activePlan.name : "ninguno aún"}
              </span>
            </p>
            <p className="text-muted-foreground">
              Sesiones registradas:{" "}
              <span className="text-foreground">{sessionCount}</span>
              {lastSession
                ? ` · última el ${new Date(lastSession.performedAt).toLocaleDateString()}`
                : ""}
            </p>
            <div className="text-muted-foreground">
              Mayor volumen por músculo:{" "}
              {topVolume.length === 0 ? (
                <span className="text-foreground">aún no hay series registradas</span>
              ) : (
                <span className="text-foreground">
                  {topVolume
                    .map(([muscle, sets]) => `${MUSCLE_GROUP_LABELS[muscle]} (${sets})`)
                    .join(", ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/trainer">
              <Button>Abrir entrenador</Button>
            </Link>
            <Link href="/exercises">
              <Button variant="secondary">Biblioteca de ejercicios</Button>
            </Link>
            <Link href="/trainer/import">
              <Button variant="secondary">Importar una rutina</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de nutrición</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {daily.target.ok ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">Hoy, consumido vs. objetivo:</p>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Macro</th>
                    <th className="pb-2 font-medium">Consumido</th>
                    <th className="pb-2 font-medium">Objetivo</th>
                    <th className="pb-2 font-medium">Restante</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">Calorías</td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.consumed, "calories")} kcal
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.target, "calories")} kcal
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {remaining(daily.comparison, "calories")}
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">Proteína</td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.consumed, "proteinG")} g
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.target, "proteinG")} g
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {remaining(daily.comparison, "proteinG")}
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">Carbohidratos</td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.consumed, "carbsG")} g
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.target, "carbsG")} g
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {remaining(daily.comparison, "carbsG")}
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">Grasa</td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.consumed, "fatG")} g
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.target, "fatG")} g
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {remaining(daily.comparison, "fatG")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Configura tu perfil (peso, altura, edad, sexo, actividad y un objetivo) para
              calcular un objetivo diario de calorías y macros. Hasta entonces, solo se registran
              los totales consumidos.
            </p>
          )}

          <p className="text-muted-foreground">
            Agua hoy:{" "}
            <span className="text-foreground">{Math.round(daily.waterConsumedMl)} ml</span>
            {daily.waterTargetMl.ok
              ? ` de ${Math.round(daily.waterTargetMl.value)} ml de objetivo`
              : ""}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/nutrition">
              <Button>Abrir nutrición</Button>
            </Link>
            <Link href="/nutrition/foods">
              <Button variant="secondary">Catálogo de alimentos</Button>
            </Link>
            <Link href="/nutrition/log">
              <Button variant="secondary">Registro diario</Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Estimaciones orientativas, no consejo médico. En situaciones señaladas, la app
            desactiva el cálculo automático de objetivos y te pide que consultes a un profesional.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Análisis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {hasRecommendations ? (
            <>
              <p className="text-muted-foreground">
                Tus principales recomendaciones, cada una señalada según cómo se generó. Consulta
                el conjunto completo, agrupado por base y con la evidencia que lo respalda, en la
                página de recomendaciones.
              </p>
              <div className="flex flex-col gap-3">
                {topRecommendations.map((r) => (
                  <RecommendationCard key={r.id} recommendation={r} />
                ))}
              </div>
            </>
          ) : hasInsufficient ? (
            <p className="text-muted-foreground">
              Aún no hay datos suficientes para recomendaciones. Registra sesiones de
              entrenamiento, completa tu perfil y registra comidas para que FitMind AI tenga datos
              con los que trabajar — indicamos qué falta en lugar de adivinar.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Nada que recomendar y nada pendiente por ahora. Sigue registrando y los análisis
              aparecerán aquí.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/recommendations">
              <Button>Ver todas las recomendaciones</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente en fases posteriores (marcador)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Las fotos de progreso y las pruebas de extremo a extremo / el endurecimiento (fase 7) aún
          no están disponibles — llegarán en una fase posterior. Las recomendaciones adaptativas ya
          están activas en la página de{" "}
          <Link href="/recommendations" className="underline underline-offset-4">
            recomendaciones
          </Link>
          , la interfaz de importación de rutinas en la página de{" "}
          <Link href="/trainer/import" className="underline underline-offset-4">
            importación
          </Link>{" "}
          y los gráficos de progreso y las medidas corporales en la página de{" "}
          <Link href="/dashboard/stats" className="underline underline-offset-4">
            Estadísticas completas
          </Link>
          . Nada de lo que aparece como marcador en esta tarjeta es una función activa.
        </CardContent>
      </Card>
    </main>
  );
}
