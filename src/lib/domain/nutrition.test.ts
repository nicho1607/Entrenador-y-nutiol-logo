import { describe, it, expect } from "vitest";
import {
  calculateBmi,
  calculateBmr,
  calculateTdee,
  calculateCalorieTarget,
  calculateMacroSplit,
  scalePortion,
  sumDailyTotals,
  compareToTarget,
  aggregateMarketList,
  filterByDietary,
  calculateWaterTargetMl,
} from "./nutrition";

describe("calculateBmi", () => {
  it("computes BMI from weight (kg) and height (cm)", () => {
    const r = calculateBmi({ weightKg: 80, heightCm: 180 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 80 / 1.8^2 = 24.691...
      expect(r.value.bmi).toBeCloseTo(24.69, 2);
      expect(r.value.category).toBe("NORMAL");
    }
  });

  it("categorizes underweight / overweight / obese", () => {
    const under = calculateBmi({ weightKg: 50, heightCm: 180 });
    const over = calculateBmi({ weightKg: 90, heightCm: 175 });
    const obese = calculateBmi({ weightKg: 110, heightCm: 170 });
    expect(under.ok && under.value.category).toBe("UNDERWEIGHT");
    expect(over.ok && over.value.category).toBe("OVERWEIGHT");
    expect(obese.ok && obese.value.category).toBe("OBESE");
  });

  it("fails on missing input", () => {
    const r = calculateBmi({ weightKg: 80, heightCm: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("calculateBmr (Mifflin-St Jeor)", () => {
  it("computes BMR for a male", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    const r = calculateBmr({ sex: "MALE", weightKg: 80, heightCm: 180, ageYears: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1780, 5);
  });

  it("computes BMR for a female", () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
    const r = calculateBmr({ sex: "FEMALE", weightKg: 60, heightCm: 165, ageYears: 25 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1345.25, 5);
  });

  it("fails when inputs are missing", () => {
    const r = calculateBmr({ sex: "MALE", weightKg: 0, heightCm: 180, ageYears: 30 });
    expect(r.ok).toBe(false);
  });
});

describe("calculateTdee", () => {
  it("applies the MODERATE activity multiplier (1.55)", () => {
    // 1780 * 1.55 = 2759
    const r = calculateTdee({ bmr: 1780, activityLevel: "MODERATE" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(2759, 5);
  });

  it("applies the SEDENTARY multiplier (1.2)", () => {
    const r = calculateTdee({ bmr: 1780, activityLevel: "SEDENTARY" });
    expect(r.ok && r.value).toBeCloseTo(2136, 5);
  });
});

describe("calculateCalorieTarget", () => {
  // Reference: TDEE 2759, BMR 1780 (safe headroom so no floor clamping).
  // Each of the 7 goals maps to a concrete calorie delta:
  //   FAT_LOSS -500, HYPERTROPHY +300, RECOMPOSITION 0, WEIGHT_GAIN +500,
  //   STRENGTH +150, ENDURANCE 0, MAINTENANCE 0.
  it("applies a moderate deficit for FAT_LOSS when safe", () => {
    // 2759 - 500 = 2259, above BMR 1780 so no clamp.
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "FAT_LOSS" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories).toBe(2259);
      expect(r.value.clampedToFloor).toBe(false);
    }
  });

  it("applies a lean surplus for HYPERTROPHY", () => {
    // 2759 + 300 = 3059
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "HYPERTROPHY" });
    expect(r.ok && r.value.calories).toBe(3059);
  });

  it("eats at maintenance for RECOMPOSITION", () => {
    // 2759 + 0 = 2759
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "RECOMPOSITION" });
    expect(r.ok && r.value.calories).toBe(2759);
  });

  it("applies a larger surplus for WEIGHT_GAIN", () => {
    // 2759 + 500 = 3259
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "WEIGHT_GAIN" });
    expect(r.ok && r.value.calories).toBe(3259);
  });

  it("applies a slight surplus for STRENGTH", () => {
    // 2759 + 150 = 2909
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "STRENGTH" });
    expect(r.ok && r.value.calories).toBe(2909);
  });

  it("eats at maintenance for ENDURANCE", () => {
    // 2759 + 0 = 2759
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "ENDURANCE" });
    expect(r.ok && r.value.calories).toBe(2759);
  });

  it("eats at maintenance for MAINTENANCE", () => {
    // 2759 + 0 = 2759
    const r = calculateCalorieTarget({ tdee: 2759, bmr: 1780, goal: "MAINTENANCE" });
    expect(r.ok && r.value.calories).toBe(2759);
  });

  it("clamps to the BMR floor instead of producing an unsafe deficit", () => {
    // TDEE 2000, deficit 500 -> 1500 which is below BMR 1700 -> clamp to 1700
    const r = calculateCalorieTarget({ tdee: 2000, bmr: 1700, goal: "FAT_LOSS" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories).toBe(1700);
      expect(r.value.clampedToFloor).toBe(true);
    }
  });

  it("requires professional review when a safety flag is set", () => {
    const r = calculateCalorieTarget({
      tdee: 2759,
      bmr: 1780,
      goal: "FAT_LOSS",
      safetyFlags: { eatingDisorderRisk: true },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("PROFESSIONAL_REVIEW_REQUIRED");
  });
});

