import { describe, it, expect } from "vitest";
import { detectWeightRecords } from "./weight-records";

describe("detectWeightRecords", () => {
  const previous = new Map([
    ["Barbell Squat", 100],
    ["Barbell Curl", 30],
  ]);

  it("reports the heaviest new set per exercise that beats the previous best", () => {
    const records = detectWeightRecords(previous, [
      { exerciseKey: "Barbell Squat", weightKg: 95 },
      { exerciseKey: "Barbell Squat", weightKg: 105 },
      { exerciseKey: "Barbell Squat", weightKg: 102.5 },
    ]);
    expect(records).toEqual([
      { exerciseKey: "Barbell Squat", previousBestKg: 100, newBestKg: 105 },
    ]);
  });

  it("does not report matching or lower weights", () => {
    expect(
      detectWeightRecords(previous, [
        { exerciseKey: "Barbell Squat", weightKg: 100 },
        { exerciseKey: "Barbell Curl", weightKg: 25 },
      ]),
    ).toEqual([]);
  });

  it("does not treat an exercise's first ever sets as a record", () => {
    expect(detectWeightRecords(previous, [{ exerciseKey: "Leg Press", weightKg: 200 }])).toEqual(
      [],
    );
  });

  it("counts beating a previous 0 kg (bodyweight) best", () => {
    expect(
      detectWeightRecords(new Map([["Pull-Up", 0]]), [{ exerciseKey: "Pull-Up", weightKg: 5 }]),
    ).toEqual([{ exerciseKey: "Pull-Up", previousBestKg: 0, newBestKg: 5 }]);
  });
});
