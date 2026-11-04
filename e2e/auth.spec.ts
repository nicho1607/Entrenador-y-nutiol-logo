import { test, expect } from "@playwright/test";
import { registerUser, logIn, signOutUser, uniqueEmail, TEST_PASSWORD } from "./helpers";

/**
 * Authentication journey.
 *
 * EXECUTION REQUIREMENTS: requires the app running against the user's live
 * PostgreSQL database (registration and sign-in hit the DB). USER-RUN only:
 * `npx playwright install` + a migrated/seeded DB, then `npm run test:e2e`.
 * NOT executed in the authoring environment.
 *
 * Grounded in src/app/register/page.tsx, src/app/login/page.tsx, and
 * src/features/auth/sign-out-button.tsx.
 */
test("register, sign out, then log back in", async ({ page }) => {
  // A unique email keeps this idempotent against a persistent database.
  const email = uniqueEmail();

  // Register a new user; the register page auto signs-in and routes to /dashboard.
  await registerUser(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Sign out from the header; signOut routes back to the landing page.
  await signOutUser(page);
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();

  // Log back in with the same credentials and land on /dashboard again.
  await logIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("login rejects wrong credentials", async ({ page }) => {
  // Registered user, wrong password: the login page surfaces an inline error
  // and stays on /login (no redirect to /dashboard).
  const email = uniqueEmail();
  await registerUser(page, email, TEST_PASSWORD);
  await signOutUser(page);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password-999");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