describe("calculateMacroSplit", () => {
  it("splits calories into protein/carbs/fat grams (default balanced split)", () => {
    // 2000 kcal, 30% protein / 40% carbs / 30% fat
    // protein: 2000*0.30/4 = 150g; carbs: 2000*0.40/4 = 200g; fat: 2000*0.30/9 = 66.67g
    const r = calculateMacroSplit({ calories: 2000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.proteinG).toBeCloseTo(150, 2);
      expect(r.value.carbsG).toBeCloseTo(200, 2);
      expect(r.value.fatG).toBeCloseTo(66.67, 2);
    }
  });

  it("respects a custom ratio that sums to 1", () => {
    const r = calculateMacroSplit({
      calories: 2400,
      ratio: { protein: 0.4, carbs: 0.4, fat: 0.2 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.proteinG).toBeCloseTo(240, 2); // 2400*0.4/4
      expect(r.value.carbsG).toBeCloseTo(240, 2);
      expect(r.value.fatG).toBeCloseTo(53.33, 2); // 2400*0.2/9
    }
  });

  it("rejects a ratio that does not sum to 1", () => {
    const r = calculateMacroSplit({
      calories: 2000,
      ratio: { protein: 0.5, carbs: 0.5, fat: 0.5 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("scalePortion", () => {
  it("scales per-100g macros proportionally to grams", () => {
    // 150 g of a 100-kcal/100g food = 150 kcal; macros scale by 1.5x.
    const r = scalePortion({
      per100g: { calories: 100, proteinG: 10, carbsG: 20, fatG: 4 },
      quantityG: 150,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories).toBeCloseTo(150, 5);
      expect(r.value.proteinG).toBeCloseTo(15, 5);
      expect(r.value.carbsG).toBeCloseTo(30, 5);
      expect(r.value.fatG).toBeCloseTo(6, 5);
    }
  });

  it("returns all zeros for a zero-gram portion", () => {
    const r = scalePortion({
      per100g: { calories: 100, proteinG: 10, carbsG: 20, fatG: 4 },
      quantityG: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.calories).toBe(0);
  });

  it("fails on negative grams", () => {
    const r = scalePortion({
      per100g: { calories: 100, proteinG: 10, carbsG: 20, fatG: 4 },
      quantityG: -50,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("sumDailyTotals", () => {
  it("sums two items correctly", () => {
    const r = sumDailyTotals([
      { calories: 150, proteinG: 15, carbsG: 30, fatG: 6 },
      { calories: 200, proteinG: 10, carbsG: 25, fatG: 8 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories).toBe(350);
      expect(r.value.proteinG).toBe(25);
      expect(r.value.carbsG).toBe(55);
      expect(r.value.fatG).toBe(14);
    }
  });

  it("returns all zeros for an empty list", () => {
    const r = sumDailyTotals([]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    }
  });
});

describe("compareToTarget", () => {
  it("computes remaining = target - consumed per macro", () => {
    const r = compareToTarget({
      consumed: { calories: 1800, proteinG: 120, carbsG: 180, fatG: 50 },
      target: { calories: 2200, proteinG: 150, carbsG: 220, fatG: 70 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories.remaining).toBe(400);
      expect(r.value.calories.over).toBe(false);
      expect(r.value.proteinG.remaining).toBe(30);
    }
  });

  it("flags macros that are over target (remaining negative)", () => {
    const r = compareToTarget({
      consumed: { calories: 2500, proteinG: 150, carbsG: 220, fatG: 70 },
      target: { calories: 2200, proteinG: 150, carbsG: 220, fatG: 70 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories.remaining).toBe(-300);
      expect(r.value.calories.over).toBe(true);
      // Exactly at target is not "over".
      expect(r.value.proteinG.over).toBe(false);
    }
  });
});

describe("aggregateMarketList", () => {
  it("aggregates grams for the same food across meals and sorts by name", () => {
    const r = aggregateMarketList([
      { foodName: "Rice, white, long-grain, cooked", quantityG: 150 },
      { foodName: "Chicken breast, cooked, roasted", quantityG: 200 },
      { foodName: "Rice, white, long-grain, cooked", quantityG: 100 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual([
        { foodName: "Chicken breast, cooked, roasted", totalGrams: 200 },
        { foodName: "Rice, white, long-grain, cooked", totalGrams: 250 },
      ]);
    }
  });

  it("returns an empty list for no items", () => {
    const r = aggregateMarketList([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });
});

describe("filterByDietary", () => {
  it("flags a peanut allergy conflict and leaves unrelated foods allowed", () => {
    const r = filterByDietary({
      foods: [{ name: "Peanut butter" }, { name: "Chicken breast" }],
      allergies: ["peanut"],
      restrictions: [],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.allowed).toEqual(["Chicken breast"]);
      expect(r.value.conflicts).toHaveLength(1);
      expect(r.value.conflicts[0].food).toBe("Peanut butter");
    }
  });

  it("matches case-insensitively", () => {
    const r = filterByDietary({
      foods: [{ name: "PEANUT BUTTER" }],
      allergies: ["Peanut"],
      restrictions: [],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.allowed).toEqual([]);
      expect(r.value.conflicts).toHaveLength(1);
    }
  });
});

describe("calculateWaterTargetMl", () => {
  it("returns ~35 ml per kg", () => {
    // 80 kg * 35 = 2800 ml
    const r = calculateWaterTargetMl({ weightKg: 80 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(2800);
  });

  it("fails on missing / non-positive weight", () => {
    const r = calculateWaterTargetMl({ weightKg: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("MISSING_INPUT");
  });
});
