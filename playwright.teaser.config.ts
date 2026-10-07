import { defineConfig, devices } from "playwright/test";

/** Isolated public teaser checks with a dedicated :3101 dev server. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "landing-teaser.spec.ts",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3101",
    url: "http://localhost:3101/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ALLOW_REGISTRATION: "true",
      SELF_HOSTED: "false",
      DATABASE_URL: "file:/tmp/hsknest-teaser-e2e.db",
      NEXTAUTH_SECRET: "local-teaser-e2e-only",
      NEXTAUTH_URL: "http://localhost:3101",
    },
  },
});
