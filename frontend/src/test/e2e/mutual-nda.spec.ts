import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function fillRequiredFields(page: import("@playwright/test").Page) {
  await page.locator("#partyOne-printName").fill("Pat One");
  await page.locator("#partyOne-title").fill("CEO");
  await page.locator("#partyOne-company").fill("Acme");
  await page.locator("#partyOne-noticeAddress").fill("100 Main St");
  await page.locator("#partyOne-signatureDate").fill("2026-08-01");

  await page.locator("#partyTwo-printName").fill("Sam Two");
  await page.locator("#partyTwo-title").fill("CFO");
  await page.locator("#partyTwo-company").fill("Beta");
  await page.locator("#partyTwo-noticeAddress").fill("200 Oak Ave");
  await page.locator("#partyTwo-signatureDate").fill("2026-08-02");
}

test("mutual nda page hydrates cleanly and auto-populates date fields", async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));

  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  await expect(page.locator("#effectiveDate")).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  expect(consoleMessages.filter((message) => /hydration|didn't match|server rendered html/i.test(message))).toEqual([]);
});

test("review step blocks download when required fields are empty", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  await page.getByRole("button", { name: "Review draft" }).click();

  await expect(page.getByText("Print name is required").first()).toBeVisible();
  await expect(page.getByText("Company is required").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review and edit before download" })).toBeVisible();
});

test("downloads a valid PDF after the review step", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");
  await fillRequiredFields(page);

  await page.getByRole("button", { name: "Review draft" }).click();

  await expect(page.getByRole("heading", { name: "Review and edit before download" })).toBeVisible();

  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/download") && request.method() === "POST");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/download") && response.request().method() === "POST");
  const downloadPromise = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download Mutual NDA PDF" }).click();

  const [request, response, download] = await Promise.all([requestPromise, responsePromise, downloadPromise]);
  const payload = request.postDataJSON();

  expect(payload.documentKey).toBe("mutual-nda");
  expect(payload.draft.partyOne.printName).toBe("Pat One");
  expect(payload.draft.partyTwo.printName).toBe("Sam Two");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toContain("mutual-nda.pdf");
  await expect(page.getByText("PDF generated successfully.")).toBeVisible();
  expect(download.suggestedFilename()).toBe("mutual-nda.pdf");
});

test("submits alternate term selections in the API payload", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");
  await fillRequiredFields(page);

  await page.getByLabel("Continues until terminated").check();
  await page.getByLabel("In perpetuity").check();

  await page.getByRole("button", { name: "Review draft" }).click();

  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/download") && request.method() === "POST");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/download") && response.request().method() === "POST");

  await page.getByRole("button", { name: "Download Mutual NDA PDF" }).click();

  const [request, response] = await Promise.all([requestPromise, responsePromise]);
  const payload = request.postDataJSON();

  expect(payload.draft.mndaTermType).toBe("until-terminated");
  expect(payload.draft.confidentialityTermType).toBe("perpetual");
  expect(response.status()).toBe(200);
});

test("persists draft across a page refresh", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");
  await fillRequiredFields(page);

  await page.reload();

  await expect(page.locator("#partyOne-printName")).toHaveValue("Pat One");
  await expect(page.locator("#partyTwo-company")).toHaveValue("Beta");
});

test("chat panel and form are visible side by side", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  await expect(page.locator(".chat-panel")).toBeVisible();
  await expect(page.locator(".draft-mode-grid-parallel")).toBeVisible();
  await expect(page.locator("#chat-message")).toBeVisible();
  await expect(page.locator("#partyOne-printName")).toBeVisible();
});

test("chat panel accepts answers and surfaces follow-up questions", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  const responsePromise = page.waitForResponse((response) => response.url().includes("/chat-turn") && response.request().method() === "POST");

  await page.locator("#chat-message").fill("Acme and Beta are evaluating a partnership under Delaware law.");
  await page.getByRole("button", { name: "Send answer" }).click();

  const response = await responsePromise;
  expect(response.status()).toBe(200);

  await expect(page.locator(".chat-transcript")).toContainText("Acme and Beta are evaluating");
  await expect(page.getByText(/party\s*1/i).first()).toBeVisible();
});

test("chat request to switch documents routes to the DPA workspace", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  await page.locator("#chat-message").fill("Please switch to a Data Processing Agreement instead.");
  await page.getByRole("button", { name: "Send answer" }).click();

  const switchResponsePromise = page.waitForResponse((response) => response.url().includes("/chat-turn") && response.request().method() === "POST");
  const response = await switchResponsePromise;
  expect(response.status()).toBe(200);
  const payload = await response.json();

  expect(payload.switchTo).toBe("data-processing-agreement");
  await expect(page.getByText(/switch to a data processing agreement/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Switch draft" }).click();
  await expect(page).toHaveURL(/\/app\/agreements\/data-processing-agreement$/);
  await expect(page.locator("#documentTitle")).toBeVisible();
});

test("chat textarea regains focus after the assistant responds", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  const textarea = page.locator("#chat-message");
  await textarea.click();
  await textarea.fill("Acme + Beta test.");
  await page.getByRole("button", { name: "Send answer" }).click();

  await expect(textarea).toBeFocused();
});

test("unsupported chat request offers the closest supported document", async ({ page }) => {
  await login(page);
  await page.goto("/app/agreements/mutual-nda");

  await page.locator("#chat-message").fill("Can I have a GDPR template?");
  await page.getByRole("button", { name: "Send answer" }).click();

  await expect(page.getByText(/data processing agreement/i).first()).toBeVisible();
});
