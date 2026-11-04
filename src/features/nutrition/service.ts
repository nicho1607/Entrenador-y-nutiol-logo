/**
 * Server-side nutrition persistence and summary orchestration.
 *
 * Data ownership: every function that touches user data takes an explicit
 * `userId` the caller MUST source from the session (`getCurrentUser` /
 * `requireUser`), never from client input. Queries are scoped to that id so a
 * user can only read/write their own plans, meals, items and logs. The one
 * exception is `listFoods`: the Food catalog is shared, read-only reference
 * data, so it is intentionally NOT user-scoped.
 *
 * All scaling/summary math lives in the pure domain library
 * (`@/lib/domain/nutrition`) and the targets reuse the profile feature's
 * `computeDerived` — this layer only loads/persists data and adapts it to those
 * pure functions; it never reimplements the math.
 */
import { prisma } from "@/server/db";
import {
  type DietaryConflict,
  type Macros,
  type MarketListEntry,
  type TargetComparison,
  aggregateMarketList,
  calculateWaterTargetMl,
  compareToTarget,
  filterByDietary,
  scalePortion,
  sumDailyTotals,
} from "@/lib/domain/nutrition";
import type { DomainResult } from "@/lib/domain/types";
import {
  type ComplianceDay,
  computeTargetCompliancePct,
} from "@/lib/domain/stats";
import { computeDerived, getProfile, type DerivedValues } from "@/features/profile/service";
import type {
  AddMealInput,
  AddMealItemInput,
  CreatePlanInput,
  FoodFilterInput,
  LogFoodInput,
  LogWaterInput,
  MealType,
  SubstituteMealItemInput,
} from "./validation";

// ---------------------------------------------------------------------------
// Food catalog (shared, read-only — NOT user-scoped)
// ---------------------------------------------------------------------------

/** A catalog food row as surfaced to the UI. */
export interface FoodView {
  id: string;
  name: string;
  category: string | null;
  referenceQtyG: number | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  sourceName: string | null;
  sourceLicense: string | null;
  fdcId: string | null;
}

/**
 * Lists the shared food catalog, optionally filtered by a case-insensitive
 * name `contains` search, ordered by name. NOT user-scoped: `Food` is read-only
 * reference data shared across all users.
 */
export async function listFoods(filter?: FoodFilterInput): Promise<FoodView[]> {
  const q = filter?.q?.trim();
  const foods = await prisma.food.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
  });

  return foods.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    referenceQtyG: f.referenceQtyG,
    caloriesPer100g: f.caloriesPer100g,
    proteinPer100g: f.proteinPer100g,
    carbsPer100g: f.carbsPer100g,
    fatPer100g: f.fatPer100g,
    sourceName: f.sourceName,
    sourceLicense: f.sourceLicense,
    fdcId: f.fdcId,
  }));
}

/** Builds the per-100g macro bag a food's catalog row describes (nulls -> 0). */
function per100gMacros(food: {
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
}): Macros {
  return {
    calories: food.caloriesPer100g ?? 0,
    proteinG: food.proteinPer100g ?? 0,
    carbsG: food.carbsPer100g ?? 0,
    fatG: food.fatPer100g ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Targets (reuse the profile computeDerived path) + water target
// ---------------------------------------------------------------------------

export interface NutritionTargets {
  /** BMI/BMR/TDEE/calorieTarget/macros straight from the profile feature. */
  derived: DerivedValues;
  /** Orientational daily water target (ml) from the profile weight. */
  waterTargetMl: DomainResult<number>;
  /** True when no profile exists yet (empty state). */
  hasProfile: boolean;
}

/**
 * Loads the caller's profile + active goal and REUSES the profile feature's
 * `computeDerived` so BMI/BMR/TDEE/calorie target/macros and all the
 * missing-input / safety signals come from the single source of truth. Adds the
 * orientational water target via the domain `calculateWaterTargetMl` from the
 * profile weight. Scoped to `userId`.
 */
export async function getNutritionTargets(userId: string): Promise<NutritionTargets> {
  const profile = await getProfile(userId);

  if (!profile) {
    const missing: DomainResult<never> = {
      ok: false,
      reason: "MISSING_INPUT",
      message: "Configura tu perfil para calcular los objetivos de nutrición.",
    };
    return {
      derived: {
        bmi: missing,
        bmr: missing,
        tdee: missing,
        calorieTarget: missing,
        macros: missing,
      },
      waterTargetMl: missing,
      hasProfile: false,
    };
  }

  const derived = computeDerived(profile);
  const waterTargetMl =
    profile.weightKg != null
      ? calculateWaterTargetMl({ weightKg: profile.weightKg })
      : ({
          ok: false,
          reason: "MISSING_INPUT",
          message: "Add your weight to compute a water target.",
        } satisfies DomainResult<number>);

  return { derived, waterTargetMl, hasProfile: true };
}

// ---------------------------------------------------------------------------
// Plans / meals / items (user-scoped)
// ---------------------------------------------------------------------------

/** Creates a nutrition plan owned by the caller. Returns the created plan id. */
export async function createPlan(userId: string, input: CreatePlanInput): Promise<string> {
  const plan = await prisma.nutritionPlan.create({
    data: { userId, name: input.name },
  });
  return plan.id;
}

/** Lists the caller's own plans (newest first), scoped to `userId`. */
export async function listPlans(userId: string) {
  return prisma.nutritionPlan.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { meals: true } } },
  });
}

