import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 1,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    {
      name: "mobile",
      testMatch: "public.spec.ts",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: "chrome" },
    },
    { name: "webkit", testMatch: "public.spec.ts", use: { ...devices["Desktop Safari"] } },
  ],
});
