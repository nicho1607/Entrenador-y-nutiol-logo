import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E helpers for FitMind AI.
 *
 * EXECUTION REQUIREMENTS: these helpers (and every spec that imports them)
 * drive the real app and therefore require the app running against the user's
 * live PostgreSQL database. They are USER-RUN: run `npx playwright install`
 * once, make sure the DB is migrated/seeded, then `npm run test:e2e`. They are
 * NOT executed in the authoring environment (no live DB).
 *
 * Selectors here are grounded in the real pages:
 *   - src/app/register/page.tsx (labels Name/Email/Password, button "Create account")
 *   - src/app/login/page.tsx (labels Email/Password, button "Log in")
 *   - src/features/auth/sign-out-button.tsx (button "Sign out")
 * Successful auth routes to /dashboard in both pages.
 */

/** A unique email so repeated runs stay idempotent against a persistent DB. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Password that satisfies the shared register schema (>= 8 characters). */
export const TEST_PASSWORD = "test-password-123";

/**
 * Register a brand-new user through the register page and wait for the
 * post-registration redirect to /dashboard (register auto signs-in).
 */
export async function registerUser(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
  name = "E2E User",
): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

/** Log an existing user in through the login page and wait for /dashboard. */
export async function logIn(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

/** Sign the current user out via the header SignOutButton (routes to "/"). */
export async function signOutUser(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"));
}

/** Assert the browser is currently on the dashboard. */
export async function expectOnDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard$/);
}
