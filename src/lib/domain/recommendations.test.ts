import { describe, it, expect } from "vitest";
import {
  buildRecommendations,
  HIGH_VOLUME_THRESHOLD,
  LOW_ADHERENCE_THRESHOLD,
  LOW_TARGET_COMPLIANCE_THRESHOLD,
  type EngineInput,
  type NutritionSignal,
} from "./recommendations";
import type { PlateauResult, ProgressionResult } from "./training";

/** A fully-empty input: every signal absent. Each test overrides one slice. */
function emptyInput(): EngineInput {
  return {
    volumeByMuscle: null,
    adherencePct: null,
    targetCompliancePct: null,
    exercises: [],
    nutrition: null,
  };
}

function progression(action: ProgressionResult["action"]): ProgressionResult {
  return { action, nextWeightKg: 100, rationale: `test ${action}` };
}

function plateau(isPlateau: boolean): PlateauResult {
  return { isPlateau, startE1rm: 120, endE1rm: 121, improvementPct: 0.8 };
}

function nutrition(overrides: Partial<NutritionSignal> = {}): NutritionSignal {
  return {
    clampedToFloor: false,
    professionalReviewRequired: false,
    calorieDelta: null,
    proteinDeltaG: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rule (a): recovery / volume
// ---------------------------------------------------------------------------
describe("recovery/volume rule", () => {
  it("flags high per-muscle volume and a HOLD/DECREASE progression (positive)", () => {
    const input: EngineInput = {
      ...emptyInput(),
      volumeByMuscle: { CHEST: HIGH_VOLUME_THRESHOLD + 50 },
      exercises: [{ key: "Squat", plateau: null, progression: progression("DECREASE") }],
    };
    const { recommendations } = buildRecommendations(input);

    const volume = recommendations.find((r) => r.id === "recovery_volume:volume:CHEST");
    expect(volume).toBeDefined();
    expect(volume?.basis).toBe("rule");
    expect(volume?.category).toBe("recovery_volume");
    expect(volume?.evidence[0]).toContain("CHEST");

    const prog = recommendations.find((r) => r.id === "recovery_volume:progression:Squat");
    expect(prog).toBeDefined();
    expect(prog?.basis).toBe("rule");
    expect(prog?.severity).toBe("warning"); // DECREASE -> warning
  });

  it("never recommends increasing load (reuses the progression call)", () => {
    const input: EngineInput = {
      ...emptyInput(),
      exercises: [{ key: "Bench", plateau: null, progression: progression("INCREASE") }],
    };
    const { recommendations } = buildRecommendations(input);
    expect(
      recommendations.some((r) => r.category === "recovery_volume" && /increase/i.test(r.title)),
    ).toBe(false);
  });

  it("emits an insufficient-data note when there is no volume and no progression", () => {
    const { insufficientData } = buildRecommendations(emptyInput());
    expect(insufficientData.some((m) => /recovery\/volume/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule (b): stalled exercises
// ---------------------------------------------------------------------------
describe("stalled-exercise rule", () => {
  it("recommends a deload for a plateaued exercise with e1RM evidence (positive)", () => {
    const input: EngineInput = {
      ...emptyInput(),
      exercises: [{ key: "Deadlift", plateau: plateau(true), progression: null }],
    };
    const { recommendations } = buildRecommendations(input);
    const stalled = recommendations.find((r) => r.id === "stalled_exercise:Deadlift");
    expect(stalled).toBeDefined();
    expect(stalled?.basis).toBe("rule");
    expect(stalled?.category).toBe("stalled_exercise");
    expect(stalled?.evidence[0]).toContain("estimated 1RM");
  });

  it("does not flag a non-plateaued exercise", () => {
    const input: EngineInput = {
      ...emptyInput(),
      exercises: [{ key: "Row", plateau: plateau(false), progression: null }],
    };
    const { recommendations } = buildRecommendations(input);
    expect(recommendations.some((r) => r.category === "stalled_exercise")).toBe(false);
  });

  it("emits an insufficient-data note when no exercise has plateau data", () => {
    const { insufficientData } = buildRecommendations(emptyInput());
    expect(insufficientData.some((m) => /stalled exercises/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule (c): low training adherence
// ---------------------------------------------------------------------------
describe("adherence rule", () => {
  it("flags low adherence with a calculation companion fact (positive)", () => {
    const input: EngineInput = { ...emptyInput(), adherencePct: 40 };
    const { recommendations } = buildRecommendations(input);

    const measured = recommendations.find((r) => r.id === "adherence:measured");
    expect(measured?.basis).toBe("calculation");
    expect(measured?.evidence[0]).toContain("40");

    const reduce = recommendations.find((r) => r.id === "adherence:reduce-days");
    expect(reduce?.basis).toBe("rule");
    expect(reduce?.severity).toBe("warning");
  });

  it("does not flag adherence at or above the threshold", () => {
    const input: EngineInput = { ...emptyInput(), adherencePct: LOW_ADHERENCE_THRESHOLD };
    const { recommendations } = buildRecommendations(input);
    expect(recommendations.some((r) => r.category === "adherence")).toBe(false);
  });

  it("emits an insufficient-data note when adherence is null (no fabricated %)", () => {
    const { recommendations, insufficientData } = buildRecommendations(emptyInput());
    expect(recommendations.some((r) => r.category === "adherence")).toBe(false);
    expect(insufficientData.some((m) => /adherence/i.test(m))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule (d): nutrition gaps + SAFETY cases
// ---------------------------------------------------------------------------
describe("nutrition rule", () => {
  it("suggests adjustments from compliance and deltas (positive)", () => {
    const input: EngineInput = {
      ...emptyInput(),
      targetCompliancePct: LOW_TARGET_COMPLIANCE_THRESHOLD - 20,
      nutrition: nutrition({ calorieDelta: 300, proteinDeltaG: -30 }),
    };
    const { recommendations } = buildRecommendations(input);
    expect(recommendations.find((r) => r.id === "nutrition:compliance")?.basis).toBe("rule");
    expect(recommendations.find((r) => r.id === "nutrition:calorie-over")).toBeDefined();
    expect(recommendations.find((r) => r.id === "nutrition:protein-under")).toBeDefined();
  });

  it("emits an insufficient-data note when nutrition is null", () => {
    const { insufficientData } = buildRecommendations(emptyInput());
    expect(insufficientData.some((m) => /nutrition advice/i.test(m))).toBe(true);
  });

  it("SAFETY: clampedToFloor=true never recommends eating less, even when over target", () => {
    const input: EngineInput = {
      ...emptyInput(),
      nutrition: nutrition({ clampedToFloor: true, calorieDelta: 500 }),
    };
    const { recommendations } = buildRecommendations(input);
    // The floor recommendation is present...
    expect(recommendations.find((r) => r.id === "nutrition:floor")).toBeDefined();
    // ...and NO "eat less / over target" advice is produced.
    expect(recommendations.some((r) => r.id === "nutrition:calorie-over")).toBe(false);
    expect(recommendations.some((r) => /eat less|reduce/i.test(r.title))).toBe(false);
  });

  it("SAFETY: professionalReviewRequired=true -> exactly one consult item, no numeric advice", () => {
    const input: EngineInput = {
      ...emptyInput(),
      targetCompliancePct: 10,
      nutrition: nutrition({
        professionalReviewRequired: true,
        calorieDelta: -400,
        proteinDeltaG: -50,
      }),
    };
    const { recommendations } = buildRecommendations(input);
    const nutritionRecs = recommendations.filter((r) => r.category === "nutrition");
    expect(nutritionRecs).toHaveLength(1);
    expect(nutritionRecs[0]?.id).toBe("nutrition:professional-review");
    expect(nutritionRecs[0]?.severity).toBe("critical");
    // No numeric deficit/compliance advice slipped through.
    expect(recommendations.some((r) => r.id === "nutrition:compliance")).toBe(false);
    expect(recommendations.some((r) => r.id === "nutrition:calorie-under")).toBe(false);
    expect(recommendations.some((r) => r.id === "nutrition:protein-under")).toBe(false);
  });
});
