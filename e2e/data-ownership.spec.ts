import { test, expect } from "@playwright/test";
import { registerUser, signOutUser, uniqueEmail, TEST_PASSWORD } from "./helpers";

/**
 * Data-ownership surface check.
 *
 * EXECUTION REQUIREMENTS: requires the app running against the user's live
 * PostgreSQL database. USER-RUN only: `npx playwright install` + a
 * migrated/seeded DB, then `npm run test:e2e`. NOT executed in the authoring
 * environment.
 *
 * SCOPE / LIMITATION: this is a surface-level ownership check, NOT an
 * exhaustive authorization proof. The real guarantee lives server-side: every
 * service function scopes its queries to the session user's id sourced from
 * getCurrentUser() (src/features/auth/session.ts), and the client never
 * supplies a userId. Here we verify the observable consequences: (1) a second,
 * independent user sees only their own (empty) data, and (2) the public
 * register API contract exposes no read parameter for another user's id.
 */
test("a fresh second user sees only their own empty data", async ({ page }) => {
  // User A registers and creates a plan so there IS cross-user data to leak.
  const emailA = uniqueEmail("owner-a");
  await registerUser(page, emailA, TEST_PASSWORD);
  await page.goto("/trainer");
  await page.getByRole("button", { name: "Generate a plan" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  await signOutUser(page);

  // User B registers fresh and visits the same page. Because reads are scoped
  // to the session user's id, user B must see the empty-state copy, never
  // user A's saved plan.
  const emailB = uniqueEmail("owner-b");
  await registerUser(page, emailB, TEST_PASSWORD);
  await page.goto("/trainer");
  await expect(
    page.getByText("You haven't saved any plans yet.", { exact: false }),
  ).toBeVisible();
});

test("register API exposes no caller-supplied userId read parameter", async ({ request }) => {
  // Attempting to register while passing a userId must not let the client
  // choose an identity: the field is ignored (the server derives identity from
  // the created account / session), so the request succeeds or fails purely on
  // the credential fields, never binding to an injected userId.
  const email = uniqueEmail("inject");
  const res = await request.post("/api/register", {
    data: {
      name: "Injected",
      email,
      password: TEST_PASSWORD,
      userId: "some-other-users-id",
    },
  });

  // The contract either accepts the valid credentials (ignoring the extra
  // field) or rejects the payload — it must NOT honor the injected userId.
  expect([200, 201, 400, 409, 422]).toContain(res.status());
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === "object") {
    // No userId we supplied should be echoed back as an accepted identity.
    expect(JSON.stringify(body)).not.toContain("some-other-users-id");
  }
});
