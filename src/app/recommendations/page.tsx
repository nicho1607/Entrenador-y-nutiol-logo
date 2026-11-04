import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { getRecommendations } from "@/features/recommendations/service";
import { RecommendationCard } from "@/features/recommendations/recommendation-card";
import type {
  Recommendation,
  RecommendationBasis,
} from "@/lib/domain/recommendations";

/**
 * Adaptive recommendations page. A server component: it guards the session,
 * scopes the read to the signed-in user's id, and renders the real engine
 * output grouped by basis. It never fabricates advice — when the engine could
 * not compute something, the honest "not enough data" notes are shown, and when
 * there is neither a recommendation nor a data note a full empty state is shown.
 */

/** The order and labels the basis sections are rendered in. */
const BASIS_SECTIONS: { basis: RecommendationBasis; label: string; blurb: string }[] = [
  {
    basis: "calculation",
    label: "A partir de tus números",
    blurb: "Cálculos directos de tus datos registrados — hechos, no sugerencias.",
  },
  {
    basis: "rule",
    label: "Orientación basada en reglas",
    blurb:
      "Heurísticas conservadoras aplicadas a tus datos. Tómalas como orientación, no como certezas.",
  },
  {
    basis: "ai",
    label: "Asistido por IA",
    blurb:
      "Sugerencias opcionales de IA. La IA está desactivada por defecto y nunca anula la orientación basada en reglas ni de seguridad de arriba.",
  },
];

export default async function RecommendationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { recommendations, insufficientData, generatedAt } = await getRecommendations(user.id);

  const byBasis = (basis: RecommendationBasis): Recommendation[] =>
    recommendations.filter((r) => r.basis === basis);

  const hasRecommendations = recommendations.length > 0;
  const hasInsufficient = insufficientData.length > 0;
  const isEmpty = !hasRecommendations && !hasInsufficient;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-12">
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
        <h1 className="text-3xl font-bold tracking-tight">Recomendaciones</h1>
        <p className="text-muted-foreground">
          Creadas únicamente a partir de tus propios datos registrados. Cada elemento está señalado
          según cómo se generó, con la evidencia que lo respalda. Donde no hay datos suficientes, lo
          decimos en lugar de adivinar.
        </p>
        <p className="text-xs text-muted-foreground">
          Generado el {generatedAt.toLocaleString()}.
        </p>
        <Link href="/dashboard" className="text-sm underline underline-offset-4">
          ← Volver al panel
        </Link>
      </section>

      {hasRecommendations ? (
        <div className="flex flex-col gap-8">
          {BASIS_SECTIONS.map(({ basis, label, blurb }) => {
            const items = byBasis(basis);
            if (items.length === 0) return null;
            return (
              <section key={basis} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-semibold tracking-tight">{label}</h2>
                  <p className="text-sm text-muted-foreground">{blurb}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {items.map((r) => (
                    <RecommendationCard key={r.id} recommendation={r} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {hasInsufficient ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no hay datos suficientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              No pudimos calcular lo siguiente — registra más o completa tu perfil y aparecerá
              aquí. Nada de lo de abajo es una recomendación.
            </p>
            <ul className="flex flex-col gap-2">
              {insufficientData.map((note, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isEmpty ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no hay recomendaciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No hay nada que recomendar ni nada pendiente por ahora. Registra sesiones de
            entrenamiento, completa tu perfil y registra comidas para que FitMind AI tenga datos con
            los que trabajar.
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
