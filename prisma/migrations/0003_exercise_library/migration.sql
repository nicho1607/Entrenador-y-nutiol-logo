-- Phase 3 (exercise library) migration.
--
-- Extends the shared Exercise catalog with the fields the trainer needs to
-- reason over movements and to record provenance for the seeded data:
--   secondaryMuscles  MuscleGroup[]      additional muscles trained
--   equipment         Equipment[]        equipment required
--   difficulty        ExperienceLevel?   relative difficulty
--   instructions      TEXT               short how-to text
--   sourceRef         TEXT               stable source key (e.g. free-exercise-db:<slug>)
--   sourceName        TEXT               human source name
--   sourceLicense     TEXT               license the data is used under
--
-- All additions are nullable scalar or array columns, so this migration is
-- additive and non-destructive (no existing data is rewritten or dropped).
-- Existing enums (MuscleGroup, Equipment, ExperienceLevel) are reused.

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "difficulty" "ExperienceLevel",
ADD COLUMN     "equipment" "Equipment"[],
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "secondaryMuscles" "MuscleGroup"[],
ADD COLUMN     "sourceLicense" TEXT,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceRef" TEXT;
