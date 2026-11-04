import { describe, it, expect } from "vitest";

import { logsToVolumeEntries, type LoggedSet } from "./volume-adapter";
import {
  calculateTrainingVolume,
  detectPlateau,
  suggestProgression,
} from "./training";

describe("logsToVolumeEntries", () => {
  it("maps each logged set to one working set at that set's reps", () => {
    const logs: LoggedSet[] = [
      { muscle: "CHEST", reps: 10 },
      { muscle: "CHEST", reps: 8 },
      { muscle: "BACK", reps: 12 },
    ];
    const entries = logsToVolumeEntries(logs);
    expect(entries).toEqual([
      { muscle: "CHEST", sets: 1, reps: 10 },
      { muscle: "CHEST", sets: 1, reps: 8 },
      { muscle: "BACK", sets: 1, reps: 12 },
    ]);
  });

  it("maps an empty log list to an empty entry list", () => {
    expect(logsToVolumeEntries([])).toEqual([]);
  });
});

describe("volume adapter + calculateTrainingVolume aggregation", () => {
  it("aggregates logged sets to the correct per-muscle rep-volume", () => {
    // CHEST: three sets of 10, 10, 8 reps -> 28 ; BACK: 12 + 12 -> 24.
    const logs: LoggedSet[] = [
      { muscle: "CHEST", reps: 10 },
      { muscle: "CHEST", reps: 10 },
      { muscle: "CHEST", reps: 8 },
      { muscle: "BACK", reps: 12 },
      { muscle: "BACK", reps: 12 },
    ];
    const result = calculateTrainingVolume(logsToVolumeEntries(logs));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.CHEST).toBe(28);
      expect(result.value.BACK).toBe(24);
    }
  });

  it("returns an empty volume map when there are no logged sets", () => {
    const result = calculateTrainingVolume(logsToVolumeEntries([]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.value)).toHaveLength(0);
  });
});

describe("history surfacing uses the existing domain helpers", () => {
  it("flags a plateau via detectPlateau when estimated 1RM is flat", () => {
    // Same weight x reps across the window -> no progress.
    const history = [
      { weightKg: 60, reps: 8 },
      { weightKg: 60, reps: 8 },
      { weightKg: 60, reps: 8 },
    ];
    const result = detectPlateau({ history, windowSize: 3, minImprovementPct: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isPlateau).toBe(true);
  });

  it("defers progression to suggestProgression, which needs recovery info", () => {
    // Without recoveredWell the domain rule withholds a decision.
    const result = suggestProgression({
      currentWeightKg: 60,
      targetReps: 8,
      achievedReps: 8,
      lastSetRir: 2,
      recoveredWell: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_INPUT");
  });
});
