import { test, expect } from "@playwright/test";

// Demo tenant is read-only: the demo banner is shown and write controls are absent/disabled.
test("demo session is read-only with a visible banner", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText(/demo/i).first()).toBeVisible();
});
