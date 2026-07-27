import { expect, test } from "@playwright/test";

async function signUp(page: import("@playwright/test").Page, email = "user@example.com") {
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("secret");
  await page.getByLabel("Confirm password").fill("secret");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("redirects unauthenticated users to login and enters workspace", async ({ page }) => {
  await page.goto("/app/agreements/mutual-nda");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await signUp(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue your documents" })).toBeVisible();

  await page.getByRole("link", { name: "Open Mutual NDA" }).click();
  await expect(page).toHaveURL(/\/app\/agreements\/mutual-nda$/);
  await expect(page.getByRole("heading", { name: "Mutual NDA", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.getByRole("button", { name: "Download Mutual NDA PDF" })).toBeVisible();
  await expect(page.getByText(/draft generated for review/i)).toBeVisible();
});