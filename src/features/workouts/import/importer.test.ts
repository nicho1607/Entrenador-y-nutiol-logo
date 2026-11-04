import { describe, it, expect } from "vitest";
import { importRoutineFromJson, importRoutineFromCsv } from "./importer";

const VALID_JSON = JSON.stringify({
  name: "Push Pull Legs",
  description: "3-day split",
  days: [
    {
      name: "Push",
      order: 1,
      exercises: [
        { name: "Bench Press", muscle: "CHEST", sets: 4, repsMin: 6, repsMax: 10, restSeconds: 120, targetRir: 2 },
        { name: "Overhead Press", muscle: "SHOULDERS", sets: 3, repsMin: 8, repsMax: 12 },
      ],
    },
    {
      name: "Pull",
      order: 2,
      exercises: [{ name: "Deadlift", muscle: "BACK", sets: 3, repsMin: 3, repsMax: 5 }],
    },
  ],
});

describe("importRoutineFromJson", () => {
  it("maps a valid plan into the internal shape", () => {
    const result = importRoutineFromJson(VALID_JSON);
    expect(result.plan).not.toBeNull();
    expect(result.rejected).toHaveLength(0);
    expect(result.importedCount).toBe(3);
    const plan = result.plan!;
    expect(plan.name).toBe("Push Pull Legs");
    expect(plan.days).toHaveLength(2);
    expect(plan.days[0]!.exercises[0]!.exerciseName).toBe("Bench Press");
    expect(plan.days[0]!.exercises[1]!.restSeconds).toBeNull();
    expect(plan.days[0]!.exercises[1]!.targetRir).toBeNull();
  });

  it("rejects the whole import when top-level JSON is invalid", () => {
    const result = importRoutineFromJson('{"name":"","days":[]}');
    expect(result.plan).toBeNull();
    expect(result.rejected.length).toBeGreaterThan(0);
    expect(result.importedCount).toBe(0);
  });

  it("rejects invalid JSON syntax with a clear reason", () => {
    const result = importRoutineFromJson("{not json");
    expect(result.plan).toBeNull();
    expect(result.rejected[0]!.reason).toMatch(/json/i);
  });
});

const VALID_CSV = [
  "planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax,restSeconds,targetRir",
  "Upper Lower,Upper,1,Bench Press,CHEST,4,6,10,120,2",
  "Upper Lower,Upper,1,Row,BACK,4,8,12,90,",
  "Upper Lower,Lower,2,Squat,QUADS,5,5,5,180,1",
].join("\n");

describe("importRoutineFromCsv", () => {
  it("groups CSV rows into days and maps exercises", () => {
    const result = importRoutineFromCsv(VALID_CSV);
    expect(result.plan).not.toBeNull();
    expect(result.importedCount).toBe(3);
    expect(result.rejected).toHaveLength(0);
    const plan = result.plan!;
    expect(plan.name).toBe("Upper Lower");
    expect(plan.days).toHaveLength(2);
    expect(plan.days[0]!.name).toBe("Upper");
    expect(plan.days[0]!.exercises).toHaveLength(2);
    expect(plan.days[0]!.exercises[1]!.restSeconds).toBe(90);
    expect(plan.days[0]!.exercises[1]!.targetRir).toBeNull();
  });

  it("annotates and skips rows it cannot map, keeping valid ones", () => {
    const csv = [
      "planName,dayName,dayOrder,exerciseName,muscle,sets,repsMin,repsMax,restSeconds,targetRir",
      "Plan,Day A,1,Good,CHEST,3,8,12,60,2",
      "Plan,Day A,1,Bad,NOT_A_MUSCLE,3,8,12,60,2",
      "Plan,Day A,1,BadReps,CHEST,3,12,8,60,2",
    ].join("\n");
    const result = importRoutineFromCsv(csv);
    expect(result.importedCount).toBe(1);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0]!.index).toBe(2);
    expect(result.plan!.days[0]!.exercises).toHaveLength(1);
  });

  it("fails cleanly on an empty CSV", () => {
    const result = importRoutineFromCsv("");
    expect(result.plan).toBeNull();
    expect(result.rejected.length).toBeGreaterThan(0);
  });

  it("fails when required headers are missing", () => {
    const csv = "foo,bar\n1,2";
    const result = importRoutineFromCsv(csv);
    expect(result.plan).toBeNull();
    expect(result.rejected[0]!.reason).toMatch(/encabezado/i);
  });
});
