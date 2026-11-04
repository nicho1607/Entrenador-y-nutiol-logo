import { describe, it, expect } from "vitest";
import { CURATED_FOODS, type FoodCategory } from "./foods";

// Valid category members (mirror the plain-string Food.category convention).
// Used to prove every row maps to a real category rather than an invented one.
const FOOD_CATEGORY_VALUES: readonly FoodCategory[] = [
  "PROTEIN",
  "GRAIN",
  "LEGUME",
  "FRUIT",
  "VEGETABLE",
  "DAIRY",
  "FAT",
];

describe("CURATED_FOODS", () => {
  it("contains at least 60 foods", () => {
    expect(CURATED_FOODS.length).toBeGreaterThanOrEqual(60);
  });

  it("has unique names (the seed upsert key)", () => {
    const names = CURATED_FOODS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carries non-empty provenance and a non-empty fdcId on every row", () => {
    for (const f of CURATED_FOODS) {
      expect(f.sourceRef.trim().length).toBeGreaterThan(0);
      expect(f.sourceName.trim().length).toBeGreaterThan(0);
      expect(f.sourceLicense.trim().length).toBeGreaterThan(0);
      expect(f.fdcId.trim().length).toBeGreaterThan(0);
      // sourceRef is derived from the fdcId.
      expect(f.sourceRef).toBe(`usda-fdc:${f.fdcId}`);
    }
  });

  it("uses only well-formed FDC IDs (plain integers, no fabricated suffixes)", () => {
    // Real USDA FoodData Central IDs are plain integers. A value like
    // "170000-1" is a fabricated placeholder and must never appear.
    for (const f of CURATED_FOODS) {
      expect(f.fdcId).toMatch(/^\d+$/);
    }
  });

  it("has unique fdcIds (each row cites a distinct real source record)", () => {
    const ids = CURATED_FOODS.map((f) => f.fdcId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has finite, non-negative macros and a 100 g reference quantity", () => {
    for (const f of CURATED_FOODS) {
      expect(f.referenceQtyG).toBe(100);
      for (const v of [
        f.caloriesPer100g,
        f.proteinPer100g,
        f.carbsPer100g,
        f.fatPer100g,
      ]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("uses only valid category members", () => {
    for (const f of CURATED_FOODS) {
      expect(FOOD_CATEGORY_VALUES).toContain(f.category);
    }
  });

  it("spans every expected category (at least one of each)", () => {
    const covered = new Set(CURATED_FOODS.map((f) => f.category));
    for (const c of FOOD_CATEGORY_VALUES) {
      expect(covered.has(c)).toBe(true);
    }
  });
});
