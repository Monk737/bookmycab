import { test, expect } from "@playwright/test";

// Admin provisioning is staff-only: an unauthenticated visit is blocked. page.goto
// follows redirects (the final response is the login page's 200), so assert that
// the navigation landed away from /admin rather than inspecting the status code.
test("admin console rejects unauthenticated access", async ({ page }) => {
  await page.goto("/admin");
  expect(page.url()).not.toContain("/admin");
});
