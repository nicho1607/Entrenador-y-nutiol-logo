import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import {
  getDailyConsumed,
  listFoodLogsForDay,
  listFoods,
} from "@/features/nutrition/service";
import { FoodLogForm } from "@/features/nutrition/food-log-form";
import { MEAL_TYPE_LABELS } from "@/features/nutrition/labels";
import type { FoodOption } from "@/features/nutrition/plan-editor";
import type { Macros, TargetComparison } from "@/lib/domain/nutrition";
import type { DomainResult } from "@/lib/domain/types";

/**
 * Daily food log. Guards on the session and scopes every read to the signed-in
 * user's id. The consumed-vs-target summary and per-macro "remaining" come from
 * the service's domain-backed getDailyConsumed (scalePortion + sumDailyTotals +
 * compareToTarget) — no scaling or comparison math runs in this component.
 */
function macroValue(result: DomainResult<Macros>, key: keyof Macros): string {
  return result.ok ? `${Math.round(result.value[key])}` : "—";
}

function remaining(result: DomainResult<TargetComparison>, key: keyof TargetComparison): string {
  if (!result.ok) return "—";
  const c = result.value[key];
  const rounded = Math.round(c.remaining);
  return c.over ? `${rounded} (over)` : `${rounded} left`;
}

export default async function NutritionLogPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const today = new Date();
  const [foods, logs, daily] = await Promise.all([
    listFoods(),
    listFoodLogsForDay(user.id, today),
    getDailyConsumed(user.id, today),
  ]);

  const foodOptions: FoodOption[] = foods.map((f) => ({ id: f.id, name: f.name }));

  const rows: { label: string; unit: string; macro: keyof Macros; cmp: keyof TargetComparison }[] =
    [
      { label: "Calories", unit: "kcal", macro: "calories", cmp: "calories" },
      { label: "Protein", unit: "g", macro: "proteinG", cmp: "proteinG" },
      { label: "Carbs", unit: "g", macro: "carbsG", cmp: "carbsG" },
      { label: "Fat", unit: "g", macro: "fatG", cmp: "fatG" },
    ];

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
        <h1 className="text-3xl font-bold tracking-tight">Daily food log</h1>
        <p className="text-muted-foreground">
          Log what you ate and see consumed-vs-target for the day. Calories and macros are
          computed from the catalog values by the domain library.
        </p>
        <Link href="/nutrition" className="text-sm underline underline-offset-4">
          ← Back to nutrition
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Log a food</CardTitle>
        </CardHeader>
        <CardContent>
          <FoodLogForm foods={foodOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {daily.target.ok ? (
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
                {rows.map((r) => (
                  <tr key={r.macro} className="border-t border-border">
                    <td className="py-2 text-foreground">{r.label}</td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.consumed, r.macro)} {r.unit}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {macroValue(daily.target, r.macro)} {r.unit}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {remaining(daily.comparison, r.cmp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground">
              Set up your profile (weight, height, age, sex, activity, and a goal) to compute
              a daily target. Until then, only consumed totals are shown.
            </p>
          )}

          <p className="text-muted-foreground">
            Water today:{" "}
            <span className="text-foreground">{Math.round(daily.waterConsumedMl)} ml</span>
            {daily.waterTargetMl.ok
              ? ` of ${Math.round(daily.waterTargetMl.value)} ml target`
              : ""}
            {" · "}
            <Link href="/nutrition" className="underline underline-offset-4">
              log water
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logged today</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">Nothing logged yet today.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {logs.map((log) => (
                <li key={log.id} className="flex justify-between border-b border-border pb-2 last:border-b-0">
                  <span className="text-foreground">
                    {log.foodName} — {Math.round(log.quantityG)} g
                  </span>
                  <span className="text-muted-foreground">
                    {MEAL_TYPE_LABELS[log.mealType]}
                    {log.macros.ok ? ` · ${Math.round(log.macros.value.calories)} kcal` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
