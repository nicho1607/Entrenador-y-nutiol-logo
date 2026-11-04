import { describe, it, expect } from "vitest";
import {
  generatePlan,
  type CandidateExercise,
  type Equipment,
  type GeneratePlanInput,
} from "./plan-generator";

/**
 * A small but representative catalog spanning the muscle groups the split
 * targets, with a mix of equipment so equipment-filtering is observable.
 */
const CATALOG: readonly CandidateExercise[] = [
  {
    name: "Barbell Bench Press",
    primaryMuscle: "CHEST",
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    equipment: ["BARBELL", "BENCH"],
    difficulty: "INTERMEDIATE",
    instructions: "Press the bar from the chest.",
  },
  {
    name: "Push-Up",
    primaryMuscle: "CHEST",
    secondaryMuscles: ["TRICEPS", "CORE"],
    equipment: ["BODYWEIGHT"],
    difficulty: "BEGINNER",
    instructions: "Lower and press the body up.",
  },
  {
    name: "Pull-Up",
    primaryMuscle: "BACK",
    secondaryMuscles: ["BICEPS"],
    equipment: ["PULL_UP_BAR", "BODYWEIGHT"],
    difficulty: "INTERMEDIATE",
    instructions: "Pull the chest to the bar.",
  },
  {
    name: "Bent-Over Barbell Row",
    primaryMuscle: "BACK",
    secondaryMuscles: ["BICEPS"],
    equipment: ["BARBELL"],
    difficulty: "INTERMEDIATE",
    instructions: "Row the bar to the ribs.",
  },
  {
    name: "Overhead Barbell Press",
    primaryMuscle: "SHOULDERS",
    secondaryMuscles: ["TRICEPS"],
    equipment: ["BARBELL"],
    difficulty: "INTERMEDIATE",
    instructions: "Press the bar overhead.",
  },
  {
    name: "Pike Push-Up",
    primaryMuscle: "SHOULDERS",
    secondaryMuscles: ["TRICEPS"],
    equipment: ["BODYWEIGHT"],
    difficulty: "INTERMEDIATE",
    instructions: "Press the body up in a pike.",
  },
  {
    name: "Barbell Curl",
    primaryMuscle: "BICEPS",
    secondaryMuscles: [],
    equipment: ["BARBELL"],
    difficulty: "BEGINNER",
    instructions: "Curl the bar.",
  },
  {
    name: "Cable Triceps Pushdown",
    primaryMuscle: "TRICEPS",
    secondaryMuscles: [],
    equipment: ["CABLE_MACHINE"],
    difficulty: "BEGINNER",
    instructions: "Extend the forearms down.",
  },
  {
    name: "Bench Dip",
    primaryMuscle: "TRICEPS",
    secondaryMuscles: ["CHEST"],
    equipment: ["BENCH", "BODYWEIGHT"],
    difficulty: "BEGINNER",
    instructions: "Dip between benches.",
  },
  {
    name: "Barbell Back Squat",
    primaryMuscle: "QUADS",
    secondaryMuscles: ["GLUTES", "CORE"],
    equipment: ["BARBELL"],
    difficulty: "INTERMEDIATE",
    instructions: "Squat with the bar.",
  },
  {
    name: "Bodyweight Squat",
    primaryMuscle: "QUADS",
    secondaryMuscles: ["GLUTES"],
    equipment: ["BODYWEIGHT"],
    difficulty: "BEGINNER",
    instructions: "Squat with no load.",
  },
  {
    name: "Romanian Deadlift",
    primaryMuscle: "HAMSTRINGS",
    secondaryMuscles: ["GLUTES", "BACK"],
    equipment: ["BARBELL"],
    difficulty: "INTERMEDIATE",
    instructions: "Hinge with the bar.",
  },
  {
    name: "Glute Bridge",
    primaryMuscle: "GLUTES",
    secondaryMuscles: ["HAMSTRINGS"],
    equipment: ["BODYWEIGHT"],
    difficulty: "BEGINNER",
    instructions: "Lift the hips.",
  },
  {
    name: "Standing Calf Raise",
    primaryMuscle: "CALVES",
    secondaryMuscles: [],
    equipment: ["BODYWEIGHT"],
    difficulty: "BEGINNER",
    instructions: "Rise onto the toes.",
  },
  {
    name: "Plank",
    primaryMuscle: "CORE",
    secondaryMuscles: ["SHOULDERS"],
    equipment: ["BODYWEIGHT"],
    difficulty: "BEGINNER",
    instructions: "Hold a rigid line.",
  },
];

