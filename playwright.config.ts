import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Helix end-to-end tests.
 *
 * Tests run against the production build served by `npm run start`.
 * Run `npm run build` before `npm run test:e2e` if you have local changes.
 *
 * CI:  PLAYWRIGHT_CI=1 npm run test:e2e
 * Dev: npm run test:e2e  (reuses an already-running server if present)
 */
export default defineConfig({
  testDir: "./e2e",

  /* Run tests in parallel within each file */
  fullyParallel: false,

  /* Retry once on CI to guard against flaky network / startup races */
  retries: process.env.CI ? 1 : 0,

  /* Single worker keeps the dev-server reuse logic simple */
  workers: 1,

  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:4173",

    /* Keep traces for the first retry only to reduce noise */
    trace: "on-first-retry",

    /* Record a video only on retry — handy for CI debugging */
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run start",
    url: "http://localhost:4173",
    /**
     * In local dev, reuse a running server so you don't have to wait for
     * a cold build.  In CI always start a fresh server.
     */
    reuseExistingServer: !process.env.CI,
  },
});
