# Data Sources & Provenance

This document records where FitMind AI's seeded reference data comes from and
under which license it is used. No exercise or nutrition values are fabricated:
if a field could not be mapped verifiably from a cited source, the row (or that
field) was omitted rather than guessed.

> Compliance note: source text was paraphrased and reformatted for compliance
> with licensing restrictions. Instruction strings in the dataset are rewritten
> summaries, not verbatim copies.

## Exercise catalog

- **Source:** Free Exercise DB (`yuhonas/free-exercise-db`)
- **URL:** https://github.com/yuhonas/free-exercise-db
- **License:** Public Domain (Unlicense-style dedication). The project dedicates
  its exercise data to the public domain, so it can be reused without
  attribution requirements; we still cite it here for transparency.
- **Date retrieved:** 2025-06 (curated snapshot).
- **Where it lives:** `prisma/data/exercises.ts` (typed `CURATED_EXERCISES`),
  inserted by `prisma/seed.ts` as read-only shared catalog data.
- **Fields used (mapped onto this project's Prisma enums):**
  - source `name` → `Exercise.name` (stable unique upsert key)
  - source `primaryMuscles` → `Exercise.primaryMuscle` (`MuscleGroup`)
  - source `secondaryMuscles` → `Exercise.secondaryMuscles` (`MuscleGroup[]`)
  - source `equipment` → `Exercise.equipment` (`Equipment[]`)
  - source `level` → `Exercise.difficulty` (`ExperienceLevel`)
  - source `instructions` → `Exercise.instructions` (paraphrased summary)
- **Provenance recorded per row:** each `Exercise` row stores `sourceRef`
  (`free-exercise-db:<slug>`), `sourceName`, and `sourceLicense`.
- **Omissions:** any source row whose muscle group or equipment could not be
  mapped to one of this project's enum values was left out. Nothing was invented
  to fill gaps.

## Nutrition / food data

- **Source:** USDA FoodData Central (SR Legacy / Foundation Foods)
- **URL:** https://fdc.nal.usda.gov/
- **License:** Public domain (U.S. Government work, 17 U.S.C. 105). USDA
  FoodData Central data is a work of the U.S. federal government and carries no
  copyright, so it can be reused without attribution requirements; we still cite
  it here for transparency.
- **Date retrieved:** 2025-06 (curated snapshot).
- **Where it lives:** `prisma/data/foods.ts` (typed `CURATED_FOODS`), inserted
  by `prisma/seed.ts` as read-only shared catalog data (alongside the exercise
  catalog, in the same idempotent seed run).
- **Fields used (mapped onto the `Food` model):**
  - source food description → `Food.name` (stable unique upsert key)
  - our coarse grouping → `Food.category` (plain string: `PROTEIN`, `GRAIN`,
    `LEGUME`, `FRUIT`, `VEGETABLE`, `DAIRY`, `FAT`)
  - reference quantity → `Food.referenceQtyG` (100 g; the per-reference macros
    below describe this quantity)
  - per-100g energy → `Food.caloriesPer100g`
  - per-100g protein / carbohydrate / fat → `Food.proteinPer100g`,
    `Food.carbsPer100g`, `Food.fatPer100g`
  - source FDC ID → `Food.fdcId`, and `Food.sourceRef` as
    `usda-fdc:<fdcId>`
- **Provenance recorded per row:** each `Food` row stores `sourceRef`
  (`usda-fdc:<fdcId>`), `sourceName`
  (`USDA FoodData Central (SR Legacy / Foundation Foods)`), and `sourceLicense`
  (`Public domain (U.S. Government work, 17 U.S.C. 105)`).
- **Omissions:** any food whose macros could not be mapped verifiably from a
  cited FDC entry was left out. No nutrition value or price was invented to fill
  gaps. The catalog carries **no price data** — the app surfaces quantities only
  and never fabricates a cost.

## Optional future source (not currently used)

If exercise data is ever drawn from **wger** (https://wger.de), it must be cited
separately as **CC-BY-SA 3.0**, which requires attribution and share-alike. No
wger data is used today.

## Applying the catalog (user-run steps)

The seed inserts data only against the user's live PostgreSQL. These are
**user-run** steps — they are not executed by the build or by automated checks:

```bash
npx prisma migrate deploy   # applies 0003_exercise_library then 0004_nutrition_catalog
npm run db:seed             # upserts the curated exercises AND foods (idempotent, additive)
```

`0004_nutrition_catalog` is the additive migration that adds the `Food`
reference-quantity + provenance columns, the `DailyNutrition.totalWaterMl`
column, and the `WaterLog` table. `npm run db:seed` upserts both catalogs by
their unique `name`, so it is safe to re-run and only inserts missing rows or
refreshes existing ones.
