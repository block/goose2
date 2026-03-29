import { expect, test } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("app loads and shows home screen", async ({ page }) => {
    await page.goto("/");

    // Should show the greeting
    await expect(
      page.getByText(/Good (morning|afternoon|evening)/),
    ).toBeVisible();
  });

  test("home screen shows clock", async ({ page }) => {
    await page.goto("/");

    // Should show AM or PM
    await expect(page.getByText(/[AP]M/)).toBeVisible();
  });

  test("home screen shows chat input placeholder", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Ask Goose anything...")).toBeVisible();
  });

  test("home screen shows model badge", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Claude Sonnet 4")).toBeVisible();
  });
});
