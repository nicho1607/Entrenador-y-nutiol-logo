-- Phase 2 (user profile) migration.
--
-- 1. Replace the 4-value GoalType enum with the 7 product goals.
-- 2. Add new enums ExperienceLevel and Equipment.
-- 3. Extend UserProfile with the profile fields the product records.
--
-- NOTE ON GoalType: the old enum values (LOSE_FAT, MAINTAIN, GAIN_MUSCLE,
-- IMPROVE_PERFORMANCE) do not map one-to-one onto the new set, and no stable
-- FitnessGoal rows exist yet (the profile phase that writes goals is this
-- phase). We therefore swap the type cleanly. FitnessGoal.type is routed
-- through text while the enum is rebuilt. Any pre-existing value that is not
-- one of the new identifiers is mapped to the closest equivalent so the
-- re-cast cannot fail:
--   LOSE_FAT            -> FAT_LOSS
--   GAIN_MUSCLE         -> HYPERTROPHY
--   IMPROVE_PERFORMANCE -> ENDURANCE
--   MAINTAIN            -> MAINTENANCE

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'PULL_UP_BAR', 'BENCH', 'CABLE_MACHINE', 'CARDIO_MACHINE', 'FULL_GYM');

-- AlterEnum: rebuild GoalType with the 7 product goals.
-- Route FitnessGoal.type through text so the old enum can be dropped.
ALTER TABLE "FitnessGoal" ALTER COLUMN "type" TYPE TEXT USING ("type"::TEXT);

-- Remap any legacy values to the new identifiers.
UPDATE "FitnessGoal" SET "type" = 'FAT_LOSS' WHERE "type" = 'LOSE_FAT';
UPDATE "FitnessGoal" SET "type" = 'HYPERTROPHY' WHERE "type" = 'GAIN_MUSCLE';
UPDATE "FitnessGoal" SET "type" = 'ENDURANCE' WHERE "type" = 'IMPROVE_PERFORMANCE';
UPDATE "FitnessGoal" SET "type" = 'MAINTENANCE' WHERE "type" = 'MAINTAIN';

DROP TYPE "GoalType";
CREATE TYPE "GoalType" AS ENUM ('HYPERTROPHY', 'FAT_LOSS', 'RECOMPOSITION', 'WEIGHT_GAIN', 'STRENGTH', 'ENDURANCE', 'MAINTENANCE');

ALTER TABLE "FitnessGoal" ALTER COLUMN "type" TYPE "GoalType" USING ("type"::"GoalType");

-- AlterTable: extend UserProfile with the profile fields.
ALTER TABLE "UserProfile" ADD COLUMN "weightKg" DOUBLE PRECISION,
    ADD COLUMN "experienceLevel" "ExperienceLevel",
    ADD COLUMN "daysPerWeek" INTEGER,
    ADD COLUMN "sessionMinutes" INTEGER,
    ADD COLUMN "equipment" "Equipment"[],
    ADD COLUMN "dietaryPreferences" TEXT[],
    ADD COLUMN "allergies" TEXT[],
    ADD COLUMN "dietaryRestrictions" TEXT[],
    ADD COLUMN "foodBudget" DOUBLE PRECISION;
