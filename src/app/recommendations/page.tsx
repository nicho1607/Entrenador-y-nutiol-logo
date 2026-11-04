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
    label: "From your numbers",
    blurb: "Direct calculations from your logged data — facts, not suggestions.",
  },
  {
    basis: "rule",
    label: "Rule-based guidance",
    blurb:
      "Conservative heuristics applied to your data. Treat them as guidance, not certainties.",
  },
  {
    basis: "ai",
    label: "AI-assisted",
    blurb:
      "Optional AI suggestions. AI is off by default and never overrides the rule-based or safety guidance above.",
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
        <h1 className="text-3xl font-bold tracking-tight">Recommendations</h1>
        <p className="text-muted-foreground">
          Built only from your own logged data. Each item is labelled by how it was produced,
          with the evidence behind it. Where there isn&apos;t enough data, we say so rather than
          guess.
        </p>
        <p className="text-xs text-muted-foreground">
          Generated {generatedAt.toLocaleString()}.
        </p>
        <Link href="/dashboard" className="text-sm underline underline-offset-4">
          ← Back to dashboard
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
            <CardTitle>Not enough data yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              We couldn&apos;t compute the following — log more or complete your profile and
              they&apos;ll appear here. Nothing below is a recommendation.
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
            <CardTitle>No recommendations yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            There&apos;s nothing to recommend and nothing missing right now. Log training
            sessions, complete your profile, and log meals so FitMind AI has data to work from.
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
