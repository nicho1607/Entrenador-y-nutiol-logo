import { test, expect } from "@playwright/test";

/**
 * Foundation smoke test. Full E2E suites arrive in a later phase; this one
 * confirms the landing page renders and exposes the auth entry points.
 */
test("landing page renders with auth links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});
