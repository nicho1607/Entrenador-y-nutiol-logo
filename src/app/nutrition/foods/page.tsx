import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { listFoods } from "@/features/nutrition/service";
import { foodFilterSchema, type FoodFilterInput } from "@/features/nutrition/validation";
import { FOOD_CATEGORY_LABELS } from "@/features/nutrition/labels";

/**
 * Browsable, searchable food catalog. Guards on the session (defense in depth +
 * the data-ownership rule), though the catalog itself is shared read-only
 * reference data. The search term comes from the query string and is validated
 * with the shared Zod schema before hitting the service. The form submits as a
 * GET so it works without client JavaScript and keeps the search bookmarkable.
 */
function categoryLabel(category: string): string {
  return FOOD_CATEGORY_LABELS[category] ?? category;
}

/** Formats a macro number per the reference quantity (per 100 g). */
function g(n: number | null): string {
  return n == null ? "—" : `${Math.round(n * 10) / 10} g`;
}

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const raw = await searchParams;
  const parsed = foodFilterSchema.safeParse({
    q: typeof raw.q === "string" && raw.q !== "" ? raw.q : undefined,
  });
  const filter: FoodFilterInput = parsed.success ? parsed.data : {};

  const foods = await listFoods(filter);

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
        <h1 className="text-3xl font-bold tracking-tight">Food catalog</h1>
        <p className="text-muted-foreground">
          A curated, provenance-tracked catalog. Calories and macros are shown per 100 g.
          Nothing here is fabricated — each entry cites its USDA source and license.
        </p>
        <Link href="/nutrition" className="text-sm underline underline-offset-4">
          ← Back to nutrition
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="q" className="text-sm font-medium">
                Food name
              </label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={filter.q ?? ""}
                placeholder="e.g. chicken"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit">Search</Button>
              <Link href="/nutrition/foods">
                <Button type="button" variant="ghost">
                  Clear
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-label="Food results" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {foods.length === 0
            ? "No foods match this search."
            : `${foods.length} food${foods.length === 1 ? "" : "s"}.`}
        </p>
        {foods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            If the catalog looks empty, the food catalog has not been seeded into your
            database yet — run the seed (see the README) once your PostgreSQL is set up.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {foods.map((food) => (
              <li key={food.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{food.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    {food.category ? (
                      <p className="text-muted-foreground">{categoryLabel(food.category)}</p>
                    ) : null}
                    <p className="text-foreground">
                      {food.caloriesPer100g == null
                        ? "Calories unknown"
                        : `${Math.round(food.caloriesPer100g)} kcal`}{" "}
                      per 100 g
                    </p>
                    <p className="text-muted-foreground">
                      Protein {g(food.proteinPer100g)} · Carbs {g(food.carbsPer100g)} · Fat{" "}
                      {g(food.fatPer100g)} (per 100 g)
                    </p>
                    {food.sourceName ? (
                      <p className="text-xs text-muted-foreground">
                        Source: {food.sourceName}
                        {food.sourceLicense ? ` (${food.sourceLicense})` : ""}
                        {food.fdcId ? ` · FDC ${food.fdcId}` : ""}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
