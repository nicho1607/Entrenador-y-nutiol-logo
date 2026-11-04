"use client";

/**
 * Food-logging form. Mirrors the trainer log-session-form client pattern. The
 * user picks a food from the shared catalog (passed in from the server), a meal
 * type, and a quantity in grams. The server action re-validates and attributes
 * the log to the session user, so this form is a convenience layer only.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logFoodAction } from "./actions";
import { logFoodSchema, MEAL_TYPE_VALUES } from "./validation";
import { MEAL_TYPE_LABELS } from "./labels";
import type { FoodOption } from "./plan-editor";

const selectClasses =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FoodLogForm({ foods }: { foods: FoodOption[] }) {
  const router = useRouter();
  const [foodId, setFoodId] = useState(foods[0]?.id ?? "");
  const [mealType, setMealType] = useState<(typeof MEAL_TYPE_VALUES)[number]>("BREAKFAST");
  const [quantityG, setQuantityG] = useState("100");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (foods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The food catalog is empty — seed it (see the README) before logging food.
      </p>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const qty = Number(quantityG.trim());
    const parsed = logFoodSchema.safeParse({
      foodId,
      mealType,
      quantityG: Number.isNaN(qty) ? undefined : qty,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      const result = await logFoodAction(parsed.data);
      if (result.status === "success") {
        setMessage("Food logged.");
        setQuantityG("100");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not log the food.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="log-food" className="text-sm font-medium">
            Food
          </label>
          <select
            id="log-food"
            className={selectClasses}
            value={foodId}
            onChange={(e) => setFoodId(e.target.value)}
          >
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="log-meal-type" className="text-sm font-medium">
            Meal
          </label>
          <select
            id="log-meal-type"
            className={selectClasses}
            value={mealType}
            onChange={(e) => setMealType(e.target.value as (typeof MEAL_TYPE_VALUES)[number])}
          >
            {MEAL_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {MEAL_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="log-qty" className="text-sm font-medium">
            Grams
          </label>
          <Input
            id="log-qty"
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            step="1"
            value={quantityG}
            onChange={(e) => setQuantityG(e.target.value)}
          />
        </div>
      </div>

      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Logging..." : "Log food"}
        </Button>
      </div>
    </form>
  );
}