/**
 * Loads one of the caller's own plans with its meals and items (+ each item's
 * food). Returns null when the plan does not exist OR is not owned by `userId`.
 */
export async function getPlan(userId: string, planId: string) {
  return prisma.nutritionPlan.findFirst({
    where: { id: planId, userId },
    include: {
      meals: {
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: { food: true },
          },
        },
      },
    },
  });
}

/**
 * Adds a meal to one of the caller's own plans. Verifies the plan belongs to
 * `userId` before the write. The meal order defaults to the next free slot when
 * not supplied. Returns the created meal id.
 */
export async function addMeal(userId: string, input: AddMealInput): Promise<string> {
  const plan = await prisma.nutritionPlan.findFirst({
    where: { id: input.planId, userId },
    select: { id: true },
  });
  if (!plan) {
    throw new Error("Cannot add a meal to a plan that is not yours.");
  }

  let order = input.order;
  if (order == null) {
    const last = await prisma.meal.findFirst({
      where: { planId: plan.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const meal = await prisma.meal.create({
    // `type` is a display/category concept folded into the meal name so the
    // existing Meal schema (name/order) carries it without a schema change.
    data: { planId: plan.id, name: input.name, order },
  });
  return meal.id;
}

/**
 * Adds a food (by grams) to one of the caller's own meals. Verifies the meal's
 * plan belongs to `userId` before the write. Returns the created meal item id.
 */
export async function addMealItem(userId: string, input: AddMealItemInput): Promise<string> {
  const meal = await prisma.meal.findFirst({
    where: { id: input.mealId, plan: { userId } },
    select: { id: true },
  });
  if (!meal) {
    throw new Error("Cannot add an item to a meal that is not yours.");
  }

  const item = await prisma.mealItem.create({
    data: { mealId: meal.id, foodId: input.foodId, quantityG: input.quantityG },
  });
  return item.id;
}

/**
 * Substitutes the food (and optionally the quantity) of one of the caller's own
 * meal items. Ownership is verified via the item's meal -> plan -> userId join
 * before the write.
 */
export async function substituteMealItem(
  userId: string,
  input: SubstituteMealItemInput,
): Promise<void> {
  const item = await prisma.mealItem.findFirst({
    where: { id: input.mealItemId, meal: { plan: { userId } } },
    select: { id: true },
  });
  if (!item) {
    throw new Error("Cannot substitute a meal item that is not yours.");
  }

  await prisma.mealItem.update({
    where: { id: item.id },
    data: {
      foodId: input.newFoodId,
      ...(input.quantityG != null ? { quantityG: input.quantityG } : {}),
    },
  });
}

/** One meal item's scaled macros, surfaced to the UI. */
export interface MealItemSummary {
  mealItemId: string;
  foodName: string;
  quantityG: number;
  macros: DomainResult<Macros>;
}

export interface MealSummary {
  mealId: string;
  name: string;
  order: number;
  items: MealItemSummary[];
  totals: DomainResult<Macros>;
}

export interface MealPlanSummary {
  meals: MealSummary[];
  dailyTotals: DomainResult<Macros>;
}

type PlanWithMeals = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

/**
 * Computes the per-item, per-meal and plan-daily macros for a loaded plan. Each
 * item is scaled via the domain `scalePortion` and each meal + the day via
 * `sumDailyTotals` — the math never happens inline in a component. Items whose
 * scaling failed are excluded from the totals (their failure is surfaced on the
 * item).
 */
export function computeMealPlanSummary(plan: PlanWithMeals): MealPlanSummary {
  const meals: MealSummary[] = plan.meals.map((meal) => {
    const items: MealItemSummary[] = meal.items.map((item) => ({
      mealItemId: item.id,
      foodName: item.food.name,
      quantityG: item.quantityG,
      macros: scalePortion({ per100g: per100gMacros(item.food), quantityG: item.quantityG }),
    }));

    const scaled = items.filter((i) => i.macros.ok).map((i) => (i.macros as { ok: true; value: Macros }).value);
    return {
      mealId: meal.id,
      name: meal.name,
      order: meal.order,
      items,
      totals: sumDailyTotals(scaled),
    };
  });

  const mealTotals = meals
    .filter((m) => m.totals.ok)
    .map((m) => (m.totals as { ok: true; value: Macros }).value);

  return { meals, dailyTotals: sumDailyTotals(mealTotals) };
}

// ---------------------------------------------------------------------------
// Market list (user-scoped; budget-aware, no fabricated prices)
// ---------------------------------------------------------------------------

/** Budget awareness surfaced alongside a market list. */
export interface MarketListBudget {
  /** The profile's optional monthly food budget, or null when not set. */
  amount: number | null;
  /** Human copy explaining the budget / no-pricing posture. */
  note: string;
}

/**
 * A shopping/market list generated from one of the caller's own nutrition
 * plans. Quantities are aggregated across every meal; prices are NEVER
 * fabricated (there is no verifiable price source), so `pricingAvailable` is
 * always false and no total cost is produced. Foods that conflict with the
 * profile's declared allergies / dietary restrictions are partitioned out with
 * a reason.
 */
export interface MarketList {
  /** Aggregated foods + total grams across the plan (sorted by name). */
  items: { foodName: string; totalGrams: number }[];
  /** Foods that conflict with declared allergies/restrictions, with a reason. */
  conflicts: { food: string; reason: string }[];
  /** Budget awareness from the profile (no prices are ever invented). */
  budget: MarketListBudget;
  /** Always false — the catalog has no verifiable price data. */
  pricingAvailable: false;
}

/**
 * Generates a budget-aware market list from one of the caller's OWN plans. The
 * plan is loaded scoped to `userId` (findFirst {id, userId} via getPlan), so a
 * user can only generate a list for their own plan; `null` is returned when the
 * plan does not exist or is not owned by the caller.
 *
 * Aggregation and dietary filtering are delegated to the pure domain helpers
 * (`aggregateMarketList`, `filterByDietary`) — this layer only loads data and
 * adapts it. Prices are never fabricated: the catalog carries no verifiable
 * price source, so `pricingAvailable` is always false and only quantities are
 * surfaced. The profile's optional `foodBudget` is passed through as context.
 */
export async function generateMarketList(
  userId: string,
  planId: string,
): Promise<MarketList | null> {
  const [plan, profile] = await Promise.all([getPlan(userId, planId), getProfile(userId)]);
  if (!plan) return null;

  // Flatten every meal item into {foodName, quantityG} entries, then aggregate.
  const entries = plan.meals.flatMap((meal) =>
    meal.items.map((item) => ({ foodName: item.food.name, quantityG: item.quantityG })),
  );
  const aggregated = aggregateMarketList(entries);
  const items: MarketList["items"] = aggregated.ok
    ? aggregated.value.map((e: MarketListEntry) => ({
        foodName: e.foodName,
        totalGrams: e.totalGrams,
      }))
    : [];

  // Partition allergy/restriction conflicts over the plan's distinct foods.
  // Dietary preferences are soft warnings, so they feed the same filter but are
  // labelled as restrictions-style conflicts the user can override.
  const distinctFoods = [...new Set(entries.map((e) => e.foodName))].map((name) => ({ name }));
  const allergies = profile?.allergies ?? [];
  const restrictions = [
    ...(profile?.dietaryRestrictions ?? []),
    ...(profile?.dietaryPreferences ?? []),
  ];
  const filtered = filterByDietary({ foods: distinctFoods, allergies, restrictions });
  const conflicts: MarketList["conflicts"] = filtered.ok
    ? filtered.value.conflicts.map((c: DietaryConflict) => ({ food: c.food, reason: c.reason }))
    : [];

  const amount = profile?.foodBudget ?? null;
  const note =
    amount != null
      ? "El presupuesto se muestra solo como contexto. Los precios por alimento NO están incluidos (no hay datos de precios verificables), así que las cantidades se listan sin una estimación de costo."
      : "Los precios por alimento NO están incluidos (no hay datos de precios verificables). Solo se listan las cantidades; no se estima ningún costo.";

  return {
    items,
    conflicts,
    budget: { amount, note },
    pricingAvailable: false,
  };
}

// ---------------------------------------------------------------------------
// Food logging (user-scoped)
// ---------------------------------------------------------------------------

/** Records a consumed food for the caller. Returns the created log id. */
export async function logFood(userId: string, input: LogFoodInput): Promise<string> {
  const log = await prisma.foodLog.create({
    data: {
      userId,
      foodId: input.foodId,
      mealType: input.mealType,
      quantityG: input.quantityG,
    },
  });
  return log.id;
}

/** Records a water intake for the caller. Returns the created log id. */
export async function logWater(userId: string, input: LogWaterInput): Promise<string> {
  const log = await prisma.waterLog.create({
    data: { userId, amountMl: input.amountMl },
  });
  return log.id;
}

/**
 * Builds the day's macro target from the profile-derived calorie target + macro
 * split. Propagates the first upstream failure (as a correctly-typed Macros
 * result) so the UI shows the same missing-input / safety signal rather than a
 * fabricated number.
 */
function buildTargetMacros(targets: NutritionTargets): DomainResult<Macros> {
  const { calorieTarget, macros } = targets.derived;
  if (!calorieTarget.ok) {
    return { ok: false, reason: calorieTarget.reason, message: calorieTarget.message };
  }
  if (!macros.ok) {
    return { ok: false, reason: macros.reason, message: macros.message };
  }
  return {
    ok: true,
    value: {
      calories: calorieTarget.value.calories,
      proteinG: macros.value.proteinG,
      carbsG: macros.value.carbsG,
      fatG: macros.value.fatG,
    },
  };
}

/** Start/end-of-day bounds (local server day) for `date`. */
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** One logged food for a day, surfaced to the UI. */
export interface FoodLogEntry {
  id: string;
  foodName: string;
  mealType: MealType;
  quantityG: number;
  loggedAt: Date;
  macros: DomainResult<Macros>;
}

/** Lists the caller's logged foods for a given day, scoped to `userId`. */
export async function listFoodLogsForDay(
  userId: string,
  date: Date,
): Promise<FoodLogEntry[]> {
  const { start, end } = dayBounds(date);
  const logs = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { gte: start, lt: end } },
    orderBy: { loggedAt: "asc" },
    include: { food: true },
  });

  return logs.map((l) => ({
    id: l.id,
    foodName: l.food.name,
    mealType: l.mealType,
    quantityG: l.quantityG,
    loggedAt: l.loggedAt,
    macros: scalePortion({ per100g: per100gMacros(l.food), quantityG: l.quantityG }),
  }));
}

export interface DailyConsumed {
  consumed: DomainResult<Macros>;
  /** The day's macro target (from getNutritionTargets' calorieTarget + macros). */
  target: DomainResult<Macros>;
  /** Consumed-vs-target comparison, available only when both sides resolved. */
  comparison: DomainResult<TargetComparison>;
  waterConsumedMl: number;
  waterTargetMl: DomainResult<number>;
}

/**
 * Computes the caller's consumed-vs-target daily summary. Today's FoodLogs are
 * scaled via `scalePortion` and summed via `sumDailyTotals`; today's water is
 * summed from WaterLog; the target comes from `getNutritionTargets` (calorie
 * target + macro split). Scoped to `userId`.
 *
 * OPTIONAL cache: when the consumed totals resolve, the DailyNutrition row
 * (unique [userId, date]) is upserted with the computed totals + water as the
 * schema intends. The cache is best-effort; raw FoodLog/WaterLog stay the
 * source of truth.
 */
export async function getDailyConsumed(userId: string, date: Date): Promise<DailyConsumed> {
  const { start, end } = dayBounds(date);

  const [logs, waterLogs, targets] = await Promise.all([
    listFoodLogsForDay(userId, date),
    prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { amountMl: true },
    }),
    getNutritionTargets(userId),
  ]);

  const scaled = logs
    .filter((l) => l.macros.ok)
    .map((l) => (l.macros as { ok: true; value: Macros }).value);
  const consumed = sumDailyTotals(scaled);

  const waterConsumedMl = waterLogs.reduce((sum, w) => sum + w.amountMl, 0);

  const target = buildTargetMacros(targets);

  const comparison: DomainResult<TargetComparison> = !consumed.ok
    ? consumed
    : !target.ok
      ? target
      : compareToTarget({ consumed: consumed.value, target: target.value });

  // Best-effort cache write; never let a cache failure break the read path.
  if (consumed.ok) {
    const dateKey = new Date(start);
    try {
      await prisma.dailyNutrition.upsert({
        where: { userId_date: { userId, date: dateKey } },
        create: {
          userId,
          date: dateKey,
          totalCalories: consumed.value.calories,
          totalProteinG: consumed.value.proteinG,
          totalCarbsG: consumed.value.carbsG,
          totalFatG: consumed.value.fatG,
          totalWaterMl: waterConsumedMl,
        },
        update: {
          totalCalories: consumed.value.calories,
          totalProteinG: consumed.value.proteinG,
          totalCarbsG: consumed.value.carbsG,
          totalFatG: consumed.value.fatG,
          totalWaterMl: waterConsumedMl,
        },
      });
    } catch {
      // Cache is advisory; raw logs remain the source of truth.
    }
  }

  return {
    consumed,
    target,
    comparison,
    waterConsumedMl,
    waterTargetMl: targets.waterTargetMl,
  };
}

