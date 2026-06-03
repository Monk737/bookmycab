import { test, expect } from "@playwright/test";

// Admin provisioning is staff-only: an unauthenticated visit is blocked, never 200-rendered.
test("admin console rejects unauthenticated access", async ({ page }) => {
  const res = await page.goto("/admin");
  expect(res?.status()).toBeGreaterThanOrEqual(300);
});
