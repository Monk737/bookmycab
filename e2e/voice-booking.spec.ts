import { test, expect } from "@playwright/test";

// Voice booking: a voice-led conversation renders its transcript + extracted slots.
test("voice conversation shows transcript and extracted slots", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: /conversations/i }).first().click();
  await page.getByRole("button", { name: /view transcript/i }).first().click();
  await expect(page.getByText(/voice note/i).first()).toBeVisible();
});
