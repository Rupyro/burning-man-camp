import { defineConfig, devices } from "@playwright/test";

// E2E smoke tests against the production build (`next build` first). The dev "console" email
// adapter prints magic links to the server log, which the tests read from .outbox/server.log.
const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
export const SERVER_LOG = ".outbox/server.log";

export default defineConfig({
  testDir: "e2e",
  // The demo screens spec needs DEMO_MODE=true and `pnpm seed:demo`; CI runs it as its own step.
  testIgnore: process.env.DEMO_MODE === "true" ? [] : ["**/screens.spec.ts"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `mkdir -p .outbox && : > ${SERVER_LOG} && pnpm exec next start -p ${PORT} >> ${SERVER_LOG} 2>&1`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: BASE_URL, EMAIL_ADAPTER: "console" },
  },
});
