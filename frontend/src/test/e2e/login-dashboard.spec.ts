import { expect, test } from "@playwright/test";

test("redirects unauthenticated users to login and enters workspace", async ({ page }) => {
  await page.goto("/app/agreements/mutual-nda");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Enter workspace" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Open Mutual NDA" }).click();
  await expect(page).toHaveURL(/\/app\/agreements\/mutual-nda$/);
  await expect(page.getByRole("heading", { name: "Mutual NDA", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.getByRole("button", { name: "Download Mutual NDA PDF" })).toBeVisible();
});
