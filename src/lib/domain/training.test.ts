import { describe, it, expect } from "vitest";
import {
  calculateTrainingVolume,
  suggestProgression,
  detectPlateau,
} from "./training";

describe("calculateTrainingVolume", () => {
  it("sums sets x reps per muscle group", () => {
    const r = calculateTrainingVolume([
      { muscle: "CHEST", sets: 4, reps: 10 },
      { muscle: "CHEST", sets: 3, reps: 12 },
      { muscle: "BACK", sets: 5, reps: 8 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // CHEST: 4*10 + 3*12 = 76 ; BACK: 5*8 = 40
      expect(r.value.CHEST).toBe(76);
      expect(r.value.BACK).toBe(40);
    }
  });

  it("returns an empty map for no entries", () => {
    const r = calculateTrainingVolume([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.value)).toHaveLength(0);
  });

  it("fails on negative sets or reps", () => {
    const r = calculateTrainingVolume([{ muscle: "CHEST", sets: -1, reps: 10 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("suggestProgression (RIR/RPE aware)", () => {
  it("does NOT increase load when the last set was taken to failure (RIR 0)", () => {
    const r = suggestProgression({
      currentWeightKg: 100,
      targetReps: 8,
      achievedReps: 8,
      lastSetRir: 0,
      recoveredWell: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.action).toBe("HOLD");
      expect(r.value.nextWeightKg).toBe(100);
    }
  });

  it("increases load only when reps met, RIR>=2, and recovered well", () => {
    const r = suggestProgression({
      currentWeightKg: 100,
      targetReps: 8,
      achievedReps: 8,
      lastSetRir: 2,
      recoveredWell: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.action).toBe("INCREASE");
      // default +2.5% rounded
      expect(r.value.nextWeightKg).toBeCloseTo(102.5, 2);
    }
  });

  it("holds when recovery was poor even if reps and RIR allow a bump", () => {
    const r = suggestProgression({
      currentWeightKg: 100,
      targetReps: 8,
      achievedReps: 8,
      lastSetRir: 3,
      recoveredWell: false,
    });
    expect(r.ok && r.value.action).toBe("HOLD");
  });

  it("recommends reducing load when reps fell well short", () => {
    const r = suggestProgression({
      currentWeightKg: 100,
      targetReps: 8,
      achievedReps: 4,
      lastSetRir: 0,
      recoveredWell: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.action).toBe("DECREASE");
  });

  it("fails when recovery information is missing", () => {
    const r = suggestProgression({
      currentWeightKg: 100,
      targetReps: 8,
      achievedReps: 8,
      lastSetRir: 2,
      // recoveredWell omitted
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("MISSING_INPUT");
  });
});

describe("detectPlateau", () => {
  it("flags a plateau when estimated 1RM is flat across the window", () => {
    // Same weight x reps repeated -> no progress
    const r = detectPlateau({
      history: [
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      windowSize: 3,
      minImprovementPct: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.isPlateau).toBe(true);
  });

  it("does not flag a plateau when load is progressing", () => {
    const r = detectPlateau({
      history: [
        { weightKg: 100, reps: 5 },
        { weightKg: 102.5, reps: 5 },
        { weightKg: 105, reps: 5 },
      ],
      windowSize: 3,
      minImprovementPct: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.isPlateau).toBe(false);
  });

  it("fails when history is shorter than the window", () => {
    const r = detectPlateau({
      history: [{ weightKg: 100, reps: 5 }],
      windowSize: 3,
      minImprovementPct: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("MISSING_INPUT");
  });
});
