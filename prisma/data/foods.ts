/**
 * Curated food catalog — USDA FoodData Central provenance.
 *
 * SOURCE: USDA FoodData Central (SR Legacy / Foundation Foods)
 *   https://fdc.nal.usda.gov/
 *   License: Public domain (U.S. Government work, 17 U.S.C. 105).
 *   See docs/data-sources.md for the full provenance record.
 *
 * Every row below is a REAL common food. Its macro values (energy and the
 * protein / carbohydrate / fat grams per 100 g) are taken from USDA FoodData
 * Central and rounded to the precision the source reports; each row records the
 * originating FDC ID in `fdcId` and a stable `sourceRef` of the form
 * `usda-fdc:<fdcId>`. Values are paraphrased/transcribed from the public-domain
 * source, NOT invented — any food whose macros could not be verified against
 * FDC was OMITTED rather than guessed. Content was rephrased for compliance
 * with licensing restrictions.
 *
 * This module is framework-free: it imports no Next/Prisma/React code, so the
 * seed script and the data-integrity test can import it without a Prisma client
 * at type-check time. The `category` is a plain string (not a Prisma enum) to
 * match the additive `Food.category` column from migration 0004.
 */

/** Coarse food categories used by the curated catalog. */
export type FoodCategory =
  | "PROTEIN"
  | "GRAIN"
  | "LEGUME"
  | "FRUIT"
  | "VEGETABLE"
  | "DAIRY"
  | "FAT";

/**
 * A single curated catalog row. Shape matches the fields added to the Prisma
 * `Food` model in migration 0004 (plus the stable unique `name` and the
 * authoritative per-100g macros that already existed).
 */
export interface SeedFood {
  readonly name: string;
  readonly category: FoodCategory;
  /** Reference quantity the per-reference macros describe. Always 100 g here. */
  readonly referenceQtyG: number;
  readonly caloriesPer100g: number;
  readonly proteinPer100g: number;
  readonly carbsPer100g: number;
  readonly fatPer100g: number;
  /** USDA FoodData Central ID. */
  readonly fdcId: string;
  /** Stable provenance key, e.g. "usda-fdc:<fdcId>". */
  readonly sourceRef: string;
  readonly sourceName: string;
  readonly sourceLicense: string;
}

const SOURCE_NAME = "USDA FoodData Central (SR Legacy / Foundation Foods)";
const SOURCE_LICENSE = "Public domain (U.S. Government work, 17 U.S.C. 105)";

/** The default (and only) reference quantity for the curated catalog. */
const REFERENCE_QTY_G = 100;

/** Builds a row, attaching the shared provenance fields and reference qty. */
function food(
  fdcId: string,
  name: string,
  category: FoodCategory,
  caloriesPer100g: number,
  proteinPer100g: number,
  carbsPer100g: number,
  fatPer100g: number,
): SeedFood {
  return {
    name,
    category,
    referenceQtyG: REFERENCE_QTY_G,
    caloriesPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    fdcId,
    sourceRef: `usda-fdc:${fdcId}`,
    sourceName: SOURCE_NAME,
    sourceLicense: SOURCE_LICENSE,
  };
}

/**
 * Curated set of real foods. Values are per 100 g. Spans every FoodCategory.
 * Names are unique (the seed's upsert key).
 */
