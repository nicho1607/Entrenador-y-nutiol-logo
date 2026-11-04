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
  return c.over ? `${rounded} (over)` : `${rounded} left`;
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
            Welcome{user.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-muted-foreground">Signed in as {user.email}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/stats">
            <Button>Full statistics</Button>
          </Link>
          <Link href="/dashboard/stats">
            <Button variant="secondary">Log a body measurement</Button>
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Profile summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile && derived ? (
            <>
              <p className="text-sm text-muted-foreground">
                Goal:{" "}
                <span className="text-foreground">
                  {profile.goal ? GOAL_TYPE_LABELS[profile.goal] : "not set"}
                </span>
              </p>
              <DerivedValuesList derived={derived} />
              <div>
                <Link href="/profile">
                  <Button variant="secondary">Edit profile</Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                You haven&apos;t set up your profile yet. Add your details to see your BMI,
                BMR, TDEE, daily calorie target, and macro split.
              </p>
              <div>
                <Link href="/profile">
                  <Button>Set up your profile</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trainer summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Active plan:{" "}
              <span className="text-foreground">
                {activePlan ? activePlan.name : "none yet"}
              </span>
            </p>
            <p className="text-muted-foreground">
              Logged sessions:{" "}
              <span className="text-foreground">{sessionCount}</span>
              {lastSession
                ? ` · last on ${new Date(lastSession.performedAt).toLocaleDateString()}`
                : ""}
            </p>
            <div className="text-muted-foreground">
              Top volume by muscle:{" "}
              {topVolume.length === 0 ? (
                <span className="text-foreground">no logged sets yet</span>
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
              <Button>Open trainer</Button>
            </Link>
            <Link href="/exercises">
              <Button variant="secondary">Exercise library</Button>
            </Link>
            <Link href="/trainer/import">
              <Button variant="secondary">Import a routine</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nutrition summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {daily.target.ok ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground">Today, consumed vs target:</p>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Macro</th>
                    <th className="pb-2 font-medium">Consumed</th>
                    <th className="pb-2 font-medium">Target</th>
                    <th className="pb-2 font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="py-2 text-foreground">Calories</td>
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
                    <td className="py-2 text-foreground">Protein</td>
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
                    <td className="py-2 text-foreground">Carbs</td>
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
                    <td className="py-2 text-foreground">Fat</td>
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
              Set up your profile (weight, height, age, sex, activity, and a goal) to compute
              a daily calorie and macro target. Until then, only consumed totals are tracked.
            </p>
          )}

          <p className="text-muted-foreground">
            Water today:{" "}
            <span className="text-foreground">{Math.round(daily.waterConsumedMl)} ml</span>
            {daily.waterTargetMl.ok
              ? ` of ${Math.round(daily.waterTargetMl.value)} ml target`
              : ""}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/nutrition">
              <Button>Open nutrition</Button>
            </Link>
            <Link href="/nutrition/foods">
              <Button variant="secondary">Food catalog</Button>
            </Link>
            <Link href="/nutrition/log">
              <Button variant="secondary">Daily log</Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Orientational estimates, not medical advice. For flagged situations the app
            disables automatic targeting and asks you to consult a professional.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {hasRecommendations ? (
            <>
              <p className="text-muted-foreground">
                Your top recommendations, each labelled by how it was produced. See the full
                set, grouped by basis with the evidence behind it, on the recommendations page.
              </p>
              <div className="flex flex-col gap-3">
                {topRecommendations.map((r) => (
                  <RecommendationCard key={r.id} recommendation={r} />
                ))}
              </div>
            </>
          ) : hasInsufficient ? (
            <p className="text-muted-foreground">
              Not enough data for recommendations yet. Log training sessions, complete your
              profile, and log meals so FitMind AI has data to work from — we say what is
              missing rather than guess.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Nothing to recommend and nothing missing right now. Keep logging and insights
              will appear here.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/recommendations">
              <Button>View all recommendations</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coming in later phases (placeholder)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Progress photos and end-to-end tests / hardening (phase 7) are not built yet — they
          arrive in a later phase. Adaptive recommendations are now live on the{" "}
          <Link href="/recommendations" className="underline underline-offset-4">
            recommendations
          </Link>{" "}
          page, the routine-import UI on the{" "}
          <Link href="/trainer/import" className="underline underline-offset-4">
            import
          </Link>{" "}
          page, and progress charts and body measurements on the{" "}
          <Link href="/dashboard/stats" className="underline underline-offset-4">
            Full statistics
          </Link>{" "}
          page. Nothing listed as a placeholder in this card is a working feature.
        </CardContent>
      </Card>
    </main>
  );
}
