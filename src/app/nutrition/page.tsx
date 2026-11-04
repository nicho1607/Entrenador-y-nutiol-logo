import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import {
  computeMealPlanSummary,
  getDailyConsumed,
  getNutritionTargets,
  getPlan,
  listFoods,
  listPlans,
} from "@/features/nutrition/service";
import { NutritionTargetsView } from "@/features/nutrition/targets-view";
import { WaterLogForm } from "@/features/nutrition/water-log-form";
import { CreatePlanForm } from "@/features/nutrition/create-plan-form";
import {
  AddMealForm,
  AddMealItemForm,
  SubstituteMealItemForm,
  type FoodOption,
} from "@/features/nutrition/plan-editor";
import type { Macros } from "@/lib/domain/nutrition";
import type { DomainResult } from "@/lib/domain/types";

/**
 * Nutrition hub: targets + water + meal planning. Guards on the session and
 * scopes every user read to the signed-in user's id. Targets reuse the profile
 * computeDerived path (single source of truth); meal-item and plan totals come
 * from the service's domain-backed computeMealPlanSummary — no scaling math
 * runs in this component.
 */
function macroLine(result: DomainResult<Macros>): string {
  if (!result.ok) return "—";
  const m = result.value;
  return `${Math.round(m.calories)} kcal · ${Math.round(m.proteinG)}g P · ${Math.round(
    m.carbsG,
  )}g C · ${Math.round(m.fatG)}g F`;
}

export default async function NutritionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [targets, plans, foods, daily] = await Promise.all([
    getNutritionTargets(user.id),
    listPlans(user.id),
    listFoods(),
    getDailyConsumed(user.id, new Date()),
  ]);

  const fullPlans = await Promise.all(plans.map((p) => getPlan(user.id, p.id)));
  const foodOptions: FoodOption[] = foods.map((f) => ({ id: f.id, name: f.name }));

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
        <h1 className="text-3xl font-bold tracking-tight">Nutrición</h1>
        <p className="text-muted-foreground">
          Tus objetivos orientativos, el control del agua y la planificación de comidas. Explora
          alimentos en el{" "}
          <Link href="/nutrition/foods" className="underline underline-offset-4">
            catálogo de alimentos
          </Link>
          , abre el{" "}
          <Link href="/nutrition/log" className="underline underline-offset-4">
            registro diario
          </Link>{" "}
          o crea una{" "}
          <Link href="/nutrition/market" className="underline underline-offset-4">
            lista de compras
          </Link>{" "}
          a partir de un plan.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Objetivos diarios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {targets.hasProfile ? (
            <NutritionTargetsView targets={targets} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Aún no has configurado tu perfil. Añade tus datos para calcular tu objetivo de
                calorías, macros y objetivo de agua.
              </p>
              <div>
                <Link href="/profile">
                  <Button>Configurar tu perfil</Button>
                </Link>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Estas son estimaciones orientativas, no consejo médico. FitMind AI no diagnostica
            enfermedades ni sustituye a un nutricionista clínico. En situaciones señaladas (riesgo
            de trastorno alimentario, embarazo, enfermedad metabólica), la app desactiva el cálculo
            automático de objetivos y te pide que consultes a un profesional cualificado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agua</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Hoy:{" "}
            <span className="text-foreground">{Math.round(daily.waterConsumedMl)} ml</span>
            {daily.waterTargetMl.ok
              ? ` de ${Math.round(daily.waterTargetMl.value)} ml de objetivo`
              : ""}
          </p>
          <WaterLogForm />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Planes de comidas</h2>
        <p className="text-xs text-muted-foreground">
          Los totales de los planes de comidas son orientativos y no consejo médico. Genera una{" "}
          <Link href="/nutrition/market" className="underline underline-offset-4">
            lista de compras
          </Link>{" "}
          desde cualquier plan para ver las cantidades agregadas revisadas frente a tus alergias y
          restricciones.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Crear un plan</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePlanForm />
          </CardContent>
        </Card>

        {fullPlans.filter((p) => p != null).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay planes. Crea uno arriba para empezar a organizar tus comidas.
          </p>
        ) : (
          fullPlans.map((plan) => {
            if (!plan) return null;
            const summary = computeMealPlanSummary(plan);
            return (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <p className="text-sm text-muted-foreground">
                    Total diario:{" "}
                    <span className="text-foreground">{macroLine(summary.dailyTotals)}</span>
                  </p>

                  {summary.meals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aún no hay comidas. Añade una abajo.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {summary.meals.map((meal) => (
                        <li key={meal.mealId} className="flex flex-col gap-2 border-t border-border pt-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">{meal.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {macroLine(meal.totals)}
                            </span>
                          </div>
                          {meal.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Aún no hay alimentos.</p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {meal.items.map((item) => (
                                <li key={item.mealItemId} className="text-sm">
                                  <span className="text-foreground">
                                    {item.foodName} — {Math.round(item.quantityG)} g
                                  </span>
                                  <span className="text-muted-foreground">
                                    {" · "}
                                    {macroLine(item.macros)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex flex-col gap-3 pt-1">
                            <AddMealItemForm mealId={meal.mealId} foods={foodOptions} />
                            {meal.items.map((item) => (
                              <SubstituteMealItemForm
                                key={`sub-${item.mealItemId}`}
                                mealItemId={item.mealItemId}
                                foods={foodOptions}
                              />
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t border-border pt-4">
                    <AddMealForm planId={plan.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </main>
  );
}
