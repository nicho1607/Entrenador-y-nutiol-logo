-- Phase 4 (nutrition catalog) migration.
--
-- Extends the shared Food catalog with a reference quantity and provenance
-- (mirroring how 0003 added provenance to Exercise), adds a cached water total
-- to DailyNutrition, and introduces a user-owned WaterLog raw-log table:
--   Food.referenceQtyG  DOUBLE PRECISION   reference qty the macros describe (default 100 g)
--   Food.category       TEXT               coarse category (PROTEIN/GRAIN/.../FAT)
--   Food.sourceRef      TEXT               stable source key (e.g. usda-fdc:<fdcId>)
--   Food.sourceName     TEXT               human source name
--   Food.sourceLicense  TEXT               license the data is used under
--   Food.fdcId          TEXT               USDA FoodData Central ID when applicable
--   DailyNutrition.totalWaterMl  DOUBLE PRECISION NOT NULL DEFAULT 0  cached per-day water total
--   WaterLog            new user-owned raw log of water intake
--
-- All Food/DailyNutrition changes are additive (nullable columns, or a NOT
-- NULL column with a DEFAULT), and WaterLog is a brand-new table, so this
-- migration is additive and non-destructive: no existing column is rewritten,
-- renamed, or dropped. Existing types are reused; no new enum is introduced.

-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "category" TEXT,
ADD COLUMN     "fdcId" TEXT,
ADD COLUMN     "referenceQtyG" DOUBLE PRECISION,
ADD COLUMN     "sourceLicense" TEXT,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "DailyNutrition" ADD COLUMN     "totalWaterMl" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WaterLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMl" DOUBLE PRECISION NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaterLog_userId_idx" ON "WaterLog"("userId");

-- CreateIndex
CREATE INDEX "WaterLog_loggedAt_idx" ON "WaterLog"("loggedAt");

-- AddForeignKey
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
