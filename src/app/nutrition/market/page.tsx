import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { generateMarketList, listPlans } from "@/features/nutrition/service";

/**
 * Budget-aware market (shopping) list for one of the signed-in user's own meal
 * plans. Guards on the session and scopes every read to the user's id: the plan
 * is loaded via the service's ownership-scoped generateMarketList, so a user
 * can only generate a list for a plan they own. The selected plan comes from
 * the `planId` query string, so the page works without client JavaScript and
 * stays bookmarkable.
 *
 * No numbers are fabricated: aggregation and dietary filtering come from the
 * pure domain helpers, and per-food prices are NOT populated (there is no
 * verifiable price source), so only quantities are shown — never a cost.
 */
export default async function MarketListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const raw = await searchParams;
  const requestedPlanId = typeof raw.planId === "string" ? raw.planId : undefined;

  const plans = await listPlans(user.id);
  const selectedPlanId = requestedPlanId ?? plans[0]?.id ?? null;
  const market = selectedPlanId
    ? await generateMarketList(user.id, selectedPlanId)
    : null;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

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
        <h1 className="text-3xl font-bold tracking-tight">Market list</h1>
        <p className="text-muted-foreground">
          A shopping list aggregated from one of your meal plans — total grams per food,
          budget-aware, and screened against your declared allergies and dietary
          restrictions.
        </p>
        <Link href="/nutrition" className="text-sm underline underline-offset-4">
          ← Back to nutrition
        </Link>
      </section>

      {plans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No plans yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>
              Create a meal plan and add foods to it first, then come back to generate a
              market list from it.
            </p>
            <div>
              <Link href="/nutrition">
                <Button>Go to meal plans</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Choose a plan</CardTitle>
            </CardHeader>
            <CardContent>
              <nav aria-label="Your plans" className="flex flex-wrap gap-2">
                {plans.map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/nutrition/market?planId=${encodeURIComponent(plan.id)}`}
                  >
                    <Button variant={plan.id === selectedPlanId ? "primary" : "secondary"}>
                      {plan.name}
                    </Button>
                  </Link>
                ))}
              </nav>
            </CardContent>
          </Card>

          {market && selectedPlan ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Shopping list — {selectedPlan.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Pricing not populated — no verifiable price data; quantities only.
                  </p>
                  <p className="text-muted-foreground">
                    Food budget:{" "}
                    <span className="text-foreground">
                      {market.budget.amount != null
                        ? `${market.budget.amount}`
                        : "not set"}
                    </span>
                    {" · "}
                    {market.budget.note}
                  </p>

                  {market.items.length === 0 ? (
                    <p className="text-muted-foreground">
                      This plan has no foods yet. Add foods to its meals on the{" "}
                      <Link href="/nutrition" className="underline underline-offset-4">
                        nutrition page
                      </Link>
                      .
                    </p>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Food</th>
                          <th className="pb-2 font-medium">Total quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {market.items.map((item) => (
                          <tr key={item.foodName} className="border-t border-border">
                            <td className="py-2 text-foreground">{item.foodName}</td>
                            <td className="py-2 text-muted-foreground">
                              {Math.round(item.totalGrams)} g
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Allergy &amp; restriction warnings</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {market.conflicts.length === 0 ? (
                    <p className="text-muted-foreground">
                      No foods in this plan match your declared allergies or dietary
                      restrictions. This is a conservative name-based check, not an
                      ingredient analysis — always read labels yourself.
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        These foods match something you flagged. Review them before shopping:
                      </p>
                      <ul className="flex flex-col gap-2" role="list">
                        {market.conflicts.map((c) => (
                          <li
                            key={`${c.food}-${c.reason}`}
                            className="rounded-md border border-border bg-muted px-3 py-2"
                          >
                            <span className="font-medium text-foreground">{c.food}</span>
                            <span className="text-muted-foreground"> — {c.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Safety</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  This list is an orientational aid, not medical advice. FitMind AI does not
                  diagnose disease or replace a clinical nutritionist. For flagged situations
                  (eating-disorder risk, pregnancy, metabolic disease) the app disables
                  automatic calorie targeting and asks you to consult a qualified
                  professional.
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a plan above to generate its market list.
            </p>
          )}
        </>
      )}
    </main>
  );
}
