/**
 * FitMind AI — database seed (exercise library).
 *
 * Seeds the shared, read-only reference catalogs:
 *  - the Exercise catalog from prisma/data/exercises.ts (provenance: Free
 *    Exercise DB), and
 *  - the Food catalog from prisma/data/foods.ts (provenance: USDA FoodData
 *    Central, public domain — see docs/data-sources.md).
 * Both are curated, provenance-cited datasets; no macro values are fabricated.
 *
 * The seed is idempotent: each row is upserted by its stable unique `name`, so
 * re-running updates existing rows in place rather than duplicating them.
 *
 * Run with: npm run db:seed  (requires a reachable PostgreSQL with migrations
 * 0003 and 0004 applied). This script connects to the database named in
 * DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";

import { CURATED_EXERCISES } from "./data/exercises";
import { CURATED_FOODS } from "./data/foods";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const e of CURATED_EXERCISES) {
    const existing = await prisma.exercise.findUnique({
      where: { name: e.name },
      select: { id: true },
    });

    const data = {
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: [...e.secondaryMuscles],
      equipment: [...e.equipment],
      difficulty: e.difficulty,
      instructions: e.instructions,
      sourceRef: e.sourceRef,
      sourceName: e.sourceName,
      sourceLicense: e.sourceLicense,
    };

    await prisma.exercise.upsert({
      where: { name: e.name },
      create: { name: e.name, ...data },
      update: data,
    });

    if (existing) updated += 1;
    else created += 1;
  }

  let foodsCreated = 0;
  let foodsUpdated = 0;

  for (const f of CURATED_FOODS) {
    const existing = await prisma.food.findUnique({
      where: { name: f.name },
      select: { id: true },
    });

    const data = {
      category: f.category,
      referenceQtyG: f.referenceQtyG,
      caloriesPer100g: f.caloriesPer100g,
      proteinPer100g: f.proteinPer100g,
      carbsPer100g: f.carbsPer100g,
      fatPer100g: f.fatPer100g,
      fdcId: f.fdcId,
      sourceRef: f.sourceRef,
      sourceName: f.sourceName,
      sourceLicense: f.sourceLicense,
    };

    await prisma.food.upsert({
      where: { name: f.name },
      create: { name: f.name, ...data },
      update: data,
    });

    if (existing) foodsUpdated += 1;
    else foodsCreated += 1;
  }

  console.info(
    `[seed] Exercise catalog upserted — ${created} created, ${updated} updated ` +
      `(${CURATED_EXERCISES.length} total). ` +
      `Food catalog upserted — ${foodsCreated} created, ${foodsUpdated} updated ` +
      `(${CURATED_FOODS.length} total).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
