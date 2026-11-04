import { describe, it, expect } from "vitest";
import {
  bucketByPeriod,
  comparePeriods,
  computeAdherencePct,
  computeTargetCompliancePct,
  estimate1RM,
  personalRecords,
  topSetE1rmOverTime,
  type ComplianceDay,
} from "./stats";

describe("bucketByPeriod", () => {
  it("groups items across two ISO weeks into the right ordered buckets", () => {
    // 2024-01-03 is a Wednesday (week starting Mon 2024-01-01).
    // 2024-01-10 is the next Wednesday (week starting Mon 2024-01-08).
    const items = [
      { id: "b", date: new Date("2024-01-10T12:00:00Z") },
      { id: "a1", date: new Date("2024-01-03T09:00:00Z") },
      { id: "a2", date: new Date("2024-01-05T23:00:00Z") },
    ];
    const r = bucketByPeriod({ items, getDate: (i) => i.date, period: "week" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(2);
      // Chronological order: first week, then second.
      expect(r.value[0]!.key).toBe(new Date(Date.UTC(2024, 0, 1)).toISOString());
      expect(r.value[0]!.items.map((i) => i.id)).toEqual(["a1", "a2"]);
      expect(r.value[1]!.key).toBe(new Date(Date.UTC(2024, 0, 8)).toISOString());
      expect(r.value[1]!.items.map((i) => i.id)).toEqual(["b"]);
    }
  });

  it("returns ok([]) for empty items", () => {
    const r = bucketByPeriod<{ date: Date }>({ items: [], getDate: (i) => i.date, period: "day" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(0);
  });

  it("fails on an invalid date", () => {
    const r = bucketByPeriod({
      items: [{ date: new Date("not-a-date") }],
      getDate: (i) => i.date,
      period: "month",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("estimate1RM", () => {
  it("computes Epley e1RM: 100kg x5 -> ~116.7", () => {
    const r = estimate1RM({ weightKg: 100, reps: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(116.67, 1);
  });

  it("fails on non-positive input", () => {
    const r = estimate1RM({ weightKg: 0, reps: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("topSetE1rmOverTime", () => {
  it("reduces to the max e1RM per bucket in chronological order", () => {
    const sets = [
      { weightKg: 100, reps: 5, date: new Date("2024-01-03T10:00:00Z") }, // ~116.7
      { weightKg: 110, reps: 3, date: new Date("2024-01-05T10:00:00Z") }, // ~121.0
      { weightKg: 120, reps: 2, date: new Date("2024-01-10T10:00:00Z") }, // ~128.0
    ];
    const r = topSetE1rmOverTime({ sets, period: "week" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(2);
      expect(r.value[0]!.e1rm).toBeCloseTo(121, 0);
      expect(r.value[1]!.e1rm).toBeCloseTo(128, 0);
    }
  });
});

describe("personalRecords", () => {
  it("selects the max weight and max e1RM per exercise", () => {
    const r = personalRecords([
      { exerciseKey: "Bench Press", weightKg: 100, reps: 5, date: new Date("2024-01-01") }, // e1RM ~116.7
      { exerciseKey: "Bench Press", weightKg: 90, reps: 10, date: new Date("2024-01-08") }, // e1RM 120, lighter weight
      { exerciseKey: "Squat", weightKg: 140, reps: 3, date: new Date("2024-01-02") },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(2);
      // Sorted by exerciseKey ascending: Bench Press, Squat.
      const bench = r.value[0]!;
      expect(bench.exerciseKey).toBe("Bench Press");
      expect(bench.maxWeightKg).toBe(100);
      expect(bench.maxE1rm).toBeCloseTo(120, 0); // the 90x10 set wins on e1RM
      expect(r.value[1]!.exerciseKey).toBe("Squat");
    }
  });

  it("returns ok([]) for no sets", () => {
    const r = personalRecords([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(0);
  });
});

describe("computeAdherencePct", () => {
  it("returns 75 for 3 of 4", () => {
    const r = computeAdherencePct({ planned: 4, completed: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(75);
  });

  it("clamps above 100 down to 100", () => {
    const r = computeAdherencePct({ planned: 4, completed: 6 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(100);
  });

  it("returns the neutral 0 when nothing was planned", () => {
    const r = computeAdherencePct({ planned: 0, completed: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  it("fails on a negative completed count", () => {
    const r = computeAdherencePct({ planned: 4, completed: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_INPUT");
  });
});

describe("computeTargetCompliancePct", () => {
  const onTargetDay: ComplianceDay = {
    consumedCalories: 2000,
    targetCalories: 2000,
    consumedProteinG: 150,
    targetProteinG: 150,
    consumedCarbsG: 200,
    targetCarbsG: 200,
    consumedFatG: 66,
    targetFatG: 66,
  };
  const missDay: ComplianceDay = {
    consumedCalories: 1200, // well under the +/-10% calorie band
    targetCalories: 2000,
    consumedProteinG: 80,
    targetProteinG: 150,
    consumedCarbsG: 100,
    targetCarbsG: 200,
    consumedFatG: 30,
    targetFatG: 66,
  };

  it("scores a mixed hit/miss set of days correctly", () => {
    const r = computeTargetCompliancePct({ days: [onTargetDay, onTargetDay, missDay, missDay] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(50);
  });

  it("returns ok(0) for empty days", () => {
    const r = computeTargetCompliancePct({ days: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });
});

describe("comparePeriods", () => {
  it("reports UP with correct deltas on an increase", () => {
    const r = comparePeriods({ current: 120, previous: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.direction).toBe("UP");
      expect(r.value.absoluteDelta).toBe(20);
      expect(r.value.percentDelta).toBeCloseTo(20, 5);
    }
  });

  it("returns a null percentDelta (not Infinity) when previous is 0", () => {
    const r = comparePeriods({ current: 50, previous: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.percentDelta).toBeNull();
      expect(r.value.direction).toBe("UP");
      expect(r.value.absoluteDelta).toBe(50);
    }
  });
});
