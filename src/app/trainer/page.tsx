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
        <h1 className="text-3xl font-bold tracking-tight">Your trainer</h1>
        <p className="text-muted-foreground">
          Generate a workout plan from your profile and active goal. Every recommendation
          shows why it was proposed. Load is never auto-increased — progression defers to the
          RIR- and recovery-aware rule once you start logging sessions.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/exercises" className="underline underline-offset-4">
            Browse the exercise library →
          </Link>
          <Link href="/trainer/log" className="underline underline-offset-4">
            Log a workout session →
          </Link>
          <Link href="/trainer/import" className="underline underline-offset-4">
            Import a routine →
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Generate a plan</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneratePlanForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your saved plans</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t saved any plans yet. Generate one above and save it to see it
              here.
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
                    {plan._count.days} day{plan._count.days === 1 ? "" : "s"} ·{" "}
                    {plan.source === "NATIVE" ? "Generated" : "Imported"} ·{" "}
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
          <CardTitle>Plan detail view (placeholder)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A per-plan detail page (day-by-day editing and scheduling) is not built yet. The
          plans above are saved to your account and can be logged against from the logging
          page.
        </CardContent>
      </Card>
    </main>
  );
}