// ---------------------------------------------------------------------------
// Phase 5 statistics (read-only, userId-scoped). Each function loads only the
// caller's OWN logs (reusing listFoodLogsForDay / dayBounds / getNutritionTargets)
// and defers compliance math to the pure @/lib/domain/stats helper. The macro
// target is always the profile-derived target; its MISSING_INPUT /
// PROFESSIONAL_REVIEW_REQUIRED failure is propagated, never fabricated.
// ---------------------------------------------------------------------------

/** An inclusive-start / inclusive-end day range for nutrition stats. */
export interface NutritionDateRange {
  /** First day to include (its calendar day). */
  from: Date;
  /** Last day to include (its calendar day). */
  to: Date;
}

/** Enumerates each calendar day (local server day) in `[from, to]` inclusive. */
function eachDay(range: NutritionDateRange): Date[] {
  const days: Date[] = [];
  const { start } = dayBounds(range.from);
  const { start: endStart } = dayBounds(range.to);
  for (const d = new Date(start); d <= endStart; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

/** Consumed macros for one day plus the day's target (shared by the series fns). */
export interface DailyMacroPoint {
  /** Midnight (local server day) the point is for. */
  date: Date;
  consumed: DomainResult<Macros>;
  target: DomainResult<Macros>;
}

/**
 * Loads the caller's per-day consumed-vs-target macro points across `range`.
 * Each day reuses `listFoodLogsForDay` + `scalePortion` + `sumDailyTotals`; the
 * target line reuses `getNutritionTargets` + `buildTargetMacros` (loaded once —
 * the profile-derived target does not change per day). Scoped to `userId`.
 * Shared by `getCaloriesOverTime` and `getMacrosOverTime`.
 */
async function loadDailyMacroPoints(
  userId: string,
  range: NutritionDateRange,
): Promise<DailyMacroPoint[]> {
  const days = eachDay(range);
  const targets = await getNutritionTargets(userId);
  const target = buildTargetMacros(targets);

  const points = await Promise.all(
    days.map(async (date) => {
      const logs = await listFoodLogsForDay(userId, date);
      const scaled = logs
        .filter((l) => l.macros.ok)
        .map((l) => (l.macros as { ok: true; value: Macros }).value);
      return { date, consumed: sumDailyTotals(scaled), target };
    }),
  );
  return points;
}

/** Per-day consumed calories vs the (constant) target calories over `range`. */
export interface CaloriesOverTimePoint {
  date: Date;
  consumedCalories: DomainResult<number>;
  targetCalories: DomainResult<number>;
}

/**
 * Per-day consumed vs target calories for the caller over `range`. Reuses
 * `loadDailyMacroPoints`; propagates the target's MISSING_INPUT /
 * PROFESSIONAL_REVIEW_REQUIRED failure rather than inventing a target. Scoped
 * to `userId`.
 */
export async function getCaloriesOverTime(
  userId: string,
  range: NutritionDateRange,
): Promise<CaloriesOverTimePoint[]> {
  const points = await loadDailyMacroPoints(userId, range);
  return points.map((p) => ({
    date: p.date,
    consumedCalories: p.consumed.ok
      ? { ok: true, value: p.consumed.value.calories }
      : p.consumed,
    targetCalories: p.target.ok ? { ok: true, value: p.target.value.calories } : p.target,
  }));
}

/**
 * Per-day consumed vs target macros (full `Macros` bag) for the caller over
 * `range`. Reuses `loadDailyMacroPoints`; propagates target failures. Scoped to
 * `userId`.
 */
export async function getMacrosOverTime(
  userId: string,
  range: NutritionDateRange,
): Promise<DailyMacroPoint[]> {
  return loadDailyMacroPoints(userId, range);
}

/**
 * Target-compliance percentage for the caller over `range` via the pure
 * `computeTargetCompliancePct`. Only days whose consumed AND target both
 * resolved contribute a comparable day; when the profile target is unavailable
 * the failure is propagated so the UI shows the same signal rather than a
 * fabricated score. Scoped to `userId`.
 */
export async function getTargetCompliance(
  userId: string,
  range: NutritionDateRange,
): Promise<DomainResult<number>> {
  const points = await loadDailyMacroPoints(userId, range);

  const complianceDays: ComplianceDay[] = [];
  for (const p of points) {
    if (!p.target.ok) return p.target; // propagate missing/safety signal, don't fabricate
    if (!p.consumed.ok) continue;
    complianceDays.push({
      consumedCalories: p.consumed.value.calories,
      targetCalories: p.target.value.calories,
      consumedProteinG: p.consumed.value.proteinG,
      targetProteinG: p.target.value.proteinG,
      consumedCarbsG: p.consumed.value.carbsG,
      targetCarbsG: p.target.value.carbsG,
      consumedFatG: p.consumed.value.fatG,
      targetFatG: p.target.value.fatG,
    });
  }

  return computeTargetCompliancePct({ days: complianceDays });
}

/** One logged meal entry surfaced for the meal-history chart/table. */
export interface MealHistoryEntry {
  id: string;
  foodName: string;
  mealType: MealType;
  quantityG: number;
  loggedAt: Date;
  macros: DomainResult<Macros>;
}

/** The caller's logged meals for one day. */
export interface MealHistoryDay {
  date: Date;
  entries: MealHistoryEntry[];
}

/**
 * The caller's grouped FoodLog history over `range`, one group per day. Reuses
 * the existing `listFoodLogsForDay` query (+ its `scalePortion` macros). Scoped
 * to `userId`.
 */
export async function getMealHistory(
  userId: string,
  range: NutritionDateRange,
): Promise<MealHistoryDay[]> {
  const days = eachDay(range);
  return Promise.all(
    days.map(async (date) => {
      const logs = await listFoodLogsForDay(userId, date);
      const entries: MealHistoryEntry[] = logs.map((l) => ({
        id: l.id,
        foodName: l.foodName,
        mealType: l.mealType,
        quantityG: l.quantityG,
        loggedAt: l.loggedAt,
        macros: l.macros,
      }));
      return { date, entries };
    }),
  );
}
