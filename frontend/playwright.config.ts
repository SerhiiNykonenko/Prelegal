import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "docker compose up --build backend",
      cwd: "..",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: true,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "docker compose up --build",
      cwd: "..",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
