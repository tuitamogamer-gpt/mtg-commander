import { defineConfig, devices } from "@playwright/test";

// E2E against the dev servers. Playwright starts both (API :4000, web :5173 by
// default) and reuses them if already running. Precons should be seeded first
// (`pnpm db:seed:precons`) for the precon-import step. Set E2E_WEB_PORT to run
// the web server on another port (e.g. when 5173 is taken by another project).
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5173);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @mtgc/server dev",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @mtgc/web exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
