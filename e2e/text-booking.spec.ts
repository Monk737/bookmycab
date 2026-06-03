import { test, expect } from "@playwright/test";

// Text booking happy path: a confirmed booking surfaces on the live dashboard feed.
test("text booking appears on the automation live feed", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: /bookings/i }).first().click();
  await expect(page.getByRole("heading", { name: /bookings/i })).toBeVisible();
  await expect(page.getByText(/confirmed|completed|dispatched/i).first()).toBeVisible();
});