const FULL_GYM_EQUIPMENT: readonly Equipment[] = ["FULL_GYM"];

function baseInput(overrides: Partial<GeneratePlanInput> = {}): GeneratePlanInput {
  return {
    experienceLevel: "INTERMEDIATE",
    goal: "HYPERTROPHY",
    daysPerWeek: 4,
    sessionMinutes: 60,
    availableEquipment: FULL_GYM_EQUIPMENT,
    ...overrides,
  };
}

describe("generatePlan — split shape", () => {
  it("builds full body x3 for 3 days per week", () => {
    const r = generatePlan(baseInput({ daysPerWeek: 3 }), CATALOG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.days).toHaveLength(3);
      expect(r.value.days.map((d) => d.name)).toEqual([
        "Cuerpo completo 1",
        "Cuerpo completo 2",
        "Cuerpo completo 3",
      ]);
      expect(r.value.days.map((d) => d.order)).toEqual([1, 2, 3]);
    }
  });

  it("builds upper/lower x2 for 4 days per week", () => {
    const r = generatePlan(baseInput({ daysPerWeek: 4 }), CATALOG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.days.map((d) => d.name)).toEqual([
        "Superior A",
        "Inferior A",
        "Superior B",
        "Inferior B",
      ]);
    }
  });

  it("builds push/pull/legs for 6 days per week", () => {
    const r = generatePlan(baseInput({ daysPerWeek: 6 }), CATALOG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.days.map((d) => d.name)).toEqual([
        "Empuje 1",
        "Tracción 1",
        "Piernas 1",
        "Empuje 2",
        "Tracción 2",
        "Piernas 2",
      ]);
    }
  });

  it("builds a single full-body day for 1 day per week", () => {
    const r = generatePlan(baseInput({ daysPerWeek: 1 }), CATALOG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.days).toHaveLength(1);
      expect(r.value.days[0]?.name).toBe("Cuerpo completo 1");
    }
  });
});

