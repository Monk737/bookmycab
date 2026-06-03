import { test, expect } from "@playwright/test";

// Manage flow: a cancelled/managed conversation is visible in the transcript view.
test("manage/cancel conversation is listed with its outcome", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: /conversations/i }).first().click();
  await expect(page.getByText(/managed|cancelled/i).first()).toBeVisible();
});
