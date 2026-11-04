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
        <h1 className="text-3xl font-bold tracking-tight">Lista de compras</h1>
        <p className="text-muted-foreground">
          Una lista de compras agregada a partir de uno de tus planes de comidas — total de gramos
          por alimento, ajustada a tu presupuesto y revisada frente a las alergias y restricciones
          alimentarias que declaraste.
        </p>
        <Link href="/nutrition" className="text-sm underline underline-offset-4">
          ← Volver a nutrición
        </Link>
      </section>

      {plans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no hay planes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>
              Primero crea un plan de comidas y añádele alimentos, luego vuelve para generar una
              lista de compras a partir de él.
            </p>
            <div>
              <Link href="/nutrition">
                <Button>Ir a los planes de comidas</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Elige un plan</CardTitle>
            </CardHeader>
            <CardContent>
              <nav aria-label="Tus planes" className="flex flex-wrap gap-2">
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
                  <CardTitle>Lista de compras — {selectedPlan.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Precios no incluidos — no hay datos de precios verificables; solo cantidades.
                  </p>
                  <p className="text-muted-foreground">
                    Presupuesto para comida:{" "}
                    <span className="text-foreground">
                      {market.budget.amount != null
                        ? `${market.budget.amount}`
                        : "sin definir"}
                    </span>
                    {" · "}
                    {market.budget.note}
                  </p>

                  {market.items.length === 0 ? (
                    <p className="text-muted-foreground">
                      Este plan aún no tiene alimentos. Añade alimentos a sus comidas en la{" "}
                      <Link href="/nutrition" className="underline underline-offset-4">
                        página de nutrición
                      </Link>
                      .
                    </p>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Alimento</th>
                          <th className="pb-2 font-medium">Cantidad total</th>
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
                  <CardTitle>Avisos de alergias y restricciones</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {market.conflicts.length === 0 ? (
                    <p className="text-muted-foreground">
                      Ningún alimento de este plan coincide con las alergias o restricciones
                      alimentarias que declaraste. Esta es una comprobación conservadora basada en
                      el nombre, no un análisis de ingredientes — lee siempre las etiquetas por tu
                      cuenta.
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        Estos alimentos coinciden con algo que señalaste. Revísalos antes de
                        comprar:
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
                  <CardTitle>Seguridad</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Esta lista es una ayuda orientativa, no consejo médico. FitMind AI no diagnostica
                  enfermedades ni sustituye a un nutricionista clínico. En situaciones señaladas
                  (riesgo de trastorno alimentario, embarazo, enfermedad metabólica), la app
                  desactiva el cálculo automático de calorías y te pide que consultes a un
                  profesional cualificado.
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecciona un plan arriba para generar su lista de compras.
            </p>
          )}
        </>
      )}
    </main>
  );
}
