import { test, expect } from "@playwright/test";
import { registerUser, uniqueEmail, TEST_PASSWORD } from "./helpers";

/**
 * Happy-path smoke journeys for a signed-in user.
 *
 * EXECUTION REQUIREMENTS: requires the app running against the user's live
 * PostgreSQL database with the curated catalog seeded (foods + exercises), so
 * the nutrition log and the routine import can map real rows. USER-RUN only:
 * `npx playwright install` + a migrated/seeded DB, then `npm run test:e2e`.
 * NOT executed in the authoring environment.
 *
 * Selectors are grounded in the real pages/forms:
 *   - src/features/profile/profile-form.tsx + derived-values.tsx (/profile)
 *   - src/features/trainer/generate-plan-form.tsx (/trainer)
 *   - src/features/nutrition/food-log-form.tsx (/nutrition/log)
 *   - src/features/workouts/import/import-routine-form.tsx (/trainer/import)
 *   - src/app/recommendations/page.tsx (/recommendations)
 * Import JSON uses the documented format (docs/routine-import-format.md) with
 * exercise names from the seeded library (prisma/data/exercises.ts).
 */

/** A routine in the documented JSON format, with real seeded exercise names. */
const IMPORT_JSON = JSON.stringify({
  name: "E2E Imported Routine",
  description: "Imported during the smoke journey",
  days: [
    {
      name: "Push",
      order: 1,
      exercises: [
        {
          name: "Barbell Bench Press",
          muscle: "CHEST",
          sets: 4,
          repsMin: 6,
          repsMax: 10,
          restSeconds: 120,
          targetRir: 2,
        },
        {
          name: "Overhead Barbell Press",
          muscle: "SHOULDERS",
          sets: 3,
          repsMin: 8,
          repsMax: 12,
        },
      ],
    },
  ],
});

test.describe("signed-in smoke journeys", () => {
  // Each test registers a fresh unique user so the suite stays idempotent.
  test("profile create shows computed values", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-profile"), TEST_PASSWORD);

    await page.goto("/profile");
    await page.getByLabel("Age (years)").fill("30");
    await page.getByLabel("Physiological sex (for energy calculations)").selectOption("MALE");
    await page.getByLabel("Weight (kg)").fill("80");
    await page.getByLabel("Height (cm)").fill("180");
    await page.getByLabel("Everyday activity level").selectOption("MODERATE");
    await page.getByLabel("Primary goal").selectOption("HYPERTROPHY");
    await page.getByRole("button", { name: /Save profile|Update profile/ }).click();

    await expect(page.getByRole("alert")).toHaveText("Profile saved.");
    // Computed values render BMR/TDEE once the profile has enough inputs.
    await expect(page.getByText("BMR (Mifflin-St Jeor)")).toBeVisible();
    await expect(page.getByText("TDEE (maintenance estimate)")).toBeVisible();
  });

  test("generate and save a trainer plan", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-trainer"), TEST_PASSWORD);

    // A plan needs a profile + active goal to generate.
    await setUpProfile(page);

    await page.goto("/trainer");
    await page.getByRole("button", { name: "Generate a plan" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: "Save this plan" }).click();
    await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  });

  test("view nutrition targets and log a food", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-nutrition"), TEST_PASSWORD);
    await setUpProfile(page);

    // Targets derive from the profile and appear on the nutrition hub.
    await page.goto("/nutrition");
    await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible();

    // Log a food from the seeded catalog on the daily log page.
    await page.goto("/nutrition/log");
    await page.getByLabel("Grams").fill("150");
    await page.getByRole("button", { name: "Log food" }).click();
    await expect(page.getByRole("status")).toHaveText("Food logged.");
  });

  test("import a routine from pasted JSON and save", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-import"), TEST_PASSWORD);

    await page.goto("/trainer/import");
    await page.getByLabel(/Paste your .* routine/).fill(IMPORT_JSON);
    await page.getByRole("button", { name: "Preview" }).click();

    // The preview renders the normalized plan name.
    await expect(
      page.getByRole("heading", { name: "E2E Imported Routine" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confirm & save" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("recommendations shows the insufficient-data state for a fresh user", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-reco"), TEST_PASSWORD);

    // A brand-new user has no logged data, so the honest "not enough data"
    // state renders rather than fabricated advice.
    await page.goto("/recommendations");
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByText("Not enough data yet")).toBeVisible();
  });
});

/** Fill and save the minimum profile needed for plan/target computation. */
async function setUpProfile(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/profile");
  await page.getByLabel("Age (years)").fill("30");
  await page.getByLabel("Physiological sex (for energy calculations)").selectOption("MALE");
  await page.getByLabel("Weight (kg)").fill("80");
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByLabel("Everyday activity level").selectOption("MODERATE");
  await page.getByLabel("Experience level").selectOption("BEGINNER");
  await page.getByLabel("Primary goal").selectOption("HYPERTROPHY");
  await page.getByLabel("Days available per week").fill("3");
  await page.getByLabel("Time per session (minutes)").fill("60");
  await page.getByRole("button", { name: /Save profile|Update profile/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Profile saved.");
}
