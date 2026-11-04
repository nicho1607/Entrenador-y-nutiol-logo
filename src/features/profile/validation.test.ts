import { describe, it, expect } from "vitest";
import { profileSchema } from "./validation";

describe("profileSchema", () => {
  it("accepts an empty object (everything optional) with sane defaults", () => {
    const r = profileSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.equipment).toEqual([]);
      expect(r.data.dietaryPreferences).toEqual([]);
      expect(r.data.allergies).toEqual([]);
      expect(r.data.dietaryRestrictions).toEqual([]);
      expect(r.data.flaggedForProfessionalReview).toBe(false);
      expect(r.data.age).toBeUndefined();
      expect(r.data.goal).toBeUndefined();
    }
  });

  it("parses comma-separated nutrition lists, trimming and dropping blanks", () => {
    const r = profileSchema.safeParse({
      dietaryPreferences: "vegetarian, high-protein ,  ",
      allergies: "peanuts,lactose",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dietaryPreferences).toEqual(["vegetarian", "high-protein"]);
      expect(r.data.allergies).toEqual(["peanuts", "lactose"]);
    }
  });

  it("accepts an array for a nutrition list (server payload shape)", () => {
    const r = profileSchema.safeParse({ allergies: ["gluten", " soy "] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.allergies).toEqual(["gluten", "soy"]);
  });

  it("accepts a fully specified valid profile", () => {
    const r = profileSchema.safeParse({
      age: 30,
      sex: "MALE",
      weightKg: 80,
      heightCm: 180,
      experienceLevel: "INTERMEDIATE",
      goal: "HYPERTROPHY",
      daysPerWeek: 4,
      sessionMinutes: 60,
      activityLevel: "MODERATE",
      equipment: ["DUMBBELLS", "BARBELL"],
      foodBudget: 50,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.goal).toBe("HYPERTROPHY");
      expect(r.data.equipment).toEqual(["DUMBBELLS", "BARBELL"]);
    }
  });

  it("accepts all seven goal identifiers", () => {
    const goals = [
      "HYPERTROPHY",
      "FAT_LOSS",
      "RECOMPOSITION",
      "WEIGHT_GAIN",
      "STRENGTH",
      "ENDURANCE",
      "MAINTENANCE",
    ] as const;
    for (const goal of goals) {
      expect(profileSchema.safeParse({ goal }).success).toBe(true);
    }
  });

  it("rejects an unknown goal", () => {
    const r = profileSchema.safeParse({ goal: "IMPROVE_PERFORMANCE" });
    expect(r.success).toBe(false);
  });

  it("rejects out-of-range numeric values", () => {
    expect(profileSchema.safeParse({ age: 10 }).success).toBe(false);
    expect(profileSchema.safeParse({ age: 200 }).success).toBe(false);
    expect(profileSchema.safeParse({ weightKg: -5 }).success).toBe(false);
    expect(profileSchema.safeParse({ daysPerWeek: 8 }).success).toBe(false);
    expect(profileSchema.safeParse({ sessionMinutes: -1 }).success).toBe(false);
  });

  it("rejects an invalid equipment identifier", () => {
    const r = profileSchema.safeParse({ equipment: ["SPACESHIP"] });
    expect(r.success).toBe(false);
  });
});