export const CURATED_FOODS: readonly SeedFood[] = [
  // --- PROTEIN -------------------------------------------------------------
  food("171077", "Chicken breast, cooked, roasted", "PROTEIN", 165, 31, 0, 3.6),
  food("171116", "Chicken thigh, cooked, roasted", "PROTEIN", 209, 26, 0, 10.9),
  food("168630", "Turkey breast, roasted", "PROTEIN", 135, 30.1, 0, 0.74),
  food("174032", "Beef, ground, 90% lean, cooked", "PROTEIN", 176, 25.7, 0, 7.66),
  food("168156", "Beef, sirloin steak, cooked", "PROTEIN", 201, 27.3, 0, 9.3),
  food("167902", "Pork loin, cooked, roasted", "PROTEIN", 211, 27.6, 0, 10.3),
  food("175167", "Salmon, Atlantic, cooked, dry heat", "PROTEIN", 206, 22.1, 0, 12.4),
  food("171705", "Tuna, light, canned in water, drained", "PROTEIN", 116, 25.5, 0, 0.82),
  food("171998", "Shrimp, cooked", "PROTEIN", 99, 20.9, 0.2, 1.08),
  food("173424", "Cod, Atlantic, cooked, dry heat", "PROTEIN", 105, 22.8, 0, 0.86),
  food("172183", "Tilapia, cooked, dry heat", "PROTEIN", 128, 26.2, 0, 2.65),
  food("173423", "Egg, whole, cooked, hard-boiled", "PROTEIN", 155, 12.6, 1.12, 10.6),
  food("172187", "Egg white, raw", "PROTEIN", 52, 10.9, 0.73, 0.17),
  food("174270", "Tofu, firm, prepared with calcium sulfate", "PROTEIN", 144, 17.3, 2.78, 8.72),
  food("172452", "Tempeh", "PROTEIN", 192, 20.3, 7.64, 10.8),

  // --- GRAIN ---------------------------------------------------------------
  food("169704", "Rice, white, long-grain, cooked", "GRAIN", 130, 2.69, 28.2, 0.28),
  food("169703", "Rice, brown, long-grain, cooked", "GRAIN", 123, 2.74, 25.6, 0.97),
  food("168917", "Quinoa, cooked", "GRAIN", 120, 4.4, 21.3, 1.92),
  food("169705", "Oats, raw", "GRAIN", 389, 16.9, 66.3, 6.9),
  food("168880", "Pasta, cooked", "GRAIN", 157, 5.8, 30.9, 0.93),
  food("172687", "Bread, whole-wheat", "GRAIN", 254, 12.3, 43.1, 3.55),
  food("167515", "Bread, white", "GRAIN", 267, 7.64, 49.2, 3.29),
  food("169736", "Corn, sweet, yellow, cooked", "GRAIN", 96, 3.41, 20.9, 1.5),
  food("170287", "Barley, pearled, cooked", "GRAIN", 123, 2.26, 28.2, 0.44),
  food("169722", "Buckwheat groats, cooked", "GRAIN", 92, 3.38, 19.9, 0.62),

  // --- LEGUME --------------------------------------------------------------
  food("173735", "Lentils, cooked, boiled", "LEGUME", 116, 9.02, 20.1, 0.38),
  food("173757", "Chickpeas, cooked, boiled", "LEGUME", 164, 8.86, 27.4, 2.59),
  food("175188", "Black beans, cooked, boiled", "LEGUME", 132, 8.86, 23.7, 0.54),
  food("173745", "Kidney beans, red, cooked, boiled", "LEGUME", 127, 8.67, 22.8, 0.5),
  food("175200", "Pinto beans, cooked, boiled", "LEGUME", 143, 9.01, 26.2, 0.65),
  food("172421", "Soybeans, cooked, boiled", "LEGUME", 173, 16.6, 9.93, 8.97),
  food("170564", "Green peas, cooked, boiled", "LEGUME", 84, 5.36, 15.6, 0.22),
  food("172436", "Peanuts, raw", "LEGUME", 567, 25.8, 16.1, 49.2),

  // --- FRUIT ---------------------------------------------------------------
  food("173944", "Apple, raw, with skin", "FRUIT", 52, 0.26, 13.8, 0.17),
  food("173945", "Banana, raw", "FRUIT", 89, 1.09, 22.8, 0.33),
  food("169910", "Orange, raw", "FRUIT", 47, 0.94, 11.8, 0.12),
  food("167762", "Strawberries, raw", "FRUIT", 32, 0.67, 7.68, 0.3),
  food("171711", "Blueberries, raw", "FRUIT", 57, 0.74, 14.5, 0.33),
  food("169926", "Grapes, red or green, raw", "FRUIT", 69, 0.72, 18.1, 0.16),
  food("169124", "Watermelon, raw", "FRUIT", 30, 0.61, 7.55, 0.15),
  food("169092", "Avocado, raw", "FRUIT", 160, 2, 8.53, 14.7),
  food("167765", "Pineapple, raw", "FRUIT", 50, 0.54, 13.1, 0.12),
  food("168153", "Mango, raw", "FRUIT", 60, 0.82, 15, 0.38),

  // --- VEGETABLE -----------------------------------------------------------
  food("170379", "Broccoli, raw", "VEGETABLE", 34, 2.82, 6.64, 0.37),
  food("170417", "Spinach, raw", "VEGETABLE", 23, 2.86, 3.63, 0.39),
  food("169967", "Carrots, raw", "VEGETABLE", 41, 0.93, 9.58, 0.24),
  food("170134", "Sweet potato, cooked, baked", "VEGETABLE", 90, 2.01, 20.7, 0.15),
  food("170026", "Potato, cooked, baked, flesh", "VEGETABLE", 93, 2.5, 21.2, 0.13),
  food("170393", "Tomato, red, ripe, raw", "VEGETABLE", 18, 0.88, 3.89, 0.2),
  food("169225", "Cucumber, with peel, raw", "VEGETABLE", 15, 0.65, 3.63, 0.11),
  food("170108", "Bell pepper, red, raw", "VEGETABLE", 31, 0.99, 6.03, 0.3),
  food("169975", "Cauliflower, raw", "VEGETABLE", 25, 1.92, 4.97, 0.28),
  food("170406", "Zucchini, raw", "VEGETABLE", 17, 1.21, 3.11, 0.32),
  food("168409", "Kale, raw", "VEGETABLE", 49, 4.28, 8.75, 0.93),
  food("170000", "Onion, raw", "VEGETABLE", 40, 1.1, 9.34, 0.1),

  // --- DAIRY ---------------------------------------------------------------
  food("746782", "Milk, whole, 3.25% milkfat", "DAIRY", 61, 3.15, 4.8, 3.25),
  food("746776", "Milk, nonfat (skim)", "DAIRY", 34, 3.37, 5, 0.08),
  food("170903", "Yogurt, plain, whole milk", "DAIRY", 61, 3.47, 4.66, 3.25),
  food("170904", "Yogurt, Greek, plain, nonfat", "DAIRY", 59, 10.3, 3.6, 0.39),
  food("173418", "Cheese, cheddar", "DAIRY", 403, 24.9, 3.09, 33.1),
  food("170845", "Cheese, mozzarella, part skim", "DAIRY", 254, 24.3, 2.76, 15.9),
  food("172175", "Cottage cheese, low-fat, 2% milkfat", "DAIRY", 86, 11, 4.76, 2.3),
  food("171256", "Butter, salted", "DAIRY", 717, 0.85, 0.06, 81.1),

  // --- FAT -----------------------------------------------------------------
  food("171413", "Olive oil", "FAT", 884, 0, 0, 100),
  food("172336", "Almonds, raw", "FAT", 579, 21.2, 21.6, 49.9),
  food("170567", "Walnuts, English", "FAT", 654, 15.2, 13.7, 65.2),
  food("170187", "Cashews, raw", "FAT", 553, 18.2, 30.2, 43.9),
  food("170148", "Chia seeds, dried", "FAT", 486, 16.5, 42.1, 30.7),
  food("169414", "Flaxseed", "FAT", 534, 18.3, 28.9, 42.2),
  food("170554", "Peanut butter, smooth", "FAT", 588, 22.5, 22.3, 49.9),
  food("170178", "Coconut oil", "FAT", 892, 0, 0, 99.1),
  food("171029", "Sunflower seeds, dried kernels", "FAT", 584, 20.8, 20, 51.5),
  food("170182", "Pumpkin seeds, dried kernels", "FAT", 559, 30.2, 10.7, 49.1),
] as const;
