import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "cd backend && uv run uvicorn main:app --port 8000",
      port: 8000,
      reuseExistingServer: true,
      timeout: 10000,
    },
    {
      command: "pnpm dev",
      port: 3000,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
