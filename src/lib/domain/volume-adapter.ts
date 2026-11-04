/**
 * Pure adapter from logged sets to the domain `VolumeEntry[]` shape.
 *
 * Framework-free (no Prisma import): the persistence layer passes plain logged
 * sets in, this maps them to the `VolumeEntry` contract, and the EXISTING
 * `calculateTrainingVolume` does the math. Keeping the mapping here (not in the
 * service) lets it be unit-tested without a database.
 */
import { type VolumeEntry } from "./training";
import { type MuscleGroup } from "./types-training";

/** A single logged set, reduced to the fields volume needs. */
export interface LoggedSet {
  readonly muscle: MuscleGroup;
  readonly reps: number;
}

/**
 * Maps logged sets to `VolumeEntry[]`: each logged set is one working set
 * (`sets: 1`) at that set's `reps`, attributed to the exercise's primary
 * muscle. `calculateTrainingVolume` then sums `sets * reps` per muscle, so N
 * logged sets of R reps aggregate to the correct N*R rep-volume.
 */
export function logsToVolumeEntries(logs: readonly LoggedSet[]): VolumeEntry[] {
  return logs.map((l) => ({ muscle: l.muscle, sets: 1, reps: l.reps }));
}
