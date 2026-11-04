"use client";

/**
 * Plan editor: add a meal, add a food (by grams) to a meal, and substitute a
 * food on an existing item. Mirrors the trainer client-form pattern
 * (useTransition, client-side Zod validation, shared action-state). The food
 * options come from the server (the shared read-only catalog); every mutation
 * re-validates server-side and re-verifies ownership, so this is a convenience
 * layer, not the trust boundary.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMealAction, addMealItemAction, substituteMealItemAction } from "./actions";
import { addMealItemSchema, addMealSchema, substituteMealItemSchema } from "./validation";
import { MEAL_TYPE_LABELS } from "./labels";
import { MEAL_TYPE_VALUES } from "./validation";

/** A selectable food option, flattened from the shared catalog on the server. */
export interface FoodOption {
  id: string;
  name: string;
}

/** A meal the user can add items to / substitute within. */
export interface MealOption {
  id: string;
  name: string;
}

const selectClasses =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AddMealForm({ planId }: { planId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof MEAL_TYPE_VALUES)[number]>("BREAKFAST");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = addMealSchema.safeParse({ planId, name, type });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      const result = await addMealAction(parsed.data);
      if (result.status === "success") {
        setMessage("Meal added.");
        setName("");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not add the meal.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit} noValidate>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor={`meal-name-${planId}`} className="text-sm font-medium">
          Meal name
        </label>
        <Input
          id={`meal-name-${planId}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Breakfast"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`meal-type-${planId}`} className="text-sm font-medium">
          Type
        </label>
        <select
          id={`meal-type-${planId}`}
          className={selectClasses}
          value={type}
          onChange={(e) => setType(e.target.value as (typeof MEAL_TYPE_VALUES)[number])}
        >
          {MEAL_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {MEAL_TYPE_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding..." : "Add meal"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-foreground sm:self-center">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function AddMealItemForm({
  mealId,
  foods,
}: {
  mealId: string;
  foods: FoodOption[];
}) {
  const router = useRouter();
  const [foodId, setFoodId] = useState(foods[0]?.id ?? "");
  const [quantityG, setQuantityG] = useState("100");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (foods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The food catalog is empty — seed it (see the README) to add foods to meals.
      </p>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const qty = Number(quantityG.trim());
    const parsed = addMealItemSchema.safeParse({
      mealId,
      foodId,
      quantityG: Number.isNaN(qty) ? undefined : qty,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      const result = await addMealItemAction(parsed.data);
      if (result.status === "success") {
        setMessage("Food added.");
        setQuantityG("100");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not add the food.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit} noValidate>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor={`item-food-${mealId}`} className="text-sm font-medium">
          Food
        </label>
        <select
          id={`item-food-${mealId}`}
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
        <label htmlFor={`item-qty-${mealId}`} className="text-sm font-medium">
          Grams
        </label>
        <Input
          id={`item-qty-${mealId}`}
          type="number"
          inputMode="decimal"
          min={1}
          max={5000}
          step="1"
          value={quantityG}
          onChange={(e) => setQuantityG(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding..." : "Add food"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-foreground sm:self-center">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function SubstituteMealItemForm({
  mealItemId,
  foods,
}: {
  mealItemId: string;
  foods: FoodOption[];
}) {
  const router = useRouter();
  const [newFoodId, setNewFoodId] = useState(foods[0]?.id ?? "");
  const [quantityG, setQuantityG] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (foods.length === 0) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const qtyRaw = quantityG.trim();
    const qty = qtyRaw === "" ? undefined : Number(qtyRaw);
    const parsed = substituteMealItemSchema.safeParse({
      mealItemId,
      newFoodId,
      quantityG: qty != null && Number.isNaN(qty) ? undefined : qty,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      const result = await substituteMealItemAction(parsed.data);
      if (result.status === "success") {
        setMessage("Substituted.");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not substitute the food.");
      }
    });
  }

  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onSubmit} noValidate>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor={`sub-food-${mealItemId}`} className="text-xs font-medium">
          Substitute with
        </label>
        <select
          id={`sub-food-${mealItemId}`}
          className={selectClasses}
          value={newFoodId}
          onChange={(e) => setNewFoodId(e.target.value)}
        >
          {foods.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`sub-qty-${mealItemId}`} className="text-xs font-medium">
          Grams (optional)
        </label>
        <Input
          id={`sub-qty-${mealItemId}`}
          type="number"
          inputMode="decimal"
          min={1}
          max={5000}
          step="1"
          value={quantityG}
          onChange={(e) => setQuantityG(e.target.value)}
          placeholder="keep"
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Saving..." : "Substitute"}
      </Button>
      {message ? (
        <p role="status" className="text-xs text-foreground sm:self-center">
          {message}
        </p>
      ) : null}
    </form>
  );
}
