import { describe, it, expect } from "vitest";
import {
  CURATED_EXERCISES,
  type Equipment,
  type MuscleGroup,
} from "./exercises";

// Valid enum members (mirror the Prisma enums). Used to prove every row maps to
// a real enum value rather than an invented one.
const EQUIPMENT_VALUES: readonly Equipment[] = [
  "BODYWEIGHT",
  "DUMBBELLS",
  "BARBELL",
  "KETTLEBELL",
  "RESISTANCE_BANDS",
  "PULL_UP_BAR",
  "BENCH",
  "CABLE_MACHINE",
  "CARDIO_MACHINE",
  "FULL_GYM",
];

const MUSCLE_GROUP_VALUES: readonly MuscleGroup[] = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "CORE",
  "FULL_BODY",
  "OTHER",
];

describe("CURATED_EXERCISES", () => {
  it("contains at least 40 exercises", () => {
    expect(CURATED_EXERCISES.length).toBeGreaterThanOrEqual(40);
  });

  it("has unique names (the seed upsert key)", () => {
    const names = CURATED_EXERCISES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carries non-empty provenance (sourceRef + sourceLicense) on every row", () => {
    for (const e of CURATED_EXERCISES) {
      expect(e.sourceRef.trim().length).toBeGreaterThan(0);
      expect(e.sourceLicense.trim().length).toBeGreaterThan(0);
      expect(e.sourceName.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses only valid MuscleGroup enum members for primary and secondary muscles", () => {
    for (const e of CURATED_EXERCISES) {
      expect(MUSCLE_GROUP_VALUES).toContain(e.primaryMuscle);
      for (const m of e.secondaryMuscles) {
        expect(MUSCLE_GROUP_VALUES).toContain(m);
      }
    }
  });

  it("uses only valid Equipment enum members and never an empty equipment list", () => {
    for (const e of CURATED_EXERCISES) {
      expect(e.equipment.length).toBeGreaterThan(0);
      for (const eq of e.equipment) {
        expect(EQUIPMENT_VALUES).toContain(eq);
      }
    }
  });

  it("covers every primary MuscleGroup that has candidates", () => {
    const covered = new Set(CURATED_EXERCISES.map((e) => e.primaryMuscle));
    // The curated set is built to span every MuscleGroup value as a primary
    // target, so none should be missing.
    for (const m of MUSCLE_GROUP_VALUES) {
      expect(covered.has(m)).toBe(true);
    }
  });
});
