/**
 * Nutrition domain calculations for FitMind AI.
 *
 * All functions are pure and framework-free. Every result is a `DomainResult`
 * so callers must handle missing inputs and safety gating explicitly rather
 * than receiving a silently-wrong number.
 *
 * UNITS: weight in kilograms (kg), height in centimeters (cm), age in years,
 * energy in kilocalories (kcal), macros in grams (g).
 *
 * IMPORTANT LIMITATIONS
 *  - BMI is ORIENTATIONAL only. It ignores body composition (muscle vs fat),
 *    so athletes and very muscular individuals can be mis-categorized.
 *  - BMR via Mifflin-St Jeor and TDEE via activity multipliers are population
 *    ESTIMATES with meaningful individual variance (~±10%).
 *  - These numbers are not medical advice. For flagged situations the library
 *    refuses to compute and asks the user to consult a professional.
 */
import {
  type ActivityLevel,
  type DomainResult,
  type GoalType,
  type SafetyFlags,
  type Sex,
  fail,
  ok,
} from "./types";

export type BmiCategory = "UNDERWEIGHT" | "NORMAL" | "OVERWEIGHT" | "OBESE";

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
}

/**
 * Body Mass Index = weight(kg) / height(m)^2.
 * WHO adult cutoffs: <18.5 underweight, <25 normal, <30 overweight, else obese.
 */
export function calculateBmi(input: {
  weightKg: number;
  heightCm: number;
}): DomainResult<BmiResult> {
  const { weightKg, heightCm } = input;
  if (!isPositive(weightKg) || !isPositive(heightCm)) {
    return fail("INVALID_INPUT", "weightKg and heightCm must be positive numbers.");
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return ok({ bmi, category: categorizeBmi(bmi) });
}

function categorizeBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return "UNDERWEIGHT";
  if (bmi < 25) return "NORMAL";
  if (bmi < 30) return "OVERWEIGHT";
  return "OBESE";
}

/**
 * Basal Metabolic Rate via the Mifflin-St Jeor equation (kcal/day):
 *   male:   10*kg + 6.25*cm - 5*age + 5
 *   female: 10*kg + 6.25*cm - 5*age - 161
 * ASSUMPTION: adult (>= ~18y). The equation is undefined for children.
 */
