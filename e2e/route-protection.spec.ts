import { test, expect } from "@playwright/test";

/**
 * Route protection.
 *
 * EXECUTION REQUIREMENTS: requires the app running against the user's live
 * PostgreSQL database. USER-RUN only: `npx playwright install` + a
 * migrated/seeded DB, then `npm run test:e2e`. NOT executed in the authoring
 * environment.
 *
 * Each protected route redirects an unauthenticated visitor to /login. This is
 * enforced by the NextAuth middleware (src/middleware.ts matcher, expanded in
 * FEAT-001 to cover these paths) and, as defense in depth, by each page's
 * server-side getCurrentUser() + redirect("/login") guard.
 */
const PROTECTED_PATHS = [
  "/dashboard",
  "/profile",
  "/trainer",
  "/nutrition",
  "/recommendations",
  "/exercises",
  "/dashboard/stats",
  "/trainer/import",
] as const;

for (const path of PROTECTED_PATHS) {
  test(`unauthenticated visit to ${path} redirects to /login`, async ({ page }) => {
    // A fresh page/context carries no session cookie.
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}