describe("generatePlan — equipment filtering", () => {
  it("selects only exercises whose equipment is a subset of what's available", () => {
    const r = generatePlan(
      baseInput({ availableEquipment: ["BODYWEIGHT", "PULL_UP_BAR", "BENCH"] }),
      CATALOG,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const availableSet = new Set<Equipment>(["BODYWEIGHT", "PULL_UP_BAR", "BENCH"]);
    const byName = new Map(CATALOG.map((e) => [e.name, e]));
    for (const day of r.value.days) {
      for (const picked of day.exercises) {
        const cand = byName.get(picked.exerciseName);
        expect(cand).toBeDefined();
        for (const req of cand!.equipment) {
          if (req === "BODYWEIGHT") continue;
          expect(availableSet.has(req)).toBe(true);
        }
      }
    }
  });

  it("a bodyweight-only profile yields only bodyweight-feasible exercises", () => {
    const r = generatePlan(baseInput({ availableEquipment: ["BODYWEIGHT"] }), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byName = new Map(CATALOG.map((e) => [e.name, e]));
    const pickedNames = r.value.days.flatMap((d) => d.exercises.map((e) => e.exerciseName));
    expect(pickedNames.length).toBeGreaterThan(0);
    for (const name of pickedNames) {
      const cand = byName.get(name);
      expect(cand).toBeDefined();
      // Every required item must be BODYWEIGHT only.
      expect(cand!.equipment.every((eq) => eq === "BODYWEIGHT")).toBe(true);
    }
  });
});

describe("generatePlan — goal-driven sets/reps/rest", () => {
  function firstExercise(input: GeneratePlanInput) {
    const r = generatePlan(input, CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    const ex = r.value.days[0]?.exercises[0];
    expect(ex).toBeDefined();
    return ex!;
  }

  it("STRENGTH uses low reps and long rest", () => {
    const ex = firstExercise(baseInput({ goal: "STRENGTH" }));
    expect(ex.repsMin).toBe(3);
    expect(ex.repsMax).toBe(6);
    expect(ex.restSeconds).toBe(180);
  });

  it("HYPERTROPHY uses moderate reps and rest", () => {
    const ex = firstExercise(baseInput({ goal: "HYPERTROPHY" }));
    expect(ex.repsMin).toBe(8);
    expect(ex.repsMax).toBe(12);
    expect(ex.restSeconds).toBe(90);
  });

  it("ENDURANCE uses high reps and short rest", () => {
    const ex = firstExercise(baseInput({ goal: "ENDURANCE" }));
    expect(ex.repsMin).toBe(15);
    expect(ex.repsMax).toBe(20);
    expect(ex.restSeconds).toBe(45);
  });

  it("FAT_LOSS maps to the ENDURANCE profile", () => {
    const ex = firstExercise(baseInput({ goal: "FAT_LOSS" }));
    expect(ex.repsMin).toBe(15);
    expect(ex.repsMax).toBe(20);
    expect(ex.restSeconds).toBe(45);
  });

  it("RECOMPOSITION maps to the HYPERTROPHY profile", () => {
    const ex = firstExercise(baseInput({ goal: "RECOMPOSITION" }));
    expect(ex.repsMin).toBe(8);
    expect(ex.repsMax).toBe(12);
    expect(ex.restSeconds).toBe(90);
  });
});

describe("generatePlan — reasons and progression deferral", () => {
  it("attaches a non-empty reason to every selected exercise", () => {
    const r = generatePlan(baseInput(), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const day of r.value.days) {
      for (const ex of day.exercises) {
        expect(ex.reason.trim().length).toBeGreaterThan(0);
        // Progression is deferred, never auto-applied in the generator.
        expect(ex.reason.toLowerCase()).toContain("progresión");
      }
    }
  });
});

describe("generatePlan — session-minute cap", () => {
  it("caps exercises per day by the session-minute budget", () => {
    // 30 minutes / 10 min-per-exercise -> cap of 3 per day.
    const r = generatePlan(baseInput({ sessionMinutes: 30 }), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const day of r.value.days) {
      expect(day.exercises.length).toBeLessThanOrEqual(3);
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });
});

describe("generatePlan — invalid / unusable input", () => {
  it("fails with INVALID_INPUT when daysPerWeek < 1", () => {
    const r = generatePlan(baseInput({ daysPerWeek: 0 }), CATALOG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });

  it("fails with MISSING_INPUT when the catalog is empty", () => {
    const r = generatePlan(baseInput(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("MISSING_INPUT");
  });

  it("fails with INVALID_INPUT when nothing matches the available equipment", () => {
    // A catalog with no bodyweight-only movements plus only a cardio machine
    // available leaves nothing feasible (bodyweight exercises never need
    // equipment, so they must be excluded from the catalog to force this).
    const barbellOnly = CATALOG.filter(
      (e) => !e.equipment.every((eq) => eq === "BODYWEIGHT"),
    ).map((e) => ({ ...e, equipment: ["BARBELL"] as const }));
    const r = generatePlan(
      baseInput({ availableEquipment: ["CARDIO_MACHINE"] }),
      barbellOnly,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });

  it("fails with MISSING_INPUT when no equipment is available", () => {
    const r = generatePlan(baseInput({ availableEquipment: [] }), CATALOG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("MISSING_INPUT");
  });
});
