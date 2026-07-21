import { expect, test } from "@playwright/test";

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

test("homepage hydrates cleanly and auto-populates date fields", async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));

  await page.goto("/");

  await expect(page.locator("#effectiveDate")).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  expect(consoleMessages.filter((message) => /hydration|didn't match|server rendered html/i.test(message))).toEqual([]);
});

test("shows validation errors and prevents download when required fields are empty", async ({ page }) => {
  await page.goto("/");

  let requestedDownload = false;
  page.on("request", (request) => {
    if (request.url().includes("/api/download") && request.method() === "POST") {
      requestedDownload = true;
    }
  });

  let downloadStarted = false;
  page.on("download", () => {
    downloadStarted = true;
  });

  await page.getByRole("button", { name: "Download Mutual NDA PDF" }).click();

  await expect(page.getByText("Print name is required").first()).toBeVisible();
  await expect(page.getByText("Company is required").first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(requestedDownload).toBe(false);
  expect(downloadStarted).toBe(false);
});

test("downloads a valid PDF and sends the expected API request", async ({ page }) => {
  await page.goto("/");
  await fillRequiredFields(page);

  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/download") && request.method() === "POST");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/download") && response.request().method() === "POST");
  const downloadPromise = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download Mutual NDA PDF" }).click();

  const [request, response, download] = await Promise.all([requestPromise, responsePromise, downloadPromise]);
  const payload = request.postDataJSON();

  expect(payload.partyOne.printName).toBe("Pat One");
  expect(payload.partyTwo.printName).toBe("Sam Two");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toContain("mutual-nda.pdf");
  await expect(page.getByText("PDF generated successfully.")).toBeVisible();
  expect(download.suggestedFilename()).toBe("mutual-nda.pdf");

  const path = await download.path();
  expect(path).toBeTruthy();

  const fileBuffer = await download.createReadStream().then(async (stream) => {
    if (!stream) {
      return Buffer.alloc(0);
    }

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  });

  expect(fileBuffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  expect(fileBuffer.byteLength).toBeGreaterThan(1000);
});

test("submits alternate term selections in the API payload", async ({ page }) => {
  await page.goto("/");
  await fillRequiredFields(page);

  await page.getByLabel("Continues until terminated").check();
  await page.getByLabel("In perpetuity").check();

  const requestPromise = page.waitForRequest((request) => request.url().includes("/api/download") && request.method() === "POST");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/download") && response.request().method() === "POST");
  const downloadPromise = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download Mutual NDA PDF" }).click();

  const [request, response] = await Promise.all([requestPromise, responsePromise, downloadPromise]);
  const payload = request.postDataJSON();

  expect(payload.mndaTermType).toBe("until-terminated");
  expect(payload.confidentialityTermType).toBe("perpetual");
  expect(response.status()).toBe(200);
});
