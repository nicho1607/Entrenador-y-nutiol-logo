/**
 * Weight-record detection: which exercises in a new batch of sets beat the
 * user's previous heaviest weight. Pure and framework-free like the rest of
 * the domain layer.
 *
 * An exercise with no prior history is NOT a record — there is nothing to
 * surpass yet. Weight in kilograms.
 */

export interface WeightRecord {
  exerciseKey: string;
  previousBestKg: number;
  newBestKg: number;
}

export function detectWeightRecords(
  previousBestKg: ReadonlyMap<string, number>,
  sets: readonly { exerciseKey: string; weightKg: number }[],
): WeightRecord[] {
  const newBest = new Map<string, number>();
  for (const s of sets) {
    newBest.set(s.exerciseKey, Math.max(newBest.get(s.exerciseKey) ?? -Infinity, s.weightKg));
  }

  const records: WeightRecord[] = [];
  for (const [exerciseKey, newBestKg] of newBest) {
    const previous = previousBestKg.get(exerciseKey);
    if (previous != null && newBestKg > previous) {
      records.push({ exerciseKey, previousBestKg: previous, newBestKg });
    }
  }
  return records;
}