export function calculateBmr(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): DomainResult<number> {
  const { sex, weightKg, heightCm, ageYears } = input;
  if (!isPositive(weightKg) || !isPositive(heightCm) || !isPositive(ageYears)) {
    return fail("MISSING_INPUT", "weightKg, heightCm and ageYears must be positive numbers.");
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const bmr = sex === "MALE" ? base + 5 : base - 161;
  return ok(bmr);
}

/**
 * Standard activity multipliers applied to BMR to estimate Total Daily Energy
 * Expenditure (TDEE). These are the widely-used Harris-Benedict/Mifflin
 * activity factors.
 */
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export function calculateTdee(input: {
  bmr: number;
  activityLevel: ActivityLevel;
}): DomainResult<number> {
  const { bmr, activityLevel } = input;
  if (!isPositive(bmr)) {
    return fail("INVALID_INPUT", "bmr must be a positive number.");
  }
  return ok(bmr * ACTIVITY_MULTIPLIER[activityLevel]);
}

export interface CalorieTargetResult {
  calories: number;
  /** True when the requested deficit was reduced to respect the BMR floor. */
  clampedToFloor: boolean;
}

/**
 * Goal adjustments applied to TDEE (kcal/day), one per supported goal:
 *  - FAT_LOSS: moderate 500 kcal deficit (~0.45 kg/week).
 *  - HYPERTROPHY: lean 300 kcal surplus to build muscle with minimal fat gain.
 *  - WEIGHT_GAIN: larger 500 kcal surplus for faster mass gain.
 *  - STRENGTH: slight 150 kcal surplus to fuel heavy work and recovery.
 *  - RECOMPOSITION: eat at maintenance (fat loss + muscle gain around TDEE).
 *  - ENDURANCE: eat at maintenance (fuel training without changing mass).
 *  - MAINTENANCE: eat at maintenance.
 *
 * SAFETY FLOOR: the target is never allowed below BMR, because eating under
 * basal needs for sustained periods is unsafe without supervision. When a
 * SafetyFlag is present (eating-disorder risk, pregnancy, metabolic disease)
 * we refuse to compute and require professional review.
 */
const GOAL_ADJUSTMENT: Record<GoalType, number> = {
  FAT_LOSS: -500,
  HYPERTROPHY: 300,
  RECOMPOSITION: 0,
  WEIGHT_GAIN: 500,
  STRENGTH: 150,
  ENDURANCE: 0,
  MAINTENANCE: 0,
};

export function calculateCalorieTarget(input: {
  tdee: number;
  bmr: number;
  goal: GoalType;
  safetyFlags?: SafetyFlags;
}): DomainResult<CalorieTargetResult> {
  const { tdee, bmr, goal, safetyFlags } = input;

  if (hasSafetyFlag(safetyFlags)) {
    return fail(
      "PROFESSIONAL_REVIEW_REQUIRED",
      "This situation requires a qualified professional. Automatic calorie targeting is disabled.",
    );
  }
  if (!isPositive(tdee) || !isPositive(bmr)) {
    return fail("MISSING_INPUT", "tdee and bmr must be positive numbers.");
  }

  const raw = tdee + GOAL_ADJUSTMENT[goal];
  if (raw < bmr) {
    return ok({ calories: Math.round(bmr), clampedToFloor: true });
  }
  return ok({ calories: Math.round(raw), clampedToFloor: false });
}

export interface MacroRatio {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroSplitResult {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Default balanced split: 30% protein / 40% carbs / 30% fat. */
const DEFAULT_RATIO: MacroRatio = { protein: 0.3, carbs: 0.4, fat: 0.3 };

// Energy density in kcal per gram.
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Splits a daily calorie target into protein/carbs/fat grams using the given
 * ratio (default balanced). The ratio must sum to 1 (within a small epsilon).
 */
export function calculateMacroSplit(input: {
  calories: number;
  ratio?: MacroRatio;
}): DomainResult<MacroSplitResult> {
  const { calories } = input;
  const ratio = input.ratio ?? DEFAULT_RATIO;

  if (!isPositive(calories)) {
    return fail("INVALID_INPUT", "calories must be a positive number.");
  }
  const sum = ratio.protein + ratio.carbs + ratio.fat;
  if (Math.abs(sum - 1) > 1e-6) {
    return fail("INVALID_INPUT", `macro ratio must sum to 1 (got ${sum}).`);
  }

  return ok({
    proteinG: (calories * ratio.protein) / KCAL_PER_G.protein,
    carbsG: (calories * ratio.carbs) / KCAL_PER_G.carbs,
    fatG: (calories * ratio.fat) / KCAL_PER_G.fat,
  });
}

// ---------------------------------------------------------------------------
// Portion scaling, daily totals, targets, market lists, dietary filtering, and
// water — pure helpers added in the nutrition-catalog phase. They reuse the
// macro conventions above and never fabricate numbers.
// ---------------------------------------------------------------------------

/** A set of macros for a 100 g reference or an already-scaled portion. */
export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Scales a food's per-100g macros to an arbitrary quantity in grams:
 *   scaled = per100g * quantityG / 100
 * Negative/non-finite quantity or any negative per-100g value is INVALID_INPUT.
 */
export function scalePortion(input: {
  per100g: Macros;
  quantityG: number;
}): DomainResult<Macros> {
  const { per100g, quantityG } = input;
  if (!isNonNegativeFinite(quantityG)) {
    return fail("INVALID_INPUT", "quantityG must be a non-negative finite number.");
  }
  if (
    !isNonNegativeFinite(per100g.calories) ||
    !isNonNegativeFinite(per100g.proteinG) ||
    !isNonNegativeFinite(per100g.carbsG) ||
    !isNonNegativeFinite(per100g.fatG)
  ) {
    return fail("INVALID_INPUT", "per100g macros must be non-negative finite numbers.");
  }
  const factor = quantityG / 100;
  return ok({
    calories: per100g.calories * factor,
    proteinG: per100g.proteinG * factor,
    carbsG: per100g.carbsG * factor,
    fatG: per100g.fatG * factor,
  });
}

/**
 * Sums a list of per-item macros into daily totals. An empty list is a valid
 * input and yields all-zero totals.
 */
export function sumDailyTotals(items: readonly Macros[]): DomainResult<Macros> {
  const totals: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const item of items) {
    if (
      !Number.isFinite(item.calories) ||
      !Number.isFinite(item.proteinG) ||
      !Number.isFinite(item.carbsG) ||
      !Number.isFinite(item.fatG)
    ) {
      return fail("INVALID_INPUT", "every item's macros must be finite numbers.");
    }
    totals.calories += item.calories;
    totals.proteinG += item.proteinG;
    totals.carbsG += item.carbsG;
    totals.fatG += item.fatG;
  }
  return ok(totals);
}

/** Per-macro comparison of consumed vs target: remaining amount and over flag. */
export interface MacroComparison {
  remaining: number;
  over: boolean;
}

export interface TargetComparison {
  calories: MacroComparison;
  proteinG: MacroComparison;
  carbsG: MacroComparison;
  fatG: MacroComparison;
}

/**
 * Compares consumed macros to a target, returning `remaining = target -
 * consumed` per macro (may be negative) and an `over` flag that is true when
 * consumed exceeds target.
 */
export function compareToTarget(input: {
  consumed: Macros;
  target: Macros;
}): DomainResult<TargetComparison> {
  const { consumed, target } = input;
  for (const m of [consumed, target]) {
    if (
      !Number.isFinite(m.calories) ||
      !Number.isFinite(m.proteinG) ||
      !Number.isFinite(m.carbsG) ||
      !Number.isFinite(m.fatG)
    ) {
      return fail("INVALID_INPUT", "consumed and target macros must be finite numbers.");
    }
  }
  const compare = (c: number, t: number): MacroComparison => ({
    remaining: t - c,
    over: c > t,
  });
  return ok({
    calories: compare(consumed.calories, target.calories),
    proteinG: compare(consumed.proteinG, target.proteinG),
    carbsG: compare(consumed.carbsG, target.carbsG),
    fatG: compare(consumed.fatG, target.fatG),
  });
}

export interface MarketListEntry {
  foodName: string;
  totalGrams: number;
}

/**
 * Aggregates a shopping/market list by food name, summing grams across
 * duplicate entries. The result is sorted by food name (ascending).
 */
export function aggregateMarketList(
  items: readonly { foodName: string; quantityG: number }[],
): DomainResult<MarketListEntry[]> {
  const byName = new Map<string, number>();
  for (const item of items) {
    if (!isNonNegativeFinite(item.quantityG)) {
      return fail("INVALID_INPUT", "every quantityG must be a non-negative finite number.");
    }
    byName.set(item.foodName, (byName.get(item.foodName) ?? 0) + item.quantityG);
  }
  const entries: MarketListEntry[] = [...byName.entries()]
    .map(([foodName, totalGrams]) => ({ foodName, totalGrams }))
    .sort((a, b) => a.foodName.localeCompare(b.foodName));
  return ok(entries);
}

export interface DietaryConflict {
  food: string;
  reason: string;
}

export interface DietaryFilterResult {
  allowed: string[];
  conflicts: DietaryConflict[];
}

/**
 * Partitions foods into `allowed` and `conflicts` by case-insensitive substring
 * matching of each allergy/restriction against the food name (and any tags).
 * The first matching allergy or restriction becomes the conflict reason.
 */
export function filterByDietary(input: {
  foods: readonly { name: string; tags?: readonly string[] }[];
  allergies: readonly string[];
  restrictions: readonly string[];
}): DomainResult<DietaryFilterResult> {
  const { foods, allergies, restrictions } = input;
  const allowed: string[] = [];
  const conflicts: DietaryConflict[] = [];

  const terms: { term: string; kind: string }[] = [
    ...allergies.map((a) => ({ term: a, kind: "allergy" })),
    ...restrictions.map((r) => ({ term: r, kind: "restriction" })),
  ];

  for (const foodItem of foods) {
    const haystacks = [foodItem.name, ...(foodItem.tags ?? [])].map((s) => s.toLowerCase());
    let matched: DietaryConflict | undefined;
    for (const { term, kind } of terms) {
      const needle = term.trim().toLowerCase();
      if (needle.length === 0) continue;
      if (haystacks.some((h) => h.includes(needle))) {
        matched = { food: foodItem.name, reason: `${kind}: ${term}` };
        break;
      }
    }
    if (matched) conflicts.push(matched);
    else allowed.push(foodItem.name);
  }
  return ok({ allowed, conflicts });
}

/** ~35 ml of water per kg of body weight. Orientational, not medical advice. */
const WATER_ML_PER_KG = 35;

/**
 * Orientational daily water target: ~35 ml per kg of body weight. This is a
 * rough general-population heuristic, NOT medical advice; real needs vary with
 * climate, activity, and health conditions.
 */
export function calculateWaterTargetMl(input: {
  weightKg: number;
}): DomainResult<number> {
  const { weightKg } = input;
  if (!isPositive(weightKg)) {
    return fail("MISSING_INPUT", "weightKg must be a positive number.");
  }
  return ok(weightKg * WATER_ML_PER_KG);
}

function isPositive(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isNonNegativeFinite(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function hasSafetyFlag(flags: SafetyFlags | undefined): boolean {
  if (!flags) return false;
  return Boolean(flags.eatingDisorderRisk || flags.pregnancy || flags.metabolicDisease);
}
