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
    await page.getByLabel("Edad (años)").fill("30");
    await page.getByLabel("Sexo fisiológico (para los cálculos de energía)").selectOption("MALE");
    await page.getByLabel("Peso (kg)").fill("80");
    await page.getByLabel("Altura (cm)").fill("180");
    await page.getByLabel("Nivel de actividad diaria").selectOption("MODERATE");
    await page.getByLabel("Objetivo principal").selectOption("HYPERTROPHY");
    await page.getByRole("button", { name: /Guardar perfil|Actualizar perfil/ }).click();

    await expect(page.getByRole("alert")).toHaveText("Perfil guardado.");
    // Computed values render BMR/TDEE once the profile has enough inputs.
    await expect(page.getByText("TMB (Mifflin-St Jeor)")).toBeVisible();
    await expect(page.getByText("GET (estimación de mantenimiento)")).toBeVisible();
  });

  test("generate and save a trainer plan", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-trainer"), TEST_PASSWORD);

    // A plan needs a profile + active goal to generate.
    await setUpProfile(page);

    await page.goto("/trainer");
    await page.getByRole("button", { name: "Generar un plan" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: "Guardar este plan" }).click();
    await expect(page.getByText("Plan guardado en tu cuenta.")).toBeVisible();
  });

  test("view nutrition targets and log a food", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-nutrition"), TEST_PASSWORD);
    await setUpProfile(page);

    // Targets derive from the profile and appear on the nutrition hub.
    await page.goto("/nutrition");
    await expect(page.getByRole("heading", { name: "Nutrición" })).toBeVisible();

    // Log a food from the seeded catalog on the daily log page.
    await page.goto("/nutrition/log");
    await page.getByLabel("Gramos").fill("150");
    await page.getByRole("button", { name: "Registrar alimento" }).click();
    await expect(page.getByRole("status")).toHaveText("Alimento registrado.");
  });

  test("import a routine from pasted JSON and save", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-import"), TEST_PASSWORD);

    await page.goto("/trainer/import");
    // Pasting from Hevy is the default; the other sources sit in a disclosure.
    await page.getByText("Otras formas de importar").click();
    await page.getByLabel("Pegar o subir JSON o CSV").check();
    await page.getByLabel(/Pega tu rutina en JSON/).fill(IMPORT_JSON);
    await page.getByRole("button", { name: "Vista previa" }).click();

    // The preview renders the normalized plan name.
    await expect(page.getByRole("heading", { name: "E2E Imported Routine" })).toBeVisible();

    await page.getByRole("button", { name: "Confirmar y guardar" }).click();
    await expect(page.getByRole("status")).toHaveText("Rutina importada y guardada.");
  });

  test("import a routine pasted from a Hevy share page", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-import-hevy"), TEST_PASSWORD);

    await page.goto("/trainer/import");
    // Same shape as the text copied from a Hevy share page.
    await page
      .getByLabel("Texto de la rutina")
      .fill(
        [
          "nico",
          "Pecho día 1 (copy)",
          "Press de Banca (Barra)",
          "5 series · 6-12 repeticiones",
          "Jalón de tríceps con cuerda",
          "4 series · 10-15 repeticiones",
          "Creado por",
        ].join("\n"),
      );
    await page.getByRole("button", { name: "Vista previa" }).click();

    await expect(page.getByText("Barbell Bench Press")).toBeVisible();
    await expect(page.getByText("Triceps Rope Pushdown")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar y guardar" }).click();
    await expect(page.getByRole("status")).toHaveText("Rutina importada y guardada.");
  });

  test("import by link refuses a non-public address", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-import-link"), TEST_PASSWORD);

    // The server downloads the link itself, so it must never reach internal
    // hosts. No outbound network is needed: the address is rejected up front.
    await page.goto("/trainer/import");
    await page.getByText("Otras formas de importar").click();
    await page.getByLabel("Enlace a un archivo JSON o CSV").check();
    await page.getByLabel("Enlace de la rutina").fill("https://127.0.0.1/rutina.json");
    await page.getByRole("button", { name: "Vista previa" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "El enlace apunta a una dirección no permitida.",
    );
  });

  test("recommendations shows the insufficient-data state for a fresh user", async ({ page }) => {
    await registerUser(page, uniqueEmail("smoke-reco"), TEST_PASSWORD);

    // A brand-new user has no logged data, so the honest "not enough data"
    // state renders rather than fabricated advice.
    await page.goto("/recommendations");
    await expect(page.getByRole("heading", { name: "Recomendaciones" })).toBeVisible();
    await expect(page.getByText("Aún no hay datos suficientes")).toBeVisible();
  });
});

/** Fill and save the minimum profile needed for plan/target computation. */
async function setUpProfile(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/profile");
  await page.getByLabel("Edad (años)").fill("30");
  await page.getByLabel("Sexo fisiológico (para los cálculos de energía)").selectOption("MALE");
  await page.getByLabel("Peso (kg)").fill("80");
  await page.getByLabel("Altura (cm)").fill("180");
  await page.getByLabel("Nivel de actividad diaria").selectOption("MODERATE");
  await page.getByLabel("Nivel de experiencia").selectOption("BEGINNER");
  await page.getByLabel("Objetivo principal").selectOption("HYPERTROPHY");
  await page.getByLabel("Días disponibles por semana").fill("3");
  await page.getByLabel("Tiempo por sesión (minutos)").fill("60");
  await page.getByRole("button", { name: /Guardar perfil|Actualizar perfil/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Perfil guardado.");
}
